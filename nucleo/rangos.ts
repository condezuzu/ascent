import { DESDE_RANGO, numeroDeRango } from './reglas.ts';

// Escalera de rangos. El nombre NUNCA aparece en la interfaz corriente:
// solo en la subida de rango y en Estadísticas ("Rangos").
//
// El NÚMERO de rango, los UMBRALES (`DESDE_RANGO`) y los planetas viven en
// `reglas.ts`, que es lo que también está escrito en SQL. Acá quedan los
// nombres, que son solo del cliente: la base nunca los conoce.
export { PLANETAS, planetaDeDia } from './reglas.ts';
export type Rango = {
  n: number;
  nombre: string;
  desde: number; // día de racha en que arranca
};

// SIETE rangos, de duración creciente (5/10/15/20/25/30 días, y el último sin
// techo). El viejo "Sistema" se sacó. Los `desde` salen de `DESDE_RANGO` para
// que no puedan contradecir a `numeroDeRango` ni a la base.
const NOMBRES = ['Polvo', 'Asteroide', 'Luna', 'Planeta', 'Sol', 'Galaxia', 'Agujero negro'];
export const RANGOS: Rango[] = NOMBRES.map((nombre, i) => ({ n: i + 1, nombre, desde: DESDE_RANGO[i] }));

// El rango sale del número, no de recorrer la tabla buscando el `desde`: así
// hay UNA sola regla —la misma que corre en la base— y el nombre no puede
// contradecir al `rango_actual` que está guardado.
export function rangoDeRacha(racha: number): Rango {
  return RANGOS[numeroDeRango(racha) - 1];
}

export function siguienteRango(racha: number): Rango | null {
  const actual = rangoDeRacha(racha);
  return RANGOS.find((r) => r.n === actual.n + 1) ?? null;
}

// Progreso 0..1 dentro del rango actual
export function progresoEnRango(racha: number): number {
  const actual = rangoDeRacha(racha);
  const prox = siguienteRango(racha);
  if (!prox) return 1;
  // Acotado por los dos lados: una racha negativa o vacía daba una barra de
  // ancho negativo o NaN.
  const p = (racha - actual.desde) / (prox.desde - actual.desde);
  return Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0;
}
