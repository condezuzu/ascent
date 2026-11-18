// LO QUE ASCENT Y MOSS SE DEJAN EN EL LLAVERO (D27 de la spec de Moss, «Vincular en menos de 10
// segundos», 26/10/2026).
//
// Las dos apps son del mismo equipo de Apple y comparten un grupo del llavero que ninguna otra app
// puede leer. Cada una deja ahí su sesión (el access token, que vence en una hora) y quién es; la
// otra la lee y vincula con dos toques: la función `moss-vincular` del servidor revisa las dos
// sesiones con Supabase. Acá está la forma de lo guardado y cómo se lee, sin nada del teléfono (el
// puente es `movil/src/plataforma/llavero.ts`).
//
// EL CONTRATO ES DE LAS DOS APPS y Moss ya lo usa: cambiar una clave o un campo de un lado rompe
// el otro sin ningún error.
//
// NO importa nada, como `textos.ts`, para que `test:db` lo cargue con node pelado.

export const LLAVERO_COMPARTIDO = {
  servicio: 'uy.condeag.compartido',
  // Con el prefijo del equipo: es el `$(AppIdentifierPrefix)` del entitlement de `movil/app.json`.
  grupo: 'XF9N8X9KJG.uy.condeag.compartido',
  deAscent: 'ascent.sesion',
  deMoss: 'moss.sesion',
} as const;

export type SesionCompartida = {
  v: 1;
  app: 'ascent' | 'moss';
  usuario: string;
  /** El nombre de usuario de Ascent o el nombre de Moss; vacío mientras no se sabe. */
  nombre: string;
  token: string;
  /** Cuándo vence el token, en segundos desde 1970 (el `expires_at` de Supabase). */
  vence: number;
};

/** Con menos que esto por delante, el token no llega vivo al servidor. */
export const MARGEN_SEG = 60;

/** Lo que se usa de una sesión de Supabase (la del aviso de auth tiene esta forma). */
export type SesionDeSupabase = {
  access_token?: string | null;
  expires_at?: number | null;
  expires_in?: number | null;
  user?: { id?: string | null } | null;
} | null | undefined;

/**
 * Lo que Ascent escribe en `ascent.sesion`, o `null` si a la sesión le falta algo. Nunca el token
 * de refresco: Supabase lo rota, y usarlo desde Moss dejaría a Ascent sin sesión.
 */
export function sesionParaElLlavero(sesion: SesionDeSupabase, nombre: string | null | undefined, ahoraSeg: number): string | null {
  const token = sesion?.access_token;
  const usuario = sesion?.user?.id;
  const vence =
    typeof sesion?.expires_at === 'number' ? sesion.expires_at : typeof sesion?.expires_in === 'number' ? ahoraSeg + sesion.expires_in : null;
  if (!token || !usuario || vence === null || !Number.isFinite(vence)) return null;
  const s: SesionCompartida = { v: 1, app: 'ascent', usuario, nombre: (nombre ?? '').trim(), token, vence };
  return JSON.stringify(s);
}

/**
 * La sesión que dejó Moss, si sirve para vincular: bien formada, de Moss y con más de
 * `MARGEN_SEG` por delante. Cualquier otra cosa es «no hay»: abrir Moss la renueva.
 */
export function sesionDeMoss(crudo: string | null | undefined, ahoraSeg: number): SesionCompartida | null {
  if (!crudo) return null;
  let x: unknown;
  try {
    x = JSON.parse(crudo);
  } catch {
    return null;
  }
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const s = x as Record<string, unknown>;
  if (s.v !== 1 || s.app !== 'moss') return null;
  if (typeof s.usuario !== 'string' || !s.usuario || typeof s.token !== 'string' || !s.token) return null;
  if (typeof s.vence !== 'number' || !Number.isFinite(s.vence) || s.vence - MARGEN_SEG <= ahoraSeg) return null;
  return { v: 1, app: 'moss', usuario: s.usuario, nombre: typeof s.nombre === 'string' ? s.nombre.trim() : '', token: s.token, vence: s.vence };
}

/** Qué muestra la hoja de vincular. Con la sesión de Moss alcanza, aunque no se sepa si está instalada. */
export function pasoDeLaHoja(deMoss: SesionCompartida | null, mossInstalada: boolean): 'vincular' | 'abrir-moss' | 'conseguir-moss' {
  if (deMoss) return 'vincular';
  return mossInstalada ? 'abrir-moss' : 'conseguir-moss';
}

export type ResultadoDeVincular = { ok: true } | { ok: false; motivo: 'vencida' | 'sin_sesion' | 'sin_ascent' | 'red' | 'servidor' };

