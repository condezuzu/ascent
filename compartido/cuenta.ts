// EL CLIENTE VIENE POR ALIAS y no de '@supabase/supabase-js' derecho: la
// nativa tiene su propia copia del paquete, y los dos tipos no son el mismo
// para TypeScript aunque sean la misma clase. Cada app dice que es `@cliente`.
import type { Cliente } from '@cliente';
import { T } from '@nucleo/textos';
import { numeroDeRango } from '@nucleo/rangos';
import { plataforma } from '@plataforma';
import { soltarCola, vaciar } from '@compartido/cola';
import { borrarDescanso } from '@compartido/descanso';
import { borrarPerfilCache } from '@compartido/cache';
import { borrarSesionCache } from '@compartido/sesionCache';

/**
 * SALIR DE LA CUENTA, Y QUE NO QUEDE NADA PARA LA QUE ENTRE (4/10).
 *
 * Al cerrar sesión se borraba la copia del perfil y nada más. Quedaban en el
 * aparato, sin dueño anotado, la cola de escrituras, la sesión en curso, los
 * modos de carga elegidos y el objetivo de peso; la cuenta que entraba después
 * los heredaba. Lo peor era la cola: lo pendiente de una cuenta salía con el
 * token de la siguiente.
 *
 * SON DOS MOMENTOS, y la primera versión los juntó mal:
 *
 * - AL SALIR (`cerrarSesion`): primero sube lo pendiente, con el token de quien
 *   lo hizo y con tope de tiempo; después cierra; y RECIÉN SI CERRÓ borra lo de
 *   la sesión. Sin señal la librería no cierra —devuelve el error y la sesión
 *   sigue—, y borrar antes dejaba a la persona adentro y sin sus series
 *   pendientes.
 * - AL ENTRAR OTRA CUENTA (`alEntrarCon`): ahí se va también lo que es de la
 *   persona y vive solo en el aparato (los modos de carga, el objetivo de
 *   peso). Si vuelve a entrar la misma, lo encuentra. Y cubre las salidas que no
 *   pasan por el botón: una sesión que venció, una cuenta borrada desde otro
 *   aparato.
 *
 * Lo que NO se borra nunca es del aparato y no de la cuenta: la meta de series,
 * la de pasos, el sonido del descanso. Los pesos recordados y la guía ya se
 * guardan con su dueño y se descartan solos.
 */
// Las claves son de cada módulo y acá van repetidas: la sección 193 de `test:db`
// escribe por los módulos de verdad y mira qué queda, así que si una cambia de
// nombre, falla.
const DE_LA_SESION = ['ascent:llegada'];
const DE_LA_PERSONA = [
  'ascent:cargas-elegidas',
  'ascent:objetivo-peso',
  // La web solo manda la zona cuando cambia respecto de esta: a la cuenta nueva
  // le quedaba la de fábrica.
  'ascent:zona',
  'ascent:impulso-visto',
  'ascent:estancamiento-visto',
  'ascent:rango-visto',
];
const ULTIMA_CUENTA = 'ascent:ultima-cuenta';
const TOPE_PARA_SUBIR_MS = 3000;

/** Lo pendiente sube con el token de quien lo hizo. Con tope: salir no puede quedar esperando a la red. */
async function subirAntesDeSalir(supabase: Cliente) {
  let tope: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    vaciar(supabase).catch(() => undefined),
    new Promise((listo) => {
      tope = setTimeout(listo, TOPE_PARA_SUBIR_MS);
    }),
  ]);
  clearTimeout(tope);
}

/**
 * Lo de la sesión que termina: lo pendiente (y la pasada que estuviera en
 * vuelo), el entrenamiento en curso, el descanso CON su aviso programado, y la
 * copia del perfil.
 */
export async function limpiarAlSalir() {
  await soltarCola();
  await borrarSesionCache();
  await borrarDescanso();
  await Promise.all(DE_LA_SESION.map((clave) => plataforma.almacenamiento.borrar(clave)));
  await borrarPerfilCache();
}

