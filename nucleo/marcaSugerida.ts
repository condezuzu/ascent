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
 * - **Solo si PUEDE superar la marca vigente**, y acá hay un arreglo del
 *   16/9/2026 que vale contar. Antes se comparaba el peso crudo de la serie
 *   contra el 1RM de la mejor marca: "100 kg no supera tu marca de 110".
 *
 *   Eso está mal y siempre hacia el mismo lado. Un 3×8 con 100 kg es un 1RM
 *   estimado de 133: bastante MÁS que esa marca de 110. Comparar un peso de
 *   trabajo contra un 1RM es comparar dos cosas distintas, y el resultado era
 *   que **cuanto mejor entrenabas por repeticiones, menos te ofrecía la app**.
 *   Justo al revés de lo que tiene que hacer.
 *
 *   Ahora se compara 1RM contra 1RM. Como las repeticiones no se anotan, para
 *   PREGUNTAR se usa el techo —las diez, que es el máximo que ofrece la hoja—:
 *   si ni con diez repeticiones esa serie llegaría a la marca, no hay nada que
 *   preguntar. El número de verdad lo pone la persona al confirmar, y ahí se
 *   sabe si quedó como marca nueva o no.
 *
 *   PREGUNTA MÁS QUE ANTES, a propósito. El costo de preguntar de más es un
 *   toque en "No"; el de preguntar de menos es una marca que nunca se carga y
 *   un DOTS que miente para abajo.
 * - **Sin marca previa, solo los tres del DOTS.** Son los que arman el número de
 *   fuerza; preguntar por cada uno de los cien ejercicios la primera vez que se
 *   anota un peso sería una encuesta al final de cada sesión.
 * - **Tres como mucho**, los del DOTS primero.
 *
 * CON LAS REPETICIONES ANOTADAS NO SE PREGUNTA (6/11, a pedido: "las reps ya
 * están agregadas cuando registras las series. No tiene sentido"). Con
 * «Registrar repeticiones» el número ya lo escribió la persona en la serie: la
 * cuenta es exacta, y si supera la marca se guarda y se avisa —que se avise es
 * lo que mantiene la regla de arriba: nada entra sin que la persona se entere—.
 * Si no la supera, no hay nada que decir. Más de diez no es una marca de fuerza:
 * ni se guarda ni se pregunta. La serie sin repeticiones se pregunta como siempre.
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
  /** El peso de la serie que se propone, en kilos: el más alto de la sesión si se pregunta. */
  peso: number;
  /** El 1RM de la mejor marca que había; `null` si no había ninguna. */
  antes: number | null;
  /** Las repeticiones anotadas de esa serie. Con llave ya ES marca nueva y no se pregunta; sin llave, se pregunta. */
  reps?: number;
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

  // Por ejercicio, solo en bloques "en total": la serie con repeticiones
  // anotadas de mejor 1RM, y el peso más alto de las que no las tienen. El modo
  // sale del bloque; si el bloque no lo trae (sin la 38), del catálogo.
  const anotada = new Map<string, { peso: number; reps: number; rm: number }>();
  const pesado = new Map<string, number>();
  for (const b of leerBloques(bloques)) {
    const del = catalogo.get(b.ejercicio);
    if (!del) continue;
    const crudo = (Array.isArray(bloques) ? bloques[b.orden - 1] : null) as { carga?: unknown } | null;
    if (cargaVigente(crudo?.carga, del.carga) !== 'total') continue;
    b.pesos.forEach((p, i) => {
      if (p === null || p < PESO_MIN || p > PESO_MAX) return;
      const reps = b.reps[i];
      if (reps === null) {
        pesado.set(b.ejercicio, Math.max(pesado.get(b.ejercicio) ?? 0, p));
        return;
      }
      if (reps > REPS_TOPE) return;
      const rm = unRmDeSerie(p, reps);
      if (rm > (anotada.get(b.ejercicio)?.rm ?? -Infinity)) anotada.set(b.ejercicio, { peso: p, reps, rm });
    });
  }

  const sugerencias: (Sugerencia & { dots: boolean })[] = [];
  for (const ejercicio of new Set([...anotada.keys(), ...pesado.keys()])) {
    const dots = !!catalogo.get(ejercicio)?.cuenta_dots;
    const antes = mejorPorEjercicio.get(ejercicio) ?? null;
    // Sin marca previa, solo los tres del DOTS: si no, la primera vez que anotas
    // un peso en cada uno de los cien ejercicios termina siendo una encuesta (o,
    // con las repeticiones anotadas, un aviso de marca nueva por ejercicio).
    if (antes === null && !dots) continue;
    const a = anotada.get(ejercicio);
    if (a && superaLaMarca(a.peso, a.reps, antes)) {
      sugerencias.push({ ejercicio, peso: a.peso, antes, reps: a.reps, dots });
      continue;
    }
    // Sin repeticiones, alcanza con que PUEDA superarla.
    const peso = pesado.get(ejercicio);
    if (peso !== undefined && podriaSuperar(peso, antes)) sugerencias.push({ ejercicio, peso, antes, dots });
  }
  return sugerencias
    .sort((a, b) => (a.dots !== b.dots ? (a.dots ? -1 : 1) : b.peso - a.peso))
    .slice(0, MAXIMO_DE_SUGERENCIAS)
    .map(({ ejercicio, peso, antes, reps }) => (reps === undefined ? { ejercicio, peso, antes } : { ejercicio, peso, antes, reps }));
}

