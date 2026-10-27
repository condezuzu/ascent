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
 * LO QUE ESTO NO ES: no es Hevy. No hay una lista planificada de antemano, y
 * las repeticiones solo con «Registrar repeticiones» (21/10). Es intención para
 * los próximos cinco minutos.
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

import { cargaValida, llevaNumero, type Carga } from './carga.ts';

/**
 * `pesos[i]` es el peso de la serie i, en kilos; `null` si esa serie se hizo sin
 * anotar peso. La llave NO EXISTE si ninguna serie tiene peso.
 */
/**
 * `id` es una IDENTIDAD EN MEMORIA del bloque cerrado, no un dato: nace al
 * cerrarse el bloque y sirve para tocarlo por identidad y no por índice. El
 * índice se corre cuando se quita un bloque, y quitar por índice —con la lista
 * cambiando debajo entre "✕" y "Sí"— borra el bloque equivocado (bug A6). No
 * viaja a la base (`paraGuardar` lo saca): el bloque tampoco persiste con id, y
 * al volver de la base se le asigna uno nuevo (`unirConGuardados`).
 */
/**
 * `minutos` (14/10): el cardio se mide en tiempo, no en series y peso. Es el
 * total del bloque, solo de un ejercicio que se mide en minutos. Va APARTE de
 * los pesos a propósito: si viajara en `pesos`, los minutos se leerían como
 * kilos en el volumen, las marcas y la conversión a libras.
 */
/**
 * `reps` (21/10): las repeticiones de cada serie, con «Registrar repeticiones» prendido
 * (migración 94). Misma regla que los pesos: sin llave si ninguna serie las tiene.
 */
/** `distancia` (21/10): los kilómetros del cardio, como `minutos` (migración 95). Sin llave si no se anotó. */
export type Bloque = { id?: string; ejercicio: string | null; series: number; pesos?: (number | null)[]; carga?: Carga; minutos?: number; reps?: (number | null)[]; distancia?: number };

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
  /** Los minutos de ESTE bloque, si el ejercicio se mide en tiempo. Sin llave = sin minutos. */
  minutos?: number;
  /** Los kilómetros de ESTE bloque de cardio. Sin llave = sin distancia. */
  distancia?: number;
  /** El peso de cada serie de ESTE bloque. Misma regla: sin llave si no hay ninguno. */
  pesos?: (number | null)[];
  /** Las repeticiones de cada serie de ESTE bloque. Misma regla. */
  reps?: (number | null)[];
  /** Las repeticiones tecleadas para la PRÓXIMA serie: el + las anota y el cuadradito queda vacío. */
  repsAhora?: number;
  /**
   * Qué significa el número en ESTE bloque, si se sabe: lo eligió la persona o
   * lo recordaba. Sin llave = el del catálogo, que lo resuelve quien lo muestra
   * y, al guardar, la base.
   */
  carga?: Carga;
  /**
   * El peso vigente lo PROPUSO la app —el último que usaste en ese modo— y la
   * persona todavía no lo tocó. Solo existe junto a `peso` y solo en `true`:
   * sin llave = lo escribió la persona, que es lo que nunca se pisa. Las cachés
   * de antes de esto traen pesos sin marca y caen del lado seguro.
   */
  pesoPropuesto?: true;
  /**
   * El ejercicio lo puso la app al arrancar (`sembrar`) y nadie lo eligió ni contó:
   * los bloques que lleguen de la base lo reemplazan. Uno elegido, no (cacería del 15/10).
   */
  sembrado?: true;
  /**
   * EL CRONÓMETRO DEL CARDIO (15/10): cuándo arrancó la vuelta en curso, en ms
   * del reloj del teléfono. Sin llave = no corre. No se sube a la base (no está
   * en `paraGuardar`): lo que se guarda son los minutos al cerrar la vuelta.
   */
  cardioDesde?: number;
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

/** Las repeticiones que se aceptan. Lo mismo acota la base (`reps_limpias`). */
export const REPS_MAXIMAS = 999;

/** Un número de repeticiones que se puede guardar, o `null`: entero, de 1 a 999. */
export function repsValidas(n: unknown): number | null {
  const v = typeof n === 'number' ? n : typeof n === 'string' && n.trim() !== '' ? Number(n) : NaN;
  return Number.isInteger(v) && v >= 1 && v <= REPS_MAXIMAS ? v : null;
}