/**
 * CERRAR SESIÓN EN ESTE APARATO. `false` si no se pudo cerrar, y entonces no
 * se borró nada: la persona sigue adentro, con todo.
 *
 * SOLO EN ESTE APARATO: sin el alcance, la librería cierra la sesión en TODOS;
 * salir del teléfono te sacaba de la web dentro de la hora, y al revés.
 */
export async function cerrarSesion(supabase: Cliente): Promise<boolean> {
  await subirAntesDeSalir(supabase);
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) return false;
  await limpiarAlSalir();
  return true;
}

/**
 * AL ENTRAR: si no es la última cuenta que usó este aparato, lo que quedó de
 * la otra se va antes de que nada lo use.
 *
 * Sin marca no se sabe de quién es lo que hay —es la primera vez con este
 * código— y casi siempre es de la misma persona: no se borra, se anota.
 */
export async function alEntrarCon(uid: string) {
  const ultima = await plataforma.almacenamiento.leer(ULTIMA_CUENTA);
  if (ultima === uid) return;
  if (ultima) {
    await limpiarAlSalir();
    await Promise.all(DE_LA_PERSONA.map((clave) => plataforma.almacenamiento.borrar(clave)));
  }
  await plataforma.almacenamiento.guardar(ULTIMA_CUENTA, uid);
}

/**
 * Junta TODO el historial del usuario en un objeto para bajar como archivo.
 *
 * De los amigos sale solo el nombre de usuario: es mi lista de amigos, no un
 * volcado de los datos de otra gente. El peso va en kilos, que es como está
 * guardado, con la unidad elegida anotada aparte para que el número se pueda
 * interpretar sin adivinar.
 */
