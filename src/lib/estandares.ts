import { T } from '../textos.ts';

// Contra quién se compara la fuerza: gente que anota en una app, no
// competidores. La elección cambia el resultado entero —80 kg y 132 de
// sentadilla es la mediana acá y casi el último entre federados— y por eso la
// app la dice en Ajustes. Ver spec/fuerza.md §16.8.
//
// FUENTE: Strength Level, estándares 2026 (marzo 2015 a marzo 2026), datos
// declarados por los usuarios y sin verificar. Las cinco categorías que
// publica son puntos de la distribución: 5, 20, 50, 80 y 95.
//
// SOLO POR EJERCICIO: sumar los umbrales de los tres no da el umbral del
// total, y en las colas se rompe (spec/trampas.md). Para el total va el DOTS.
//
// No importa nada, igual que `reglas.ts`, para que `test:db` pueda cargarlo.

export const FUENTE = {
  nombre: 'Strength Level',
  url: 'https://strengthlevel.com/strength-standards',
  edicion: '2026',
  desde: 'marzo de 2015',
  hasta: 'marzo de 2026',
};

/** Las cinco categorías, con el porcentaje de gente que cada una supera. */
export const CATEGORIAS = [
  { clave: 'principiante', nombre: T.fuerza.categorias.principiante, supera: 5 },
  { clave: 'novato', nombre: T.fuerza.categorias.novato, supera: 20 },
  { clave: 'intermedio', nombre: T.fuerza.categorias.intermedio, supera: 50 },
  { clave: 'avanzado', nombre: T.fuerza.categorias.avanzado, supera: 80 },
  { clave: 'elite', nombre: T.fuerza.categorias.elite, supera: 95 },
] as const;

// Minúscula, como lo guarda la base. Con mayúsculas el bloque entero no se
// dibujaba y no había error: lo pinea la sección 32 de `test:db`.
export type SexoEstandar = 'm' | 'f';
export type EjercicioEstandar = 'sentadilla' | 'press_banca' | 'peso_muerto';

/**
 * Cada fila: peso corporal y los cinco umbrales, todo en kilos. Copiadas de
 * las tablas publicadas por la fuente.
 */
type Fila = readonly [number, number, number, number, number, number];

