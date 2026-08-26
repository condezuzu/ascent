// Cuentas de distancia. No importa nada, como `reglas.ts`, para que `test:db`
// pueda cargarlo: acá un error da un número creíble y equivocado, que es la
// peor clase.

export type Punto = { lat: number; lon: number };

const RADIO_TIERRA = 6371000; // metros

/**
 * Metros entre dos puntos, por haversine.
 *
 * Alcanza de sobra: en las distancias de las que hablamos —decenas o cientos
 * de metros— la diferencia contra una fórmula elipsoidal es de centímetros,
 * y el GPS bajo techo se equivoca en decenas de metros (§13).
 */
export function metrosEntre(a: Punto, b: Punto): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Si el punto cae adentro del radio.
 *
 * `precision` es el error que reporta el GPS. Se SUMA al radio: con 40 m de
 * error, estar a 110 m de un radio de 100 puede ser estar adentro. Preferimos
 * el falso positivo al falso negativo porque el costo no es simétrico —perder
 * un día de racha que sí se entrenó duele, un día de más se corrige a mano
 * desde el calendario (§12c)— y porque el registro manual nunca desaparece.
 */
export function estaAdentro(punto: Punto, centro: Punto, radio: number, precision = 0): boolean {
  return metrosEntre(punto, centro) <= radio + Math.max(0, precision);
}
