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
 * LO QUE ESTO NO ES: no es Hevy. No hay repeticiones ni una lista planificada
 * de antemano. Es intención para los próximos cinco minutos.
 *
 * 4. **EL PESO ES DEL BLOQUE, NO DE LA SERIE.** Hay un peso vigente —el que
 *    está escrito al lado del ejercicio— y cada `+` registra la serie con ese
 *    peso. Cuatro series iguales son un número escrito una vez y cuatro toques.
 *    Si nunca se escribe un peso, el estado y lo que se guarda son EXACTAMENTE
 *    los de antes: ni una llave nueva. Esa es la condición del humano ("la app
 *    tiene que funcionar entera sin él, igual que hoy") y tiene su test.
 *
 *    Por qué no se pide en el `+`: es el botón más tocado de la app y se toca
 *    transpirado, con una mano. Si abre un teclado, contar una serie pasa a ser
 *    un trámite, y eso es lo que hace que la gente deje de contar.
 *
 *    Los pesos van SIEMPRE en kilos. La unidad es presentación, igual que el
 *    peso corporal.
 *
 * 5. **CADA BLOQUE DICE QUÉ SIGNIFICA SU NÚMERO** (`carga`, migración 38): en
 *    total, por mancuerna, una mancuerna o lastre. Ver `carga.ts`. Viaja SOLO
 *    con los pesos: un bloque sin pesos no tiene números que interpretar, y la
 *    regla 4 sigue valiendo.
 *
 * Solo importa tipos, igual que `reglas.ts` y `llegada.ts`: así `test:db` lo
 * carga con node pelado y prueba las cuentas de verdad.
 */

import { cargaValida, type Carga } from './carga.ts';

/**
 * `pesos[i]` es el peso de la serie i, en kilos; `null` si esa serie se hizo sin
 * anotar peso. La llave NO EXISTE si ninguna serie tiene peso.
 */
export type Bloque = { ejercicio: string | null; series: number; pesos?: (number | null)[]; carga?: Carga };

export type EstadoBloques = {
  /** Los que ya se cerraron, en orden. */
  cerrados: Bloque[];
  /** En qué estás. `null` = todavía no elegiste, y está perfecto. */
  ejercicio: string | null;
  /** Cuántas te propusiste en este bloque. */
  meta: number;
  /** Cuántas van EN ESTE BLOQUE. El total de la sesión se lleva aparte. */
  hechas: number;
  /** El peso vigente, en kilos: con este se anota la PRÓXIMA serie. Sin llave = sin peso. */
  peso?: number;
  /** El peso de cada serie de ESTE bloque. Misma regla: sin llave si no hay ninguno. */
  pesos?: (number | null)[];
  /**
   * Qué significa el número en ESTE bloque, si se sabe: lo eligió la persona o
   * lo recordaba. Sin llave = el del catálogo, que lo resuelve quien lo muestra
   * y, al guardar, la base.
   */
  carga?: Carga;
};

/** El peso más alto que se acepta, en kilos. Lo mismo acota la base. */
export const PESO_MAXIMO = 999;

/**
 * Un peso que se puede guardar, o `null`.
 *
 * Centésimas y no medios: 61,25 existe (discos de 1,25) y un peso escrito en
 * libras pasado a kilos nunca da redondo. Cero o negativo no es un peso: es no
 * haber anotado.
 */
export function pesoValido(kg: unknown): number | null {
  const n = typeof kg === 'number' ? kg : typeof kg === 'string' ? Number(kg.replace(',', '.')) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(Math.min(PESO_MAXIMO, n) * 100) / 100;
}

/** Los pesos de `n` series: lo que haya, completado con `null`. */
function pesosDe(lista: (number | null)[] | undefined, n: number): (number | null)[] {
  const base = lista ?? [];
  return Array.from({ length: Math.max(0, n) }, (_, i) => pesoValido(base[i]));
}

/**
 * Pone la lista SOLO si dice algo. Una lista de puros `null` es lo mismo que no
 * haber anotado nada, y guardarla rompería la regla 4: el estado de alguien que
 * no anota pesos tiene que ser idéntico al de antes.
 */
function conPesos<T extends object>(obj: T, pesos: (number | null)[]): T & { pesos?: (number | null)[] } {
  const { pesos: _viejo, ...resto } = obj as T & { pesos?: unknown };
  return pesos.some((x) => x !== null) ? { ...(resto as T), pesos } : (resto as T);
}

function sinPeso<T extends { peso?: number }>(obj: T): Omit<T, 'peso'> {
  const { peso: _p, ...resto } = obj;
  return resto;
}

/**
 * Un bloque CERRADO lleva `carga` solo si lleva pesos: sin números no hay
 * nada que interpretar, y guardarla sería una llave nueva para quien no anota
 * pesos (regla 4).
 */
function cerrado(ejercicio: string | null, series: number, pesos: (number | null)[], carga: unknown): Bloque {
  const b = conPesos({ ejercicio, series } as Bloque, pesos);
  const c = cargaValida(carga);
  return b.pesos && c ? { ...b, carga: c } : b;
}

function sinCarga<T extends { carga?: Carga }>(obj: T): Omit<T, 'carga'> {
  const { carga: _c, ...resto } = obj;
  return resto;
}

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

/**
 * Una serie más en el bloque actual, con el peso vigente. NO cierra el bloque
 * al llegar a la meta.
 */
export function sumar(e: EstadoBloques): EstadoBloques {
  const pesos = [...pesosDe(e.pesos, e.hechas), pesoValido(e.peso)];
  return conPesos({ ...e, hechas: e.hechas + 1 }, pesos);
}

/** Corregir de menos. Nunca baja de cero ni toca los bloques ya cerrados. */
export function restar(e: EstadoBloques): EstadoBloques {
  const hechas = Math.max(0, e.hechas - 1);
  return conPesos({ ...e, hechas }, pesosDe(e.pesos, hechas));
}

/**
 * Cambiar el peso vigente. Vale para las series QUE VIENEN: las que ya hiciste
 * se hicieron con el peso que tenían, y se corrigen desde la lista.
 *
 * `null` —o cualquier cosa que no sea un peso— lo borra.
 */
export function cambiarPeso(e: EstadoBloques, kg: unknown): EstadoBloques {
  const v = pesoValido(kg);
  return v === null ? (sinPeso(e) as EstadoBloques) : { ...e, peso: v };
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
  const b = cerrado(e.ejercicio, e.hechas, pesosDe(e.pesos, e.hechas), e.carga);
  // El peso vigente SE QUEDA, y el modo también: el bloque que sigue es del
  // mismo ejercicio, y lo más probable después de tres series con 60 son otras
  // tres con 60, con lo mismo en la mano.
  return conPesos(
    { ...e, cerrados: [...e.cerrados, b].slice(-TOPE_BLOQUES), hechas: 0 },
    []
  );
}

/**
 * Cambiar de ejercicio cierra el bloque anterior: es la señal más clara que
 * hay de que ese tramo terminó, y pedir un toque extra para confirmarlo sería
 * el impuesto que hace que se deje de usar.
 */
export function cambiarEjercicio(e: EstadoBloques, id: string | null): EstadoBloques {
  if (id === e.ejercicio) return e;
  // El peso NO pasa al ejercicio nuevo: los 100 de sentadilla no son un peso
  // de press de banca, y arrastrarlos anotaría series con un número falso. El
  // modo tampoco: las zancadas con mancuernas no dicen nada del press.
  return { ...(sinCarga(sinPeso(siguiente(e))) as EstadoBloques), ejercicio: id };
}

/**
 * Cambiar de ejercicio LLEVÁNDOSE las series que ya iban.
 *
 * Es el otro caso, y es el que faltaba: sumaste tres series y RECIÉN AHÍ te
 * diste cuenta de que el selector decía el ejercicio de antes. Con
 * `cambiarEjercicio` esas tres quedan para siempre en el ejercicio
 * equivocado, y el detector de estancamiento las lee como progreso de algo
 * que no hiciste.
 *
 * No se elige solo cuál de los dos usar: no hay forma de saber desde acá si
 * el que se equivocó fue el dedo o la memoria. Lo pregunta la interfaz, y
 * solo cuando hay algo contado — si el bloque está en cero las dos ramas
 * hacen lo mismo y preguntar sería un toque de más.
 */
export function mudarEjercicio(e: EstadoBloques, id: string | null, cargaQueSeVeia?: Carga): EstadoBloques {
  if (id === e.ejercicio) return e;
  // Acá el peso SÍ se queda, y los de las series también: lo que estaba mal
  // era el nombre del ejercicio, no lo que levantaste.
  //
  // Y EL MODO QUE SE VEÍA SE QUEDA FIJO. Los números se escribieron leyendo
  // "por mancuerna"; si el ejercicio nuevo es de barra, dejar que tome el modo
  // de su catálogo convertiría los 30 por mancuerna en 30 en total sin que
  // nadie lo toque.
  const c = cargaValida(e.carga) ?? cargaValida(cargaQueSeVeia);
  return c ? { ...e, ejercicio: id, carga: c } : { ...e, ejercicio: id };
}

/**
 * Cambiar qué significa el número del bloque en curso. Vale para TODO el
 * bloque, también las series ya hechas: el modo no es algo que cambie entre
 * una serie y la otra, es lo que quiere decir cada número que se escribió.
 */
export function cambiarCarga(e: EstadoBloques, c: unknown): EstadoBloques {
  const v = cargaValida(c);
  if (v === null || v === e.carga) return e;
  return { ...e, carga: v };
}

/**
 * Lo mismo en un bloque ya cerrado ("esas zancadas fueron con barra"). Solo si
 * tiene pesos: sin números no hay nada que corregir.
 */
export function corregirCarga(e: EstadoBloques, indice: number, c: unknown): EstadoBloques {
  if (indice === -1) return cambiarCarga(e, c);
  const b = e.cerrados[indice];
  const v = cargaValida(c);
  if (!b || !b.pesos || v === null || v === b.carga) return e;
  return { ...e, cerrados: e.cerrados.map((x, i) => (i === indice ? { ...x, carga: v } : x)) };
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
  const actual = cerrado(e.ejercicio, e.hechas, pesosDe(e.pesos, e.hechas), e.carga);
  const todos = e.hechas > 0 ? [...e.cerrados, actual] : e.cerrados;
  return todos
    .filter((b) => b.ejercicio !== null && b.series > 0)
    .map((b) => cerrado(b.ejercicio, b.series, pesosDe(b.pesos, b.series), b.carga));
}

/**
 * SEMBRAR EL BLOQUE al arrancar la sesión: el último ejercicio que anotaste y
 * la última meta que usaste.
 *
 * DEVUELVE EL ESTADO INTACTO SI YA HAY ALGO CONTADO, y esa es toda la razón de
 * que esta función exista en vez de un `setBloques(bloquesVacios(...))`.
 *
 * El bug: la semilla se pide a la base DESPUÉS de arrancar la sesión y sin
 * bloquear —que el chip tarde un segundo no puede demorar el cronómetro—, así
 * que en un gimnasio con mala señal la respuesta llegaba cuando ya habías
 * tocado el + dos veces. Y al llegar pisaba el bloque con uno vacío: la cuenta
 * del bloque volvía a cero mientras el total seguía subiendo, y los dos
 * números de la pantalla se contradecían.
 *
 * Sembrar es una conveniencia. Nunca puede pisar algo que ya hiciste.
 */
export function sembrar(
  actual: EstadoBloques,
  ejercicio: string | null,
  meta?: number
): EstadoBloques {
  if (actual.hechas > 0 || actual.cerrados.length > 0) return actual;
  return bloquesVacios(ejercicio, meta ?? actual.meta);
}

/**
 * CORREGIR HACIA ATRÁS: la lista de lo hecho, y cómo tocarla.
 *
 * El `−` solo arregla el bloque en curso. Si te equivocaste hace veinte
 * minutos —contaste una serie de más en sentadilla y ya pasaste a otra cosa—
 * no había ninguna forma de volver. Y el número queda mal para siempre.
 *
 * Las dos funciones devuelven TAMBIÉN cuánto cambió el total, porque
 * `sesiones.series` se lleva aparte a propósito y quien llame tiene que poder
 * ajustarlo sin recalcularlo desde los bloques. Si el total se dedujera de los
 * bloques, ignorar el chip te rompería la racha — que es la regla 3 de arriba.
 */
export type Correccion = { estado: EstadoBloques; cambioEnTotal: number };

/** Sacar un bloque entero de la lista. */
/**
 * Corregir el peso de UNA serie ya hecha, en un bloque cerrado o en el actual
 * (`indice` = -1). La serie que salió con otro peso se arregla sin tocar
 * cuántas fueron.
 */
export function corregirPeso(
  e: EstadoBloques,
  indice: number,
  serie: number,
  kg: unknown
): EstadoBloques {
  if (indice === -1) {
    if (serie < 0 || serie >= e.hechas) return e;
    const pesos = pesosDe(e.pesos, e.hechas);
    pesos[serie] = pesoValido(kg);
    return conPesos(e, pesos);
  }
  const b = e.cerrados[indice];
  if (!b || serie < 0 || serie >= b.series) return e;
  const pesos = pesosDe(b.pesos, b.series);
  pesos[serie] = pesoValido(kg);
  return {
    ...e,
    cerrados: e.cerrados.map((x, i) => (i === indice ? cerrado(x.ejercicio, x.series, pesos, x.carga) : x)),
  };
}

export function quitarBloque(e: EstadoBloques, indice: number): Correccion {
  const b = e.cerrados[indice];
  if (!b) return { estado: e, cambioEnTotal: 0 };
  return {
    estado: { ...e, cerrados: e.cerrados.filter((_, i) => i !== indice) },
    cambioEnTotal: -b.series,
  };
}

/**
 * Subir o bajar de a una las series de un bloque ya cerrado.
 *
 * Llegar a cero NO borra el bloque: sacarlo es otra decisión y tiene su propio
 * botón. Que la app lo haga desaparecer sola en el último toque es la clase de
 * cosa que hace dudar de si se tocó bien.
 */
export function corregirBloque(e: EstadoBloques, indice: number, delta: number): Correccion {
  const b = e.cerrados[indice];
  if (!b) return { estado: e, cambioEnTotal: 0 };
  const nuevas = Math.max(0, Math.min(999, b.series + delta));
  // Una serie que se agrega a mano repite el último peso del bloque: es lo más
  // probable, y si no, se corrige con un toque. Una que se saca, se lleva el
  // último.
  const previos = pesosDe(b.pesos, b.series);
  const ultimo = [...previos].reverse().find((x) => x !== null) ?? null;
  const pesos = Array.from({ length: nuevas }, (_, i) => (i < previos.length ? previos[i] : ultimo));
  return {
    estado: {
      ...e,
      cerrados: e.cerrados.map((x, i) => (i === indice ? cerrado(x.ejercicio, nuevas, pesos, x.carga) : x)),
    },
    cambioEnTotal: nuevas - b.series,
  };
}

/** Si ya se llegó a lo que se había propuesto. */
export function metaCumplida(e: EstadoBloques): boolean {
  return e.hechas >= e.meta;
}
