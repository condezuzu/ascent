import { numeroDeRango } from './reglas';

// Escalera de rangos. El nombre NUNCA aparece en la interfaz corriente:
// solo en la subida de rango y en Estadísticas.
//
// El NÚMERO de rango y los planetas viven en `reglas.ts`, que es lo que
// también está escrito en SQL. Acá quedan los nombres, que son solo del
// cliente: la base nunca los conoce.
export { PLANETAS, planetaDeDia } from './reglas';
export type Rango = {
  n: number;
  nombre: string;
  desde: number; // día de racha en que arranca
};

// Cada rango dura diez días: ochenta días hasta el agujero negro.
// Al llegar al rango 8 se queda ahí; la racha sigue subiendo igual.
export const RANGOS: Rango[] = [
  { n: 1, nombre: 'Polvo', desde: 0 },
  { n: 2, nombre: 'Asteroide', desde: 10 },
  { n: 3, nombre: 'Luna', desde: 20 },
  { n: 4, nombre: 'Planeta', desde: 30 },
  { n: 5, nombre: 'Sol', desde: 40 },
  { n: 6, nombre: 'Sistema', desde: 50 },
  { n: 7, nombre: 'Galaxia', desde: 60 },
  { n: 8, nombre: 'Agujero negro', desde: 70 },
];

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
  return Math.min(1, (racha - actual.desde) / (prox.desde - actual.desde));
}
