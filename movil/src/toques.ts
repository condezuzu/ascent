/**
 * UN TOQUE REPETIDO NO ES OTRA SERIE (19/10, bug del gimnasio). Dos toques seguidos en el +
 * contaban dos series: quien creía que el primero no había entrado tocaba otra vez. Nadie
 * hace dos series en un segundo.
 *
 * Vive en la pantalla y no en `useSesion`: es una regla de los dedos, no del conteo (los
 * escenarios de la sesión cuentan series seguidas a propósito). La comparten el + del
 * bloque, el «Serie hecha» del descanso y «Terminar serie», que también apaga el + del
 * bloque que aparece debajo del dedo.
 */
export const TOQUE_REPETIDO_MS = 1000;

let ultimaSerie = 0;
let ultimoCierre = 0;

/** ¿Este toque en el + cuenta? Si cuenta, lo anota. */
export function cuentaLaSerie(ahora = Date.now()): boolean {
  if (ahora - ultimaSerie < TOQUE_REPETIDO_MS) return false;
  ultimaSerie = ahora;
  return true;
}

/** ¿Este toque en «Terminar serie» cierra? Si cierra, el + de después espera un segundo. */
export function cierraElBloque(ahora = Date.now()): boolean {
  if (ahora - ultimoCierre < TOQUE_REPETIDO_MS) return false;
  ultimoCierre = ahora;
  ultimaSerie = ahora;
  return true;
}
