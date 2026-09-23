/**
 * LA META DE PASOS DEL DÍA.
 *
 * Es una preferencia de pantalla, no un dato: vive en el almacenamiento del
 * aparato y no en la base, igual que "Fondo: automático / siempre / nunca". No
 * se comparte, no se compara con nadie y no entra en ninguna racha — si entrara
 * en la racha sería otra cosa, y esta app cuenta días de gimnasio.
 *
 * DIEZ MIL POR OMISIÓN, y conviene saber de dónde sale: no de la medicina, sino
 * de una campaña de marketing japonesa de 1965 para un podómetro que se llamaba
 * *manpo-kei*, "medidor de diez mil pasos". Se usa igual porque es el número que
 * todo el mundo tiene en la cabeza, y porque el valor exacto importa menos que
 * tener uno — pero por eso mismo SE PUEDE CAMBIAR, que es lo que se pidió.
 */

export const CLAVE_META_PASOS = 'ascent:meta-pasos';

export const META_PASOS_POR_OMISION = 10000;

/** Los bordes de lo que se puede escribir. Mil es una cuadra; cien mil, nadie. */
export const META_PASOS_MIN = 1000;
export const META_PASOS_MAX = 100000;

/**
 * Lo guardado, o la de omisión. Un valor roto —de otra versión, escrito a
 * mano— se trata como si no estuviera: es una preferencia de dibujo, y el peor
 * caso de equivocarse es mostrar la meta de siempre.
 */
export function leerMeta(crudo: string | null | undefined): number {
  const n = Number(crudo);
  if (!Number.isFinite(n)) return META_PASOS_POR_OMISION;
  return metaValida(n) ? Math.round(n) : META_PASOS_POR_OMISION;
}

export function metaValida(n: number): boolean {
  return Number.isFinite(n) && n >= META_PASOS_MIN && n <= META_PASOS_MAX;
}

/**
 * CUÁNTO FALTA PARA LA META DE HOY.
 *
 * `null` si ya se llegó: la pantalla dice otra cosa, no "faltan 0". Un cero
 * ahí se lee como un error de cuenta y no como haber llegado.
 */
export function faltanPasos(hoy: number, meta: number): number | null {
  const falta = Math.max(0, Math.round(meta - hoy));
  return falta > 0 ? falta : null;
}

/**
 * Qué parte de la meta lleva, de 0 a 1. Topado en 1: pasarse está bien, pero
 * una barra que se sale de su caja se lee como un error de dibujo.
 */
export function porcentajeDeMeta(hoy: number, meta: number): number {
  if (!(meta > 0)) return 0;
  return Math.min(1, Math.max(0, hoy / meta));
}