const SENTADILLA_M: readonly Fila[] = [
  [50, 36, 55, 78, 106, 137], [55, 43, 63, 88, 118, 150], [60, 49, 71, 98, 129, 162],
  [65, 56, 79, 107, 139, 174], [70, 62, 86, 116, 149, 185], [75, 69, 94, 124, 159, 196],
  [80, 75, 101, 132, 168, 206], [85, 81, 108, 140, 177, 216], [90, 87, 115, 148, 186, 226],
  [95, 93, 121, 156, 194, 235], [100, 98, 128, 163, 203, 244], [105, 104, 134, 170, 211, 253],
  [110, 109, 140, 177, 218, 261], [115, 115, 147, 184, 226, 270], [120, 120, 152, 191, 233, 278],
  [125, 125, 158, 197, 240, 285], [130, 130, 164, 203, 247, 293], [135, 135, 169, 209, 254, 300],
  [140, 140, 175, 215, 261, 307],
];
const SENTADILLA_F: readonly Fila[] = [
  [40, 19, 34, 53, 76, 102], [45, 23, 38, 58, 82, 110], [50, 26, 42, 63, 88, 116],
  [55, 29, 46, 68, 94, 123], [60, 32, 49, 72, 99, 129], [65, 35, 53, 76, 104, 134],
  [70, 37, 56, 80, 109, 140], [75, 40, 59, 84, 113, 145], [80, 42, 62, 88, 117, 149],
  [85, 45, 65, 91, 121, 154], [90, 47, 68, 94, 125, 158], [95, 49, 71, 98, 129, 162],
  [100, 52, 74, 101, 132, 166], [105, 54, 76, 104, 136, 170], [110, 56, 79, 107, 139, 174],
  [115, 58, 81, 109, 142, 177], [120, 60, 83, 112, 145, 181],
];
const BANCA_M: readonly Fila[] = [
  [50, 27, 41, 58, 78, 101], [55, 32, 47, 65, 87, 110], [60, 37, 53, 72, 95, 119],
  [65, 42, 59, 79, 102, 128], [70, 47, 64, 85, 110, 136], [75, 51, 70, 92, 117, 144],
  [80, 56, 75, 98, 124, 151], [85, 60, 80, 104, 130, 158], [90, 65, 85, 109, 137, 165],
  [95, 69, 90, 115, 143, 172], [100, 73, 95, 120, 149, 179], [105, 77, 99, 125, 155, 185],
  [110, 81, 104, 131, 160, 191], [115, 85, 108, 135, 166, 197], [120, 89, 113, 140, 171, 203],
  [125, 93, 117, 145, 176, 209], [130, 97, 121, 150, 181, 214], [135, 100, 125, 154, 186, 220],
  [140, 104, 129, 158, 191, 225],
];
const BANCA_F: readonly Fila[] = [
  [40, 10, 19, 33, 49, 68], [45, 12, 22, 36, 54, 74], [50, 14, 25, 40, 58, 79],
  [55, 17, 28, 44, 62, 84], [60, 19, 31, 47, 66, 88], [65, 21, 33, 50, 70, 92],
  [70, 22, 36, 53, 74, 96], [75, 24, 38, 56, 77, 100], [80, 26, 40, 59, 80, 104],
  [85, 28, 43, 61, 83, 107], [90, 30, 45, 64, 86, 111], [95, 31, 47, 66, 89, 114],
  [100, 33, 49, 69, 92, 117], [105, 35, 51, 71, 94, 120], [110, 36, 53, 73, 97, 123],
  [115, 38, 54, 75, 99, 126], [120, 39, 56, 77, 102, 128],
];
const MUERTO_M: readonly Fila[] = [
  [50, 46, 68, 96, 129, 164], [55, 54, 77, 107, 141, 178], [60, 61, 86, 117, 153, 191],
  [65, 68, 95, 127, 164, 204], [70, 75, 103, 137, 175, 216], [75, 82, 111, 146, 186, 228],
  [80, 89, 119, 155, 196, 239], [85, 96, 127, 164, 205, 250], [90, 102, 134, 172, 215, 260],
  [95, 108, 141, 180, 224, 270], [100, 114, 148, 188, 232, 279], [105, 120, 155, 195, 241, 289],
  [110, 126, 161, 203, 249, 298], [115, 132, 168, 210, 257, 306], [120, 137, 174, 217, 265, 315],
  [125, 143, 180, 224, 272, 323], [130, 148, 186, 231, 280, 331], [135, 153, 192, 237, 287, 339],
  [140, 159, 198, 243, 294, 346],
];
const MUERTO_F: readonly Fila[] = [
  [40, 26, 43, 65, 92, 121], [45, 30, 48, 71, 99, 129], [50, 34, 52, 76, 105, 136],
  [55, 37, 56, 81, 111, 143], [60, 40, 60, 86, 116, 149], [65, 43, 64, 90, 121, 155],
  [70, 46, 68, 95, 126, 160], [75, 49, 71, 99, 131, 166], [80, 52, 74, 102, 135, 170],
  [85, 54, 77, 106, 139, 175], [90, 57, 80, 109, 143, 180], [95, 59, 83, 113, 147, 184],
  [100, 61, 86, 116, 151, 188], [105, 64, 89, 119, 154, 192], [110, 66, 91, 122, 158, 196],
  [115, 68, 94, 125, 161, 200], [120, 70, 96, 128, 164, 203],
];

const TABLAS: Record<EjercicioEstandar, Record<SexoEstandar, readonly Fila[]>> = {
  sentadilla: { m: SENTADILLA_M, f: SENTADILLA_F },
  press_banca: { m: BANCA_M, f: BANCA_F },
  peso_muerto: { m: MUERTO_M, f: MUERTO_F },
};

export const EJERCICIOS_ESTANDAR: EjercicioEstandar[] = [
  'sentadilla',
  'press_banca',
  'peso_muerto',
];

export function esEjercicioEstandar(id: string): id is EjercicioEstandar {
  return (EJERCICIOS_ESTANDAR as string[]).includes(id);
}

