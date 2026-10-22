import { bloquesVacios, type EstadoBloques } from '@nucleo/bloques';
import type { MarcaConReps, SesionConPesos, SesionRutina } from '@nucleo/rutina';
import type { DescansoVivo } from '@compartido/descanso';
import { cambioDeSesion } from '@compartido/sesionCache';

/**
 * EL DUEÑO ÚNICO DE LA SESIÓN EN CURSO (spec/alcance.md, "Un solo dueño", 15/10).
 *
 * Antes cada instancia de `useSesion` —la pantalla y el vigilante del gimnasio—
 * tenía su estado de React y sus refs, y se copiaban entre sí por la caché. Cada
 * bug de "una copia pisó a la otra" se tapaba con una regla nueva. Acá vive el
 * dato UNA vez por aparato: las instancias se suscriben y leen lo mismo, y lo
 * que escribe una lo ve la otra en el mismo instante, sin pasar por la caché.
 *
 * La caché sigue existiendo, pero para lo que es: sobrevivir a que se cierre la
 * app. Ya no es el canal entre dos pantallas abiertas.
 */
export type EstadoVivo = {
  inicio: string | null;
  desfasaje: number;
  series: number;
  porUbicacion: boolean;
  /** Si ya se leyó la copia del teléfono (antes, `corriendo` es el valor de arranque). */
  cacheLeida: boolean;
  bloques: EstadoBloques;
  sugerido: boolean;
  idSesion: string | null;
  descanso: DescansoVivo | null;
  ultimaActividad: string | null;
};

export const INICIAL: EstadoVivo = {
  inicio: null,
  desfasaje: 0,
  series: 0,
  porUbicacion: false,
  cacheLeida: false,
  bloques: bloquesVacios(),
  sugerido: false,
  idSesion: null,
  descanso: null,
  ultimaActividad: null,
};

let viva: EstadoVivo = INICIAL;
const oyentes = new Set<() => void>();

/** Lo de ahora. Devuelve el MISMO objeto mientras nada cambie (lo pide `useSyncExternalStore`). */
export function leerViva(): EstadoVivo {
  return viva;
}

/** Cambia lo que venga, en el acto. Avisa solo si algo cambió de verdad. */
export function cambiarViva(p: Partial<EstadoVivo>): void {
  let cambio = false;
  for (const k in p) {
    if (!Object.is(viva[k as keyof EstadoVivo], p[k as keyof EstadoVivo])) cambio = true;
  }
  if (!cambio) return;
  viva = { ...viva, ...p };
  for (const avisar of [...oyentes]) avisar();
}

export function suscribirViva(fn: () => void): () => void {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

/**
 * Un setter con la forma del de React (valor o función del anterior), para que
 * el cuerpo de `useSesion` no tenga que saber que el dato ya no es suyo.
 */
export function setterDe<K extends keyof EstadoVivo>(k: K) {
  return (v: EstadoVivo[K] | ((antes: EstadoVivo[K]) => EstadoVivo[K])) => {
    const nuevo = typeof v === 'function' ? (v as (a: EstadoVivo[K]) => EstadoVivo[K])(viva[k]) : v;
    cambiarViva({ [k]: nuevo } as Partial<EstadoVivo>);
  };
}

/**
 * Un "ref" que es una ventana al dueño: leerlo da lo de ahora y escribirlo lo
 * cambia para todos. Antes el ref era "lo de ahora" y el estado "lo dibujado", y
 * la mitad de las reglas eran para que no se separaran.
 */
export function refDe<K extends keyof EstadoVivo>(k: K): { current: EstadoVivo[K] } {
  return {
    get current() {
      return viva[k];
    },
    set current(v: EstadoVivo[K]) {
      cambiarViva({ [k]: v } as Partial<EstadoVivo>);
    },
  };
}

// Lo que no se dibuja pero también es de la sesión y no de una pantalla: antes
// era un `useRef` por instancia, y cada una tenía su propia idea.
/** La sesión que ESTE aparato tenía abierta (para el aviso "se cerró sola"). */
export const idVisto: { current: string | null } = { current: null };
/** La sesión cuyos bloques hay que traer de la base (ver `unirConGuardados`). */
export const faltanBloques: { current: string | null } = { current: null };
/** De qué sesión son los bloques en memoria (ver `bloquesSonDe`). */
export const bloquesDe: { current: string | null } = { current: null };
/** La cadena propuesta para hoy (ver `nucleo/rutina.ts`). */
export const rutinaRef: { current: string[] } = { current: [] };
/** Si la cadena salió de la rutina GUARDADA: esa no se re-engancha con el historial. */
export const rutinaEsGuardada: { current: boolean } = { current: false };
/** El historial reciente, para re-enganchar la cadena. */
export const sesionesRutinaRef: { current: SesionRutina[] } = { current: [] };
/** El mismo historial con los pesos de cada bloque: para «la última vez» de un ejercicio. */
export const historialConPesosRef: { current: SesionConPesos[] } = { current: [] };
/** Las repeticiones objetivo de la rutina activa, por ejercicio: para la regla 2 por 2 (21/10). */
export const objetivosRef: { current: Record<string, number> } = { current: {} };
/** Las marcas de la cuenta con sus repeticiones: para «las repeticiones de la última vez». */
export const marcasConRepsRef: { current: MarcaConReps[] } = { current: [] };

/**
 * La firma de la caché, UNA por aparato: lo que escribe cualquier instancia ya
 * está en el dueño, así que ninguna tiene que releerlo. Las demás escrituras —la
 * de cerrar sesión, que no firma— sí se releen.
 */
export const YO: symbol = Symbol('sesion');

/** Al cerrar sesión: lo de la cuenta anterior no puede quedar a la vista de la siguiente. */
export function olvidarViva(): void {
  cambioDeSesion();
  idVisto.current = null;
  faltanBloques.current = null;
  bloquesDe.current = null;
  rutinaRef.current = [];
  rutinaEsGuardada.current = false;
  sesionesRutinaRef.current = [];
  cambiarViva({ ...INICIAL, bloques: bloquesVacios() });
}
