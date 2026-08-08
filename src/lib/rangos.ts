// Escalera de rangos. El nombre NUNCA aparece en la interfaz corriente:
// solo en la subida de rango y en Estadísticas.
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

// Rango 4: diez días exactos, un planeta por día, de menor a mayor.
// El planeta ES la barra de progreso: si ves Saturno, estás por subir.
export const PLANETAS = [
  'Ceres',
  'Plutón',
  'Mercurio',
  'Marte',
  'Venus',
  'Tierra',
  'Neptuno',
  'Urano',
  'Saturno',
  'Júpiter',
] as const;

export function rangoDeRacha(racha: number): Rango {
  for (let i = RANGOS.length - 1; i >= 0; i--) {
    if (racha >= RANGOS[i].desde) return RANGOS[i];
  }
  return RANGOS[0];
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

export function planetaDeDia(racha: number): string | null {
  if (racha >= 30 && racha <= 39) return PLANETAS[racha - 30];
  return null;
}
