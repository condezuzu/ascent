/**
 * "HICISTE 102 EN BANCA. ¿LO GUARDO COMO MARCA?" (`spec/peso-y-estadistica.md`
 * §1.4, decidido el 15/9/2026: es lo que hace que las marcas se carguen solas).
 *
 * LA APP NO CREA MARCAS SOLAS, y eso no cambia. El DOTS se compara con gente de
 * verdad; una marca puesta a partir de un número tecleado apurado entre series
 * lo ensucia sin que nadie se entere. Lo que hace esto es PREGUNTAR, al
 * terminar, con el dato ya escrito.
 *
 * QUÉ SE PROPONE, Y QUÉ NO:
 *
 * - **Solo pesos en total** (barra o máquina). Una marca no dice si "30" era
 *   por mancuerna o la mancuerna sola, y el DOTS suma totales: proponer "30 kg
 *   en press con mancuernas" como marca sería guardar un número que después
 *   nadie sabe leer.
 * - **Solo si supera la marca vigente de verdad.** Se compara contra el 1RM de
 *   la mejor marca: una serie más pesada que ese 1RM es mejor sin importar las
 *   repeticiones. Una más liviana con muchas repeticiones PODRÍA serlo, pero
 *   las repeticiones no se anotan, y proponer "a lo mejor" es preguntar de más.
 * - **Sin marca previa, solo los tres del DOTS.** Son los que arman el número de
 *   fuerza; preguntar por cada uno de los cien ejercicios la primera vez que se
 *   anota un peso sería una encuesta al final de cada sesión.
 * - **Tres como mucho**, los del DOTS primero.
 *
 * NO IMPORTA NADA salvo reglas y lecturas puras: se prueba con node pelado.
 */

import { unRM } from './reglas.ts';
import { cargaVigente } from './carga.ts';
import { leerBloques } from './volumen.ts';

export type MarcaGuardada = { ejercicio: string; peso: number; reps: number; es_real: boolean };

export type EjercicioParaMarca = { carga?: string | null; cuenta_dots?: boolean };

export type Sugerencia = {
  ejercicio: string;
  /** El peso más alto de la sesión en ese ejercicio, en kilos. */
  peso: number;
  /** El 1RM de la mejor marca que había; `null` si no había ninguna. */
  antes: number | null;
};

/** Los límites de la tabla de marcas (`prs.peso between 1 and 600`). */
const PESO_MIN = 1;
const PESO_MAX = 600;
export const MAXIMO_DE_SUGERENCIAS = 3;

export function marcasParaProponer({
  bloques,
  marcas,
  catalogo,
}: {
  /** Los bloques de la sesión que terminó, como se guardan. */
  bloques: unknown;
  /** Todas las marcas cargadas (o las mejores: da lo mismo). */
  marcas: MarcaGuardada[];
  catalogo: Map<string, EjercicioParaMarca>;
}): Sugerencia[] {
  const mejorPorEjercicio = new Map<string, number>();
  for (const m of marcas) {
    const rm = unRM(Number(m.peso), Number(m.reps), !!m.es_real);
    if (!Number.isFinite(rm)) continue;
    mejorPorEjercicio.set(m.ejercicio, Math.max(mejorPorEjercicio.get(m.ejercicio) ?? 0, rm));
  }

  // El más pesado de la sesión por ejercicio, solo en bloques "en total". El
  // modo sale del bloque; si el bloque no lo trae (sin la 38), del catálogo.
  const pesado = new Map<string, number>();
  for (const b of leerBloques(bloques)) {
    const del = catalogo.get(b.ejercicio);
    if (!del) continue;
    const crudo = (Array.isArray(bloques) ? bloques[b.orden - 1] : null) as { carga?: unknown } | null;
    if (cargaVigente(crudo?.carga, del.carga) !== 'total') continue;
    for (const p of b.pesos) {
      if (p === null || p < PESO_MIN || p > PESO_MAX) continue;
      pesado.set(b.ejercicio, Math.max(pesado.get(b.ejercicio) ?? 0, p));
    }
  }

  const sugerencias: (Sugerencia & { dots: boolean })[] = [];
  for (const [ejercicio, peso] of pesado) {
    const dots = !!catalogo.get(ejercicio)?.cuenta_dots;
    const antes = mejorPorEjercicio.get(ejercicio) ?? null;
    if (antes === null ? !dots : peso <= antes + 1e-9) continue;
    sugerencias.push({ ejercicio, peso, antes, dots });
  }
  return sugerencias
    .sort((a, b) => (a.dots !== b.dots ? (a.dots ? -1 : 1) : b.peso - a.peso))
    .slice(0, MAXIMO_DE_SUGERENCIAS)
    .map(({ ejercicio, peso, antes }) => ({ ejercicio, peso, antes }));
}

/** Las repeticiones que se ofrecen. Hasta diez: la tabla acepta hasta veinte, pero una "marca" de más de diez ya no es fuerza. */
export const REPETICIONES_PARA_MARCA = [1, 2, 3, 4, 5, 6, 8, 10] as const;

/** Lo que va a la tabla de marcas. Una repetición es un 1RM real. */
export function filaDeMarca(s: Sugerencia, reps: number, fecha: string) {
  return { ejercicio: s.ejercicio, peso: Math.round(s.peso * 100) / 100, reps, es_real: reps === 1, fecha };
}