export function esSexoEstandar(s: string | null | undefined): s is SexoEstandar {
  return s === 'm' || s === 'f';
}

/**
 * Los cinco umbrales para ESE peso corporal. Entre filas se interpola; fuera
 * de la tabla se usa el borde y se avisa. Extrapolar daría un número con la
 * misma pinta que los demás y ningún respaldo.
 */
export function umbrales(
  ejercicio: EjercicioEstandar,
  sexo: SexoEstandar,
  pesoCorporal: number
): { valores: number[]; fueraDeTabla: boolean } {
  const filas = TABLAS[ejercicio][sexo];
  const primera = filas[0];
  const ultima = filas[filas.length - 1];

  if (pesoCorporal <= primera[0]) {
    return { valores: primera.slice(1), fueraDeTabla: pesoCorporal < primera[0] };
  }
  if (pesoCorporal >= ultima[0]) {
    return { valores: ultima.slice(1), fueraDeTabla: pesoCorporal > ultima[0] };
  }

  let i = 0;
  while (filas[i + 1][0] < pesoCorporal) i++;
  const a = filas[i];
  const b = filas[i + 1];
  const t = (pesoCorporal - a[0]) / (b[0] - a[0]);
  const valores: number[] = [];
  for (let c = 1; c <= 5; c++) valores.push(a[c] + (b[c] - a[c]) * t);
  return { valores, fueraDeTabla: false };
}

export type Ubicacion = {
  /** A cuánta gente le gana, de 1 a 99. Derivación nuestra, no el dato. */
  supera: number;
  /** La categoría de la fuente, que sí es el dato original. */
  categoria: string;
  clave: string;
  fueraDeTabla: boolean;
  /** Kilos que faltan para la primera categoría, o `null` si ya se entró. */
  faltaParaPrincipiante: number | null;
};

/**
 * Dónde cae un levantamiento entre los cinco umbrales. Por debajo del primero
 * se interpola contra cero —única referencia— y por arriba del último se corta
 * en 95: la tabla no tiene con qué separar al 96 del 99,9.
 */
function ubicarEntre(valores: number[], kg: number, fueraDeTabla: boolean): Ubicacion {
  const cortes = CATEGORIAS.map((c) => c.supera);
  let supera: number;
  if (kg <= valores[0]) {
    supera = valores[0] > 0 ? (kg / valores[0]) * cortes[0] : 0;
  } else if (kg >= valores[4]) {
    supera = cortes[4];
  } else {
    let i = 0;
    while (kg > valores[i + 1]) i++;
    const t = (kg - valores[i]) / (valores[i + 1] - valores[i]);
    supera = cortes[i] + (cortes[i + 1] - cortes[i]) * t;
  }

  // Debajo del primer umbral no hay categoría: la fuente no nombra ese tramo.
  let cat = -1;
  for (let i = 0; i < 5; i++) if (kg >= valores[i]) cat = i;

  return {
    supera: Math.min(99, Math.max(1, Math.round(supera))),
    categoria: cat < 0 ? T.fuerza.categorias.arrancando : CATEGORIAS[cat].nombre,
    clave: cat < 0 ? 'arrancando' : CATEGORIAS[cat].clave,
    fueraDeTabla,
    faltaParaPrincipiante: cat < 0 ? Math.round((valores[0] - kg) * 10) / 10 : null,
  };
}

/**
 * Dónde cae un ejercicio entre la gente de su sexo y su peso corporal. `kg` es
 * el 1RM estimado, el mismo que alimenta el DOTS.
 */
export function ubicar(
  ejercicio: EjercicioEstandar,
  sexo: SexoEstandar,
  pesoCorporal: number,
  kg: number
): Ubicacion {
  const { valores, fueraDeTabla } = umbrales(ejercicio, sexo, pesoCorporal);
  return ubicarEntre(valores, kg, fueraDeTabla);
}

/**
 * En todas las fuentes la muestra de mujeres es mucho más chica —un millón
 * contra casi diez en banca—, así que el número no está igual de firme y la
 * app lo dice.
 */
export function muestraFina(sexo: SexoEstandar): boolean {
  return sexo === 'f';
}
