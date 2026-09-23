/**
 * CUÁNDO INSISTIR CON EL PUNTO DEL GIMNASIO, y cuándo callarse.
 *
 * EL MOMENTO ES JUSTO DESPUÉS DE REGISTRAR EL DÍA, y no es un capricho de
 * ubicación en la pantalla: es el único instante en que la frase se puede
 * probar. Acabás de anotar a mano algo que la app podía anotar sola. En
 * cualquier otro momento "marcá tu gimnasio" es una función más de una lista;
 * ahí es la respuesta a lo que se acaba de hacer.
 *
 * INSISTIR NO ES REPETIR PARA SIEMPRE. Un cartel que aparece todos los días
 * hasta que cedas no es insistir, es hostigar, y a la tercera se vuelve parte
 * del fondo — deja de leerse y encima ensucia la pantalla del día logrado. Por
 * eso:
 *
 *   - UNA VEZ POR DÍA como mucho. Registrar el día, borrarlo y volver a
 *     registrarlo no cuenta tres veces.
 *   - TRES DÍAS EN TOTAL, y después nunca más.
 *
 * Y CUANDO SE CALLA NO QUEDA UN HUECO: sigue estando el globo quieto de
 * siempre, que no se va nunca mientras no haya punto. Lo que se termina es la
 * insistencia, no la oferta.
 *
 * Esto es del núcleo y no de la pantalla porque es una regla con memoria y con
 * fechas, que es exactamente lo que se puede probar con números.
 */

/** Dónde se guarda. Mismo prefijo que el resto de las claves de la app. */
export const CLAVE_INSISTIR_GIMNASIO = 'ascent:gimnasio-insistido';

/** Después de tres días, la oferta queda en el globo quieto y nada más. */
export const VECES_MAXIMAS = 3;

export type MemoriaInsistir = {
  /** Cuántos días distintos se mostró. */
  veces: number;
  /** El último día que se mostró, en ISO. */
  ultimo: string | null;
};

const VACIA: MemoriaInsistir = { veces: 0, ultimo: null };

/**
 * Lee lo guardado. Un valor roto o de otra versión se trata como "nunca se
 * mostró": es un cartel de ayuda, y el peor caso de equivocarse es mostrarlo
 * una vez de más.
 */
export function leerMemoria(crudo: string | null): MemoriaInsistir {
  if (!crudo) return VACIA;
  try {
    const m = JSON.parse(crudo) as Partial<MemoriaInsistir>;
    const veces = typeof m.veces === 'number' && Number.isFinite(m.veces) ? Math.max(0, Math.floor(m.veces)) : 0;
    const ultimo = typeof m.ultimo === 'string' ? m.ultimo : null;
    return { veces, ultimo };
  } catch {
    return VACIA;
  }
}

/**
 * ¿Se muestra hoy?
 *
 * `tienePunto` manda sobre todo lo demás: con el gimnasio ya marcado no hay
 * nada que ofrecer, y la memoria ni se mira.
 */
export function hayQueInsistir(
  tienePunto: boolean,
  registradoHoy: boolean,
  hoy: string,
  memoria: MemoriaInsistir
): boolean {
  if (tienePunto || !registradoHoy) return false;
  if (memoria.veces >= VECES_MAXIMAS) return false;
  return memoria.ultimo !== hoy;
}

/** La memoria después de mostrarlo hoy. Un mismo día no suma dos veces. */
export function despuesDeMostrar(hoy: string, memoria: MemoriaInsistir): MemoriaInsistir {
  if (memoria.ultimo === hoy) return memoria;
  return { veces: memoria.veces + 1, ultimo: hoy };
}