export async function juntarMisDatos(supabase: Cliente, userId: string) {
  const [perfil, logs, pesos, fotos, descansos, amistades, retos, marcas, sesiones] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('logs').select('*').eq('user_id', userId).order('fecha'),
      supabase.from('weights').select('fecha, valor').eq('user_id', userId).order('fecha'),
      supabase
        .from('photos')
        .select('storage_path, visibilidad, es_subida_de_rango, log_id, creado')
        .eq('user_id', userId)
        .order('creado'),
      supabase.from('descansos').select('desde, dias').eq('user_id', userId).order('desde'),
      supabase.from('friendships').select('*'),
      supabase.from('challenges').select('*'),
      supabase
        .from('prs')
        .select('ejercicio, peso, reps, es_real, fecha')
        .eq('user_id', userId)
        .order('fecha'),
      supabase
        .from('sesiones')
        .select('inicio, fin, estado')
        .eq('user_id', userId)
        .order('inicio'),
    ]);

  const p = perfil.data;

  // los nombres de los amigos, para que la lista se entienda sin uuids sueltos
  const ids = new Set<string>();
  for (const a of amistades.data ?? []) {
    ids.add(a.solicitante === userId ? a.destinatario : a.solicitante);
  }
  const nombres = new Map<string, string>();
  if (ids.size > 0) {
    const { data: us } = await supabase
      .from('usuarios_publicos')
      .select('id, username')
      .in('id', [...ids]);
    for (const u of us ?? []) nombres.set(u.id, u.username);
  }

  return {
    exportado: new Date().toISOString(),
    app: 'Ascent',
    perfil: p
      ? {
          username: p.username,
          racha_actual: p.racha_actual,
          mejor_racha: p.mejor_racha,
          // El rango que se ve, de la racha: no el que tenga guardado la base.
          rango_actual: numeroDeRango(p.racha_actual),
          dias_descanso: p.dias_descanso,
          unidad_peso: p.unidad_peso,
          sexo: p.sexo ?? null,
          duracion_descanso: p.duracion_descanso ?? null,
          visibilidad_default: p.visibilidad_default,
          creado: p.creado,
        }
      : null,
    dias: (logs.data ?? []).map((l) => ({
      fecha: l.fecha,
      es_descanso: l.es_descanso,
      planeta_del_dia: l.planeta_del_dia,
    })),
    pesos_en_kilos: (pesos.data ?? []).map((w) => ({
      fecha: w.fecha,
      kilos: Number(w.valor),
    })),
    // Va lo que se levantó, no el 1RM: el 1RM es un derivado y guardarlo acá
    // congelaría la fórmula del día que se exportó. El DOTS tampoco va, por lo
    // mismo: depende del peso corporal, que ya está más arriba.
    marcas_en_kilos: (marcas.data ?? []).map((m) => ({
      ejercicio: m.ejercicio,
      kilos: Number(m.peso),
      repeticiones: m.reps,
      es_1rm_real: m.es_real,
      fecha: m.fecha,
    })),
    fotos: (fotos.data ?? []).map((f) => ({
      archivo: f.storage_path,
      visibilidad: f.visibilidad,
      de_subida_de_rango: f.es_subida_de_rango,
      creado: f.creado,
    })),
    // Las dos puntas, no la duración: la duración es `fin - inicio` y
    // guardarla acá sería repetir un derivado. `fin` en null significa que la
    // sesión no tiene duración, no que duró cero.
    sesiones: (sesiones.data ?? []).map((s) => ({
      inicio: s.inicio,
      fin: s.fin,
      estado: s.estado,
    })),
    // configuraciones de descanso fechadas: cada una rige desde su fecha
    descansos: descansos.data ?? [],
    amigos: (amistades.data ?? []).map((a) => {
      const otro = a.solicitante === userId ? a.destinatario : a.solicitante;
      return {
        username: nombres.get(otro) ?? null,
        estado: a.estado,
        lo_pedi_yo: a.solicitante === userId,
        desde: a.creado,
      };
    }),
    retos: (retos.data ?? []).map((r) => ({
      desde: r.desde,
      hasta: r.hasta,
      estado: r.estado,
      lo_gane: r.ganador === userId,
    })),
  };
}

/**
 * Borra la cuenta entera. Primero los ARCHIVOS del storage y recién después
 * la cuenta: si se hiciera al revés y el borrado de archivos fallara, esas
 * fotos quedarían para siempre en el bucket sin nadie con permiso para
 * alcanzarlas, porque el dueño ya no existiría.
 *
 * Se listan las carpetas en vez de leer la tabla `photos` para llevarse
 * también cualquier archivo que haya quedado suelto de una subida a medias.
 */
export async function eliminarCuenta(
  supabase: Cliente,
  userId: string
): Promise<{ ok: true } | { error: string }> {
  for (const bucket of ['fotos', 'avatares']) {
    const { data: archivos, error: errListar } = await supabase.storage
      .from(bucket)
      .list(userId, { limit: 1000 });
    if (errListar) return { error: T.errores.noSeQuitaronFotos };
    if (!archivos || archivos.length === 0) continue;

    const { data: borrados, error: errBorrar } = await supabase.storage
      .from(bucket)
      .remove(archivos.map((a) => `${userId}/${a.name}`));
    if (errBorrar) return { error: T.errores.noSeQuitaronFotos };

    // No alcanza con que no haya error. Si a un bucket le falta la política
    // de delete, la RLS lo frena EN SILENCIO: la respuesta viene sin error y
    // con cero archivos borrados. Así fue como una baja de cuenta dejó el
    // avatar huérfano en un bucket público. Se cuenta lo que volvió.
    if ((borrados?.length ?? 0) !== archivos.length) {
      return { error: T.errores.noSeQuitaronFotos };
    }
  }

  const { error } = await supabase.rpc('eliminar_cuenta');
  if (error) return { error: T.errores.noSeElimino };
  return { ok: true };
}
