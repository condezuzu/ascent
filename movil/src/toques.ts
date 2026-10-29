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

/**
 * SE MIDE DESDE EL DEDO, NO DESDE QUE LA APP LO ATIENDE (29/10). Con el teléfono trabado más
 * de un segundo, dos toques de verdad llegaban juntos al destrabarse y el segundo no contaba:
 * se perdía una serie. `toque` es la hora del toque que trae el evento (en milisegundos, en
 * el reloj del sistema); con los dos toques medidos así, cuenta lo que pasó entre los dedos.
 * Si alguno no la trae, se compara `ahora`, la hora en que se atiende, como antes.
 */
type Marca = { toque: number | null; ahora: number };
let ultimaSerie: Marca = { toque: null, ahora: -Infinity };
let ultimoCierre: Marca = { toque: null, ahora: -Infinity };

function entre(antes: Marca, toque: number | null, ahora: number): number {
  if (toque !== null && antes.toque !== null && toque >= antes.toque) return toque - antes.toque;
  return ahora - antes.ahora;
}

/** La hora del toque que trae el evento: `timestamp` en iOS y Android, `timeStamp` en la web. */
export function horaDelToque(e?: { timeStamp?: number; nativeEvent?: { timestamp?: number; timeStamp?: number } } | null): number | null {
  const t = e?.nativeEvent?.timestamp ?? e?.nativeEvent?.timeStamp ?? e?.timeStamp;
  return typeof t === 'number' && Number.isFinite(t) ? t : null;
}

/** ¿Este toque en el + cuenta? Si cuenta, lo anota. */
export function cuentaLaSerie(toque: number | null = null, ahora = Date.now()): boolean {
  if (entre(ultimaSerie, toque, ahora) < TOQUE_REPETIDO_MS) return false;
  ultimaSerie = { toque, ahora };
  return true;
}

/** ¿Este toque en «Terminar serie» cierra? Si cierra, el + de después espera un segundo. */
export function cierraElBloque(toque: number | null = null, ahora = Date.now()): boolean {
  if (entre(ultimoCierre, toque, ahora) < TOQUE_REPETIDO_MS) return false;
  ultimoCierre = { toque, ahora };
  ultimaSerie = { toque, ahora };
  return true;
}
