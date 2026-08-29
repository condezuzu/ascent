/**
 * EL BLOQUE: qué estás haciendo, cuántas te propusiste, cuántas van.
 *
 * EL PROBLEMA QUE RESUELVE. El contador decía CUÁNTAS series llevabas en toda
 * la sesión y nada más. Eso obliga a llevar de memoria cuántas van de cada
 * ejercicio —"iban tres de sentadilla, ¿o cuatro?"— justo cuando estás
 * transpirado y sin aire. Y para el detector de estancamiento, cuarenta series
 * en la semana no se pueden leer sin saber de qué fueron.
 *
 * NO SON DOS FUNCIONES, ES UNA. Declarás "sentadilla, tres" y la app cuenta
 * hacia eso. El ejercicio y la meta viven en la misma fila y se tocan igual.
 *
 * LAS REGLAS QUE LO MANTIENEN USABLE
 *
 * 1. **Llegar a la meta NO cierra nada solo.** Se llenan los puntos y aparece
 *    "Siguiente". Si hacés cuatro en vez de tres, el cuarto toque dice `4 de 3`
 *    y ya está: la meta es un objetivo, no un límite. Que la app decida por vos
 *    que terminaste es exactamente lo que no queremos.
 *
 * 2. **Funciona sin elegir ejercicio nunca.** La meta anda sola. Un bloque sin
 *    ejercicio no se guarda como bloque —no dice nada— pero sus series SÍ
 *    cuentan, porque el total es `sesiones.series` y ese se lleva aparte. No se
 *    pierde nada por ignorar el chip.
 *
 * 3. **El total NO se deriva de los bloques.** `sesiones.series` es la única
 *    verdad del conteo y se mantiene solo, exactamente como antes de que esto
 *    existiera. Los bloques son una anotación encima. Si algún día divergen, el
 *    total gana — y las rachas, las duraciones y el resumen ni se enteran.
 *
 * LO QUE ESTO NO ES: no es Hevy. No hay pesos, ni repeticiones, ni una lista
 * planificada de antemano. Es intención para los próximos cinco minutos.
 *
 * NO IMPORTA NADA, igual que `reglas.ts` y `llegada.ts`: así `test:db` lo carga
 * con node pelado y prueba las cuentas de verdad.
 */

export type Bloque = { ejercicio: string | null; series: number };

export type EstadoBloques = {
  /** Los que ya se cerraron, en orden. */
  cerrados: Bloque[];
  /** En qué estás. `null` = todavía no elegiste, y está perfecto. */
  ejercicio: string | null;
  /** Cuántas te propusiste en este bloque. */
  meta: number;
  /** Cuántas van EN ESTE BLOQUE. El total de la sesión se lleva aparte. */
  hechas: number;
};

// Dos, tres, cuatro o cinco. Más que eso ya no se elige de una fila de
// píldoras, y menos de dos no es un bloque.
export const METAS = [2, 3, 4, 5] as const;
export const META_POR_OMISION = 3;
// Lo mismo que acota la base en `fijar_bloques`: una sesión con más de cuarenta
// cambios de ejercicio no es una sesión.
export const TOPE_BLOQUES = 40;

export function bloquesVacios(ejercicio: string | null = null, meta = META_POR_OMISION): EstadoBloques {
  return { cerrados: [], ejercicio, meta: metaValida(meta), hechas: 0 };
}

export function metaValida(meta: number): number {
  const n = Math.round(meta);
  return METAS.includes(n as (typeof METAS)[number]) ? n : META_POR_OMISION;
}

/** Una serie más en el bloque actual. NO cierra el bloque al llegar a la meta. */
export function sumar(e: EstadoBloques): EstadoBloques {
  return { ...e, hechas: e.hechas + 1 };
}

/** Corregir de menos. Nunca baja de cero ni toca los bloques ya cerrados. */
export function restar(e: EstadoBloques): EstadoBloques {
  return { ...e, hechas: Math.max(0, e.hechas - 1) };
}

/**
 * Cierra el bloque actual y arranca otro con el MISMO ejercicio y la misma
 * meta: lo más probable después de tres de sentadilla es otras tres.
 *
 * Un bloque en cero no se cierra: tocar "Siguiente" sin haber hecho nada no
 * puede dejar un bloque vacío en el historial.
 */
export function siguiente(e: EstadoBloques): EstadoBloques {
  if (e.hechas === 0) return e;
  return {
    ...e,
    cerrados: [...e.cerrados, { ejercicio: e.ejercicio, series: e.hechas }].slice(-TOPE_BLOQUES),
    hechas: 0,
  };
}

/**
 * Cambiar de ejercicio cierra el bloque anterior: es la señal más clara que
 * hay de que ese tramo terminó, y pedir un toque extra para confirmarlo sería
 * el impuesto que hace que se deje de usar.
 */
export function cambiarEjercicio(e: EstadoBloques, id: string | null): EstadoBloques {
  if (id === e.ejercicio) return e;
  return { ...siguiente(e), ejercicio: id };
}

/**
 * La meta se puede subir o bajar EN CUALQUIER MOMENTO, incluso a mitad del
 * bloque y por debajo de lo que ya hiciste. Es un objetivo, no una validación:
 * negarse a bajarla a 2 cuando llevás 3 sería la app discutiendo con alguien
 * que ya sabe lo que hizo.
 */
export function cambiarMeta(e: EstadoBloques, meta: number): EstadoBloques {
  return { ...e, meta: metaValida(meta) };
}

/**
 * Lo que se manda a `fijar_bloques`: los cerrados más el actual si tiene algo
 * que decir.
 *
 * Los bloques sin ejercicio se caen acá y no en la base. La base también los
 * filtra —es la que no puede confiar en el teléfono— pero mandarlos igual
 * sería mandar ruido a propósito y hacer más difícil leer qué se envió.
 */
export function paraGuardar(e: EstadoBloques): Bloque[] {
  const todos = e.hechas > 0 ? [...e.cerrados, { ejercicio: e.ejercicio, series: e.hechas }] : e.cerrados;
  return todos.filter((b) => b.ejercicio !== null && b.series > 0);
}

/** Si ya se llegó a lo que se había propuesto. */
export function metaCumplida(e: EstadoBloques): boolean {
  return e.hechas >= e.meta;
}
