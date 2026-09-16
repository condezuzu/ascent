/**
 * QUÉ SIGNIFICA EL NÚMERO DEL PESO.
 *
 * "60" no dice nada solo. Con barra son 60 en total; con mancuernas la gente
 * dice "las de 30" y levanta 60. LA REGLA: nunca se piden discos ni se hace
 * sumar a nadie. Se escribe el número que está impreso en lo que agarraste y la
 * etiqueta dice cuál es.
 *
 *   total   la barra con los discos, o el número de la máquina.   × 1
 *   par     dos mancuernas o dos poleas: el peso de UNA.          × 2
 *   una     un lado por vez: un brazo, una pierna, una mancuerna.  × 1
 *   lastre  lo que va encima del peso corporal.                    × 1
 *
 * EL LASTRE NO SUMA EL PESO CORPORAL (decisión del humano): el peso corporal
 * cambia con el tiempo y ensuciaría la comparación hacia atrás, y "hice
 * dominadas con 20 kg" es lo que uno dice y lo que quiere ver.
 *
 * CADA BLOQUE GUARDA SU MODO. El catálogo decide el modo por omisión de los
 * bloques que VIENEN; el de un bloque ya hecho queda escrito en el bloque.
 * Reclasificar un ejercicio no puede duplicar los kilos de toda su historia —
 * es el mismo problema que los descansos retroactivos y la misma solución.
 *
 * NO IMPORTA NADA, igual que el resto de `nucleo`.
 */

export type Carga = 'total' | 'par' | 'una' | 'lastre';

/** En el orden en que se ofrecen al cambiarla. */
export const CARGAS: readonly Carga[] = ['total', 'par', 'una', 'lastre'];

/**
 * Lo que se ofrece en la pregunta de la primera vez. El lastre no: los
 * ejercicios que se preguntan son los que el nombre no dice con qué equipo
 * se hacen, y ninguno es de peso corporal.
 */
export const OPCIONES_DE_LA_PREGUNTA: readonly Carga[] = ['par', 'total', 'una'];

/**
 * Los `par` que no son mancuernas sino dos poleas. Cambia solo la etiqueta
 * ("de cada lado" y no "por mancuerna"): la cuenta es la misma.
 */
export const PAR_EN_POLEA: readonly string[] = ['cruce_polea_alta', 'cruce_polea_baja'];

export function cargaValida(x: unknown): Carga | null {
  return typeof x === 'string' && (CARGAS as readonly string[]).includes(x) ? (x as Carga) : null;
}

/** Por cuánto se multiplica el número escrito para saber lo que se movió. */
export function factorDeCarga(c: Carga): 1 | 2 {
  return c === 'par' ? 2 : 1;
}

/**
 * Lo que se movió en una serie: "30 por mancuerna" son 60. Es la cuenta del
 * volumen y de la línea "60 kg en total" debajo del campo.
 */
export function kilosMovidos(peso: number, c: Carga): number {
  return Math.round(peso * factorDeCarga(c) * 100) / 100;
}

/** La línea del total aparece solo cuando el número escrito no es el total. */
export function muestraTotal(c: Carga): boolean {
  return factorDeCarga(c) !== 1;
}

/**
 * EL MODO DEL BLOQUE: el que se eligió, y si no, el del catálogo, y si el
 * catálogo todavía no lo trae (base sin la migración 38), `total`, que es lo
 * que significaba el número antes de que esto existiera.
 */
export function cargaVigente(elegida: unknown, delCatalogo: unknown): Carga {
  return cargaValida(elegida) ?? cargaValida(delCatalogo) ?? 'total';
}

/**
 * SI HAY QUE PREGUNTAR CON QUÉ SE HACE.
 *
 * Solo para los ejercicios cuyo nombre no lo dice, solo si todavía no se sabe
 * —ni en este bloque, ni recordado— y solo cuando ya se le preguntó a la base:
 * si no, a quien lo contestó en otro teléfono se le mostraría la pregunta un
 * segundo, hasta que llega la respuesta.
 */
export function hayQuePreguntar({
  ambigua,
  cargaDelBloque,
  yaSeConsulto,
}: {
  ambigua: boolean | undefined;
  cargaDelBloque: unknown;
  yaSeConsulto: boolean;
}): boolean {
  return ambigua === true && cargaValida(cargaDelBloque) === null && yaSeConsulto;
}

/** Qué palabra va al lado del número. Las palabras viven en `textos.ts`. */
export function claveDeEtiqueta(c: Carga, ejercicio: string | null): Carga | 'parPolea' {
  return c === 'par' && ejercicio !== null && PAR_EN_POLEA.includes(ejercicio) ? 'parPolea' : c;
}

/**
 * LOS PESOS DEL RESUMEN, agrupados por modo y en orden: "60, 60 kg · 30, 30
 * kg por mancuerna". Casi siempre es un solo grupo; son dos cuando el mismo
 * ejercicio se hizo de dos formas el mismo día, y mezclarlos en una lista
 * haría que 30 y 60 parezcan lo mismo.
 */
export function gruposDePesos(
  pesos: (number | null)[],
  cargas: readonly unknown[] | undefined
): { carga: Carga; pesos: (number | null)[] }[] {
  const grupos: { carga: Carga; pesos: (number | null)[] }[] = [];
  pesos.forEach((p, i) => {
    const c = cargaValida(cargas?.[i]) ?? 'total';
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.carga === c) ultimo.pesos.push(p);
    else grupos.push({ carga: c, pesos: [p] });
  });
  return grupos;
}
