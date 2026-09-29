/**
 * LA REGLA, UNA SOLA VEZ: elegir entre una copia EFÍMERA y una AUTORIDAD durable.
 *
 * EL BUG QUE UNIFICA (nos mordió dos veces, 28-29/9): asumir que lo que está EN
 * PANTALLA es más nuevo que lo guardado. Es falso justo después de que iOS mata
 * la app —el estado de React renace en su valor inicial (0), y la caché tiene la
 * verdad—. De ahí salieron "la última serie no se suma" y "3 de 3 · 0 en total":
 * dos parches distintos para el mismo razonamiento. Esto es el razonamiento,
 * escrito una vez, para que no haya un tercero.
 *
 * Lo EFÍMERO es lo de ahora: el estado/ref en pantalla (al releer la caché), o la
 * propia caché (al confirmar contra el servidor). La AUTORIDAD es lo más durable
 * del par: la caché (al releer) o el servidor (al confirmar).
 *
 *  - autoridad === undefined  → no hay dato durable todavía: queda lo efímero.
 *  - hayPendientes            → hay escrituras SIN SUBIR en la cola, así que lo
 *                               efímero puede ir legítimamente adelante (dos
 *                               toques que aún no llegaron): max, nunca bajar.
 *  - sin pendientes           → manda la autoridad: es la verdad guardada, o pudo
 *                               contarse en otro aparato.
 *
 * Es PURA (se prueba sin app). Cualquier lugar que elija entre "lo de ahora" y
 * "lo guardado" para el total de series usa ESTA función y ninguna otra copia
 * de la regla. (La actividad —un timestamp monótono— usa `masReciente`, que es
 * la hermana sin compuerta: un dato que solo avanza.)
 */
export function reconciliarConteo(
  efimero: number,
  autoridad: number | undefined,
  hayPendientes: boolean
): number {
  if (autoridad === undefined) return efimero;
  return hayPendientes ? Math.max(efimero, autoridad) : autoridad;
}