/**
 * La respuesta de `moss-vincular`; `estado` es null si no llegó ninguna (sin conexión o pasó el
 * tope). Desde Ascent, 'vencida' es la sesión de Moss (la que va en `otra`) y 'sin_sesion' la de
 * Ascent.
 */
export function resultadoDeVincular(estado: number | null, cuerpo: unknown): ResultadoDeVincular {
  if (estado === null) return { ok: false, motivo: 'red' };
  const c = cuerpo && typeof cuerpo === 'object' && !Array.isArray(cuerpo) ? (cuerpo as Record<string, unknown>) : {};
  if (estado >= 200 && estado < 300) return c.ok === true ? { ok: true } : { ok: false, motivo: 'servidor' };
  if (c.error === 'vencida' || c.error === 'sin_sesion' || c.error === 'sin_ascent') return { ok: false, motivo: c.error };
  return { ok: false, motivo: 'servidor' };
}

/** Lo que contesta `moss.estado_del_vinculo()`. Cualquier otra cosa es «sin vincular». */
export function estaVinculada(datos: unknown): boolean {
  const d = Array.isArray(datos) ? datos[0] : datos;
  return !!d && typeof d === 'object' && (d as Record<string, unknown>).vinculada === true;
}

type Dependencias = {
  guardar: (clave: string, valor: string) => Promise<unknown>;
  borrar: (clave: string) => Promise<unknown>;
  /** El nombre de usuario guardado en el teléfono para esa cuenta, si hay. */
  nombreGuardado: (uid: string) => Promise<string | null | undefined>;
  ahoraSeg: () => number;
};

/**
 * LA SESIÓN DE ASCENT EN EL LLAVERO, siguiendo a la de Supabase: con sesión se deja (al entrar, al
 * abrir y en cada renovación), sin sesión se borra, y con otro nombre se vuelve a escribir.
 *
 * TODO PASA EN FILA, y cada escritura usa lo último que se sabe cuando le toca, no lo que había al
 * pedirla: una renovación y un nombre nuevo que llegan juntos no dejan escrito el token viejo, y una
 * escritura que esperaba no vuelve a dejar la sesión después de salir.
 *
 * Las funciones devuelven la fila para las pruebas; la app no la espera.
 */
export function crearSesionCompartida(d: Dependencias) {
  let sesion: SesionDeSupabase = null;
  let nombre: { uid: string; nombre: string } | null = null;
  let fila: Promise<void> = Promise.resolve();
  const enFila = (tarea: () => Promise<unknown>) => {
    fila = fila.then(tarea).then(
      () => undefined,
      () => undefined
    );
    return fila;
  };

  async function escribir() {
    const s = sesion;
    const uid = s?.user?.id;
    if (!s || !uid) return;
    if (nombre?.uid !== uid) {
      const guardado = (await d.nombreGuardado(uid))?.trim();
      // Mientras se leía pudo llegar el nombre de verdad, u otra cuenta.
      if (guardado && nombre?.uid !== uid && sesion?.user?.id === uid) nombre = { uid, nombre: guardado };
    }
    // Llegó otra sesión, o se salió: lo que sigue en la fila ya es por eso.
    if (sesion !== s) return;
    const valor = sesionParaElLlavero(s, nombre?.uid === uid ? nombre.nombre : '', d.ahoraSeg());
    if (valor) await d.guardar(LLAVERO_COMPARTIDO.deAscent, valor);
  }

  return {
    /** Cada aviso de auth, con la sesión que trae. No espera nada ni le pregunta nada a Supabase. */
    alAviso(evento: string, viva: SesionDeSupabase): Promise<void> {
      // Sin sesión también al abrir: el token que hubiera quedado ya no sirve (se habría renovado).
      if (evento === 'SIGNED_OUT' || !viva?.access_token) {
        sesion = null;
        nombre = null;
        return enFila(() => d.borrar(LLAVERO_COMPARTIDO.deAscent));
      }
      sesion = viva;
      return enFila(escribir);
    },
    /** El nombre de usuario de una cuenta: al llegar el perfil, al elegirlo y al cambiarlo. */
    anotarNombre(uid: string, nuevo: string | null | undefined): Promise<void> {
      const limpio = (nuevo ?? '').trim();
      if (!uid || !limpio || (nombre?.uid === uid && nombre.nombre === limpio)) return fila;
      nombre = { uid, nombre: limpio };
      return sesion?.user?.id === uid ? enFila(escribir) : fila;
    },
  };
}