/** Las repeticiones de `n` series, como `pesosDe`. */
export function repsDe(lista: unknown, n: number): (number | null)[] {
  const base = Array.isArray(lista) ? lista : [];
  return Array.from({ length: Math.max(0, n) }, (_, i) => repsValidas(base[i]));
}

/** Pone la lista SOLO si dice algo, como `conPesos`: quien no anota repeticiones no ve una llave nueva. */
function conReps<T extends object>(obj: T, reps: (number | null)[]): T & { reps?: (number | null)[] } {
  const { reps: _viejo, ...resto } = obj as T & { reps?: unknown };
  return reps.some((x) => x !== null) ? { ...(resto as T), reps } : (resto as T);
}

function sinRepsAhora<T extends { repsAhora?: number }>(obj: T): Omit<T, 'repsAhora'> {
  const { repsAhora: _r, ...resto } = obj;
  return resto;
}

/** Las repeticiones de la próxima serie. Sin un número válido, el cuadradito queda vacío. */
export function cambiarReps(e: EstadoBloques, n: unknown): EstadoBloques {
  const v = repsValidas(n);
  if (v === (e.repsAhora ?? null)) return e;
  return v === null ? (sinRepsAhora(e) as EstadoBloques) : { ...e, repsAhora: v };
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

function sinPeso<T extends { peso?: number; pesoPropuesto?: true }>(obj: T): Omit<T, 'peso' | 'pesoPropuesto'> {
  const { peso: _p, pesoPropuesto: _m, ...resto } = obj;
  return resto;
}

function sinMarca<T extends { pesoPropuesto?: true }>(obj: T): Omit<T, 'pesoPropuesto'> {
  const { pesoPropuesto: _m, ...resto } = obj;
  return resto;
}

/**
 * Un bloque CERRADO lleva `carga` solo si lleva pesos: sin números no hay
 * nada que interpretar, y guardarla sería una llave nueva para quien no anota
 * pesos (regla 4).
 */
/**
 * UN ID DE BLOQUE, en memoria y para este proceso. No se guarda ni se compara
 * entre aparatos: solo distingue un bloque cerrado de sus vecinos mientras la
 * sesión está viva, para poder quitarlo por identidad y no por índice.
 */
let contadorDeBloque = 0;
function nuevoIdBloque(): string {
  contadorDeBloque += 1;
  return `b${Date.now().toString(36)}-${contadorDeBloque.toString(36)}`;
}

// `id` se agrega SOLO si se pasa: los que nacen (al cerrarse) o vuelven de la
// base (al hidratarse) llevan uno; `paraGuardar` no lo pasa, así lo que viaja a
// la base queda igual que siempre (regla 4: sin llaves de más).
function cerrado(ejercicio: string | null, series: number, pesos: (number | null)[], carga: unknown, id?: string, minutos?: unknown, reps?: unknown, distancia?: unknown): Bloque {
  const b = conPesos({ ejercicio, series } as Bloque, pesos);
  const c = cargaValida(carga);
  const conCarga = b.pesos && c ? { ...b, carga: c } : b;
  const m = minutosValidos(minutos);
  const conMinutos = conReps(m !== null ? { ...conCarga, minutos: m } : conCarga, repsDe(reps, series));
  const km = distanciaValida(distancia);
  const conKm = km !== null ? { ...conMinutos, distancia: km } : conMinutos;
  return id ? { ...conKm, id } : conKm;
}

/** Los kilómetros que se aceptan: más de 0 y hasta 500, en centésimas. Lo mismo acota la base. */
export const DISTANCIA_MAXIMA = 500;
export function distanciaValida(km: unknown): number | null {
  const n = typeof km === 'number' ? km : typeof km === 'string' && km.trim() !== '' ? Number(km.replace(',', '.')) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(DISTANCIA_MAXIMA, Math.round(n * 100) / 100) : null;
}

/** La distancia del bloque en curso. Sin un número válido, se saca. */
export function cambiarDistancia(e: EstadoBloques, km: unknown): EstadoBloques {
  const v = distanciaValida(km);
  if (v === (e.distancia ?? null)) return e;
  if (v === null) {
    const { distancia: _d, ...resto } = e;
    return resto;
  }
  return { ...e, distancia: v };
}

function sinDistancia<T extends { distancia?: number }>(obj: T): Omit<T, 'distancia'> {
  const { distancia: _d, ...resto } = obj;
  return resto;
}

/** Minutos entre 1 y 600, enteros; cualquier otra cosa es "sin minutos". Los mismos topes que la base. */
export const MINUTOS_MAXIMOS = 600;
export function minutosValidos(m: unknown): number | null {
  return typeof m === 'number' && Number.isFinite(m) && m >= 1 ? Math.min(MINUTOS_MAXIMOS, Math.round(m)) : null;
}

/** Los minutos del bloque en curso. Sin un número válido, se sacan. */
export function cambiarMinutos(e: EstadoBloques, m: unknown): EstadoBloques {
  const v = minutosValidos(m);
  if (v === (e.minutos ?? null)) return e;
  if (v === null) {
    const { minutos: _m, ...resto } = e;
    return resto;
  }
  return { ...e, minutos: v };
}

function sinMinutos<T extends { minutos?: number }>(obj: T): Omit<T, 'minutos'> {
  const { minutos: _m, ...resto } = obj;
  return resto;
}

function sinCardio<T extends { cardioDesde?: number }>(obj: T): Omit<T, 'cardioDesde'> {
  const { cardioDesde: _c, ...resto } = obj;
  return resto;
}

/** Menos que esto y la vuelta se dejó sin querer (la cinta tocada por error). */
export const VUELTA_MINIMA_MS = 60_000;

/** El cronómetro se apaga sin anotar nada: la vuelta no llegó a un minuto. */
export function descartarCardio(e: EstadoBloques): EstadoBloques {
  return e.cardioDesde === undefined ? e : (sinCardio(e) as EstadoBloques);
}

/** Arranca el cronómetro del cardio. Si ya corre, lo deja como está. */
export function arrancarCardio(e: EstadoBloques, ahora: number): EstadoBloques {
  if (e.cardioDesde !== undefined) return e;
  return { ...e, cardioDesde: ahora };
}

/**
 * CIERRA LA VUELTA DE CARDIO: lo que corrió el cronómetro —al menos un minuto—
 * se suma a los minutos del bloque, y se apaga. La primera vuelta reemplaza los
 * minutos que hubiera (los de arranque, que nadie corrió).
 */
export function cerrarVueltaDeCardio(e: EstadoBloques, ahora: number): EstadoBloques {
  if (e.cardioDesde === undefined) return e;
  const corrio = Math.max(1, Math.round((ahora - e.cardioDesde) / 60000));
  const antes = e.hechas > 0 ? (e.minutos ?? 0) : 0;
  return { ...sinCardio(e), minutos: Math.min(MINUTOS_MAXIMOS, antes + corrio) };
}

function sinCarga<T extends { carga?: Carga }>(obj: T): Omit<T, 'carga'> {
  const { carga: _c, ...resto } = obj;
  return resto;
}

// Las que se eligen de la fila de píldoras: dos, tres, cuatro o cinco.
export const METAS = [2, 3, 4, 5] as const;
// Las que se ACEPTAN (15/10): la que diga la rutina, como las series de la rutina
// (`MAX_SERIES`). Seis series de un básico es de lo más común; recortarlas a cinco
// era un límite de la fila de píldoras, no una decisión.
export const META_MAXIMA = 99;
export const META_POR_OMISION = 3;
// Lo mismo que acota la base en `fijar_bloques`: una sesión con más de cuarenta
// cambios de ejercicio no es una sesión.
export const TOPE_BLOQUES = 40;

export function bloquesVacios(ejercicio: string | null = null, meta = META_POR_OMISION): EstadoBloques {
  return { cerrados: [], ejercicio, meta: metaValida(meta), hechas: 0 };
}

export function metaValida(meta: number): number {
  const n = Math.round(meta);
  return Number.isFinite(n) && n >= 1 && n <= META_MAXIMA ? n : META_POR_OMISION;
}

/** Las series escritas a mano (26/10, el «+» de las píldoras): un entero de 1 a 99, o `null`. */
export function metaAMano(texto: string): number | null {
  const t = texto.trim();
  if (!/^\d{1,2}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= META_MAXIMA ? n : null;
}

/** Las píldoras a mostrar: las de siempre, y la meta de ahora si no es una de ellas. */
export function pildorasDeMeta(meta: number): number[] {
  return (METAS as readonly number[]).includes(meta) ? [...METAS] : [...METAS, meta].sort((a, b) => a - b);
}

/**
 * Una serie más en el bloque actual, con el peso vigente. NO cierra el bloque
 * al llegar a la meta.
 */
export function sumar(e: EstadoBloques): EstadoBloques {
  // Con peso corporal la serie va SIN número. El peso vigente puede seguir en el
  // bloque —lo escrito a mano no se pisa al cambiar de modo— y vuelve a valer si
  // se pasa a otro modo, pero mientras tanto no se anota.
  const pesos = [...pesosDe(e.pesos, e.hechas), llevaNumero(e.carga) ? pesoValido(e.peso) : null];
  // Las repeticiones tecleadas son de ESTA serie: se anotan y el cuadradito queda vacío.
  const reps = [...repsDe(e.reps, e.hechas), repsValidas(e.repsAhora)];
  // Contar una serie con el peso propuesto lo CONFIRMA: deja de ser propuesto.
  return conReps(conPesos({ ...(sinRepsAhora(sinMarca(e)) as EstadoBloques), hechas: e.hechas + 1 }, pesos), reps);
}

/** Corregir de menos. Nunca baja de cero ni toca los bloques ya cerrados. */
export function restar(e: EstadoBloques): EstadoBloques {
  const hechas = Math.max(0, e.hechas - 1);
  return conReps(conPesos({ ...e, hechas }, pesosDe(e.pesos, hechas)), repsDe(e.reps, hechas));
}

/**
 * Cambiar el peso vigente. Vale para las series QUE VIENEN: las que ya hiciste
 * se hicieron con el peso que tenían, y se corrigen desde la lista.
 *
 * `null` —o cualquier cosa que no sea un peso— lo borra.
 */
export function cambiarPeso(e: EstadoBloques, kg: unknown): EstadoBloques {
  const v = pesoValido(kg);
  // Lo escribió la persona: la marca de "propuesto" se va, aunque el número sea
  // el mismo que la app había puesto.
  return v === null ? (sinPeso(e) as EstadoBloques) : { ...sinMarca(e), peso: v };
}

/**
 * PROPONER un peso: el último que se usó en ese modo. Es una conveniencia y
 * NUNCA pisa lo que escribió la persona —perder lo escrito es peor que proponer
 * mal—: solo entra si no hay peso o si el que hay también era una propuesta.
 *
 * `null` —no hay nada que proponer— saca la propuesta anterior: dejar los 50
 * de la máquina debajo de la etiqueta "por mancuerna" es proponer el doble.
 */
export function proponerPeso(e: EstadoBloques, kg: unknown): EstadoBloques {
  if (e.peso !== undefined && !e.pesoPropuesto) return e;
  const v = pesoValido(kg);
  if (v === null) return e.peso === undefined ? e : (sinPeso(e) as EstadoBloques);
  if (v === e.peso && e.pesoPropuesto) return e;
  return { ...e, peso: v, pesoPropuesto: true };
}

/**
 * QUÉ PASA CON EL PESO AL CAMBIAR DE MODO. `recordado` es el último peso que se
 * usó con este ejercicio EN EL MODO NUEVO (`null` si no hay).
 *
 * Con series ya hechas no se toca nada: ahí cambiar el modo es "me equivoqué
 * de etiqueta", no "empiezo de nuevo", y el peso es el que se está usando. Con
 * el bloque vacío se propone el del modo nuevo, con la regla de `proponerPeso`.
 */
export function pesoAlCambiarDeModo(e: EstadoBloques, recordado: number | null): EstadoBloques {
  if (e.hechas > 0) return e;
  return proponerPeso(e, recordado);
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
  // NACE con id: es un bloque cerrado nuevo, y desde acá se lo toca por identidad.
  const b = cerrado(e.ejercicio, e.hechas, pesosDe(e.pesos, e.hechas), e.carga, nuevoIdBloque(), e.minutos, e.reps, e.distancia);
  // El peso vigente SE QUEDA, y el modo también: el bloque que sigue es del
  // mismo ejercicio, y lo más probable después de tres series con 60 son otras
  // tres con 60, con lo mismo en la mano.
  // Un cronómetro de cardio no pasa al bloque que sigue: esa vuelta ya se cerró.
  return conReps(
    // La distancia es de esa vuelta: el bloque que sigue arranca sin.
    conPesos({ ...(sinDistancia(sinRepsAhora(sinCardio(e))) as EstadoBloques), cerrados: [...e.cerrados, b].slice(-TOPE_BLOQUES), hechas: 0 }, []),
    []
  );
}

/**
 * "TERMINAR SERIE": cerrar el bloque y volver a elegir ejercicio (28/9).
 *
 * Cierra el bloque actual —como `siguiente`— PERO deja el siguiente en blanco:
 * sin ejercicio, sin peso y sin modo. Antes "terminar serie" arrancaba otro
 * bloque con el MISMO ejercicio, y había que cambiarlo a mano cada vez, que se
 * volvía tosco: al terminar un ejercicio, lo normal es pasar a otro.
 *
 * No usa `cambiarEjercicio(e, null)` porque ese no cierra nada cuando el
 * ejercicio ya era null ("Cualquier cosa"): ahí no habría cambio de ejercicio,
 * pero el bloque igual hay que cerrarlo. Un bloque en cero no se cierra, igual
 * que en `siguiente`.
 */
export function terminarBloque(e: EstadoBloques): EstadoBloques {
  const cerradoB = siguiente(e);
  if (cerradoB === e) return e; // nada hecho: no se cierra un bloque vacío
  return { ...(sinDistancia(sinCardio(sinMinutos(sinCarga(sinPeso(cerradoB))))) as EstadoBloques), ejercicio: null };
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
  // Elegido por la persona: ya no es lo sembrado.
  const { sembrado: _s, ...elegido } = sinDistancia(sinCardio(sinMinutos(sinCarga(sinPeso(siguiente(e)))))) as EstadoBloques;
  return { ...elegido, ejercicio: id };
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
  const actual = cerrado(e.ejercicio, e.hechas, pesosDe(e.pesos, e.hechas), e.carga, undefined, e.minutos, e.reps, e.distancia);
  const todos = e.hechas > 0 ? [...e.cerrados, actual] : e.cerrados;
  return todos
    .filter((b) => b.ejercicio !== null && b.series > 0)
    .map((b) => cerrado(b.ejercicio, b.series, pesosDe(b.pesos, b.series), b.carga, undefined, b.minutos, b.reps, b.distancia))
    // Por la misma punta que recorta el teléfono (cacería del 15/10): la base se queda
    // con los primeros 40, y en un circuito largo el bloque en curso no entraba nunca.
    .slice(-TOPE_BLOQUES);
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
  // Ni uno ya ELEGIDO (cacería del 15/10): con señal lenta la semilla llegaba
  // después de que la persona eligió la cinta, y se la pisaba con cronómetro y todo.
  if (actual.hechas > 0 || actual.cerrados.length > 0 || actual.ejercicio !== null) return actual;
  const b = bloquesVacios(ejercicio, meta ?? actual.meta);
  return ejercicio ? { ...b, sembrado: true } : b;
}

/**
 * LOS BLOQUES QUE GUARDÓ LA BASE, de vuelta en el teléfono (19/9).
 *
 * Los bloques viven en la caché del teléfono y la base solo tiene la lista
 * guardada (`sesiones.bloques`, lo de `paraGuardar`). Cuando la sesión se abre
 * desde un lugar SIN esa caché —Safari en vez de la app instalada, que en
 * iPhone no comparten nada; la caché borrada; otro teléfono— la pantalla
 * arrancaba con los bloques vacíos: "0 de 3 · 1 en total", con la serie en la
 * base. Y el primer `+` de ahí mandaba esa lista vacía y BORRABA de la base
 * los bloques de antes, con su ejercicio y sus pesos. Pasó en el gimnasio.
 *
 * Con la caché vacía, el ÚLTIMO bloque guardado vuelve a ser el en curso, con
 * su peso: es lo que estabas haciendo, y la próxima serie va ahí. Si ya había
 * algo contado acá —toques mientras la base no contestaba— lo guardado va
 * ANTES, como cerrado: nunca se pisa lo que se hizo en ninguno de los dos
 * lados. Quien llama no manda la lista a la base mientras no la recuperó; si
 * no, lo "guardado" ya incluiría esos toques y se contarían dos veces.
 */
export function unirConGuardados(guardados: unknown, actual: EstadoBloques): EstadoBloques {
  const lista = (Array.isArray(guardados) ? guardados : [])
    .filter(
      (b): b is Bloque =>
        !!b &&
        typeof b === 'object' &&
        typeof (b as Bloque).ejercicio === 'string' &&
        Number.isInteger((b as Bloque).series) &&
        (b as Bloque).series > 0
    )
    // Vuelven de la base SIN id (nunca viajó): se les asigna uno nuevo acá, para
    // que se los pueda quitar por identidad como a cualquier otro.
    .map((b) => cerrado(b.ejercicio, Math.min(999, b.series), pesosDe(b.pesos, b.series), b.carga, b.id ?? nuevoIdBloque(), b.minutos, b.reps, b.distancia));
  if (lista.length === 0) return actual;
  // Un ejercicio ELEGIDO, aunque sin series, también es de acá (cacería del 15/10):
  // lo guardado entra antes, como cerrados, y el elegido sigue en curso.
  if (actual.hechas > 0 || actual.cerrados.length > 0 || (actual.ejercicio !== null && !actual.sembrado)) {
    return { ...actual, cerrados: [...lista, ...actual.cerrados].slice(-TOPE_BLOQUES) };
  }
  const ultimo = lista[lista.length - 1];
  const pesos = pesosDe(ultimo.pesos, ultimo.series);
  const vigente = [...pesos].reverse().find((x) => x !== null);
  const enCurso = conReps(
    conPesos({ cerrados: lista.slice(0, -1), ejercicio: ultimo.ejercicio, meta: actual.meta, hechas: ultimo.series } as EstadoBloques, pesos),
    repsDe(ultimo.reps, ultimo.series)
  );
  const conPeso = vigente !== undefined && vigente !== null ? { ...enCurso, peso: vigente } : enCurso;
  const conMinutos0 = ultimo.minutos !== undefined ? { ...conPeso, minutos: ultimo.minutos } : conPeso;
  const conMinutos = ultimo.distancia !== undefined ? { ...conMinutos0, distancia: ultimo.distancia } : conMinutos0;
  return ultimo.carga ? { ...conMinutos, carga: ultimo.carga } : conMinutos;
}

/** Si el estado todavía no tiene nada contado (puede tener ejercicio y peso sembrados). */
export function sinNadaContado(e: EstadoBloques): boolean {
  return e.hechas === 0 && e.cerrados.length === 0;
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
    cerrados: e.cerrados.map((x, i) => (i === indice ? cerrado(x.ejercicio, x.series, pesos, x.carga, x.id, x.minutos, x.reps, x.distancia) : x)),
  };
}

/**
 * "ME EQUIVOQUÉ DE EJERCICIO" EN UN BLOQUE YA CERRADO (18/9).
 *
 * `mudarEjercicio` lo resolvía solo para el bloque en curso: la pregunta "¿de
 * cuál eran?" sale al elegir otro ejercicio con series contadas. Pero el error
 * se descubre casi siempre DESPUÉS —al mirar la lista de lo hecho, o al pasar
 * al siguiente—, y ahí el bloque ya está cerrado. Pasó en el gimnasio: press de
 * banca anotado, era press inclinado, y no había forma de arreglarlo.
 *
 * Las series, sus pesos y el modo se quedan: lo que estaba mal era el nombre,
 * no lo que se levantó. El modo que se veía queda FIJO, por la misma razón que
 * en `mudarEjercicio`: los números se escribieron leyendo esa etiqueta.
 *
 * No se puede pasar a "sin ejercicio": un bloque cerrado sin ejercicio no se
 * guarda, y eso sería borrar la anotación por la puerta de atrás. Sacarlo es
 * otra decisión y tiene su botón. `indice` -1 es el bloque en curso.
 */
export function corregirEjercicio(
  e: EstadoBloques,
  indice: number,
  id: string,
  cargaQueSeVeia?: Carga
): EstadoBloques {
  if (indice === -1) return mudarEjercicio(e, id, cargaQueSeVeia);
  const b = e.cerrados[indice];
  if (!b || !id || id === b.ejercicio) return e;
  const carga = cargaValida(b.carga) ?? cargaValida(cargaQueSeVeia);
  return {
    ...e,
    cerrados: e.cerrados.map((x, i) => (i === indice ? cerrado(id, x.series, pesosDe(x.pesos, x.series), carga, x.id, x.minutos, x.reps, x.distancia) : x)),
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
  // Salvo con peso corporal, donde la serie va sin número (ver `sumar`).
  const ultimo = llevaNumero(b.carga) ? ([...previos].reverse().find((x) => x !== null) ?? null) : null;
  const pesos = Array.from({ length: nuevas }, (_, i) => (i < previos.length ? previos[i] : ultimo));
  return {
    estado: {
      ...e,
      // Una serie agregada a mano va sin repeticiones: no hay de dónde saberlas.
      cerrados: e.cerrados.map((x, i) => (i === indice ? cerrado(x.ejercicio, nuevas, pesos, x.carga, x.id, x.minutos, x.reps, x.distancia) : x)),
    },
    cambioEnTotal: nuevas - b.series,
  };
}

/** Si ya se llegó a lo que se había propuesto. */
export function metaCumplida(e: EstadoBloques): boolean {
  return e.hechas >= e.meta;
}

/** Lo que dice la pantalla bloqueada durante el descanso. `serie` 0 = nada que decir. */
export type HechoAntesDelDescanso = { ejercicio: string | null; serie: number; meta: number };

/**
 * LA SERIE QUE SE ACABA DE HACER, para la cuenta de la pantalla bloqueada.
 *
 * Sale del estado que el descanso VE al arrancar, y no de un efecto de la
 * pantalla: el número se anotaba aparte con un "más uno" que suponía que el
 * descanso arrancaba antes de sumar. El orden se invirtió y nadie lo notó: una
 * semana diciendo "serie 4 de 3" (1/10). Quien arranca el descanso le pasa el
 * estado YA SUMADO y la cuenta es esta, sin sumarle nada.
 *
 * Con el bloque en cero —se cerró el anterior, o es un descanso suelto— lo
 * último que se hizo es la última serie del bloque cerrado. La meta de ese
 * bloque no se guarda, así que va en 0 y la tarjeta dice "Serie 3" a secas.
 */
export function serieDelDescanso(e: EstadoBloques): HechoAntesDelDescanso {
  if (e.hechas > 0) return { ejercicio: e.ejercicio, serie: e.hechas, meta: metaQueSeDice(e.hechas, e.meta) };
  const ultimo = e.cerrados[e.cerrados.length - 1];
  if (ultimo) return { ejercicio: ultimo.ejercicio, serie: ultimo.series, meta: 0 };
  return { ejercicio: e.ejercicio, serie: 0, meta: 0 };
}

/**
 * LA META QUE SE PUEDE DECIR AL LADO DE UNA SERIE: nunca una menor que la serie.
 *
 * "Serie 4 de 3" salía de verdad (8/10), y no por un teléfono viejo: llegás a
 * la meta de 3, tocás "Sumar otra" y la cuarta se cuenta con la meta en 3. La
 * meta es lo que te propusiste, no un tope, así que pasarla está bien; lo que
 * no tiene sentido es decirla. Pasada la meta se dice "Serie 4", a secas (cero
 * = sin meta, y la tarjeta la omite).
 */
export function metaQueSeDice(serie: number, meta: number): number {
  return meta >= serie ? meta : 0;
}

/**
 * LO QUE HAY QUE DECIR SI ALGO CAMBIA A MITAD DEL DESCANSO (8/10).
 *
 * La tarjeta de la pantalla bloqueada se escribía al arrancar el descanso y
 * nadie la volvía a tocar: terminabas la cuarta de cuatro, cambiabas de
 * ejercicio, y seguía diciendo el anterior con su "4 de 4".
 *
 * Con series contadas en el bloque, es ese bloque. Con un ejercicio recién
 * ELEGIDO y nada contado, es ese ejercicio y cero series: lo que viene, no lo
 * que pasó. Y si no hay ejercicio, lo último que se hizo, como al arrancar.
 */
export function loQueSeHaceAhora(e: EstadoBloques): HechoAntesDelDescanso {
  if (e.hechas > 0 || e.ejercicio === null) return serieDelDescanso(e);
  return { ejercicio: e.ejercicio, serie: 0, meta: e.meta };
}