/** Las repeticiones que se ofrecen. Hasta diez: la tabla acepta hasta veinte, pero una "marca" de más de diez ya no es fuerza. */
export const REPETICIONES_PARA_MARCA = [1, 2, 3, 4, 5, 6, 8, 10] as const;

/** El techo de lo que se puede elegir, que es lo que hace de cota al preguntar. */
export const REPS_TOPE = REPETICIONES_PARA_MARCA[REPETICIONES_PARA_MARCA.length - 1];

/**
 * El 1RM de una serie de la sesión. Una sola repetición ES el 1RM; de ahí para
 * arriba se estima igual que en la base (`un_rm`), para que los dos lados
 * digan lo mismo.
 */
export function unRmDeSerie(peso: number, reps: number): number {
  return unRM(peso, reps, reps === 1);
}

/**
 * ¿Esta serie, a estas repeticiones, es mejor que la marca que había?
 *
 * Sin marca previa, cualquier cosa lo es. El `1e-9` es para que empatar no
 * cuente como superar: guardar un duplicado de la misma marca no agrega nada.
 */
export function superaLaMarca(peso: number, reps: number, antes: number | null): boolean {
  if (antes === null) return true;
  return unRmDeSerie(peso, reps) > antes + 1e-9;
}

/**
 * ¿Vale la pena preguntar? Con el techo de repeticiones: si ni así llega, no.
 *
 * Es deliberadamente generoso. Preguntar de más cuesta un toque; preguntar de
 * menos cuesta una marca que no se carga nunca.
 */
export function podriaSuperar(peso: number, antes: number | null): boolean {
  return superaLaMarca(peso, REPS_TOPE, antes);
}

/** Lo que va a la tabla de marcas. Una repetición es un 1RM real. */
export function filaDeMarca(s: Sugerencia, reps: number, fecha: string) {
  return { ejercicio: s.ejercicio, peso: Math.round(s.peso * 100) / 100, reps, es_real: reps === 1, fecha };
}

/**
 * LA MISMA PREGUNTA, PERO EN EL MOMENTO: al confirmar la serie que puede ser
 * marca, no al terminar la sesión (18/9, a pedido: "tiene que aparecer al
 * confirmar la serie que hizo la marca"). Al terminar, con el teléfono ya
 * guardado, la pregunta llegaba tarde y lejos de la serie.
 *
 * NO HAY REGLAS NUEVAS: es `marcasParaProponer` con un bloque de una sola
 * serie. Lo que vale al terminar —solo pesos en total, que PUEDA superar la
 * marca, sin marca previa solo los del DOTS— vale igual acá, y escrito una vez.
 */
export function marcaDeSerie({
  ejercicio,
  peso,
  reps,
  carga,
  marcas,
  catalogo,
}: {
  ejercicio: string | null;
  /** El peso de la serie que se acaba de confirmar, en kilos. */
  peso: number | null | undefined;
  /** Las repeticiones de esa serie, si se anotaron. */
  reps?: number | null;
  /** El modo del bloque, si lo trae; si no, el del catálogo. */
  carga?: string;
  marcas: MarcaGuardada[];
  catalogo: Map<string, EjercicioParaMarca>;
}): Sugerencia | null {
  if (!ejercicio || peso === null || peso === undefined) return null;
  const bloque = { ejercicio, series: 1, pesos: [peso], ...(reps ? { reps: [reps] } : {}), ...(carga ? { carga } : {}) };
  return marcasParaProponer({ bloques: [bloque], marcas, catalogo })[0] ?? null;
}

/** Cuánto subió el DOTS con una marca nueva: nada si no se puede calcular o si no subió (un curl no lo mueve). */
export function dotsQueSubio(antes: number | null, despues: number | null): number | null {
  if (despues === null) return null;
  const subio = despues - (antes ?? 0);
  return subio > 0.05 ? subio : null;
}
