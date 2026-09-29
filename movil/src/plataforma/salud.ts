import {
  AuthorizationRequestStatus,
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  queryStatisticsCollectionForQuantity,
  queryStatisticsForQuantity,
  queryWorkoutSamples,
  requestAuthorization,
  WorkoutActivityType,
  WorkoutTypeIdentifier,
} from '@kingstinct/react-native-healthkit';
import { aISO, deISO } from '@nucleo/fechas';
import type { Salud } from '@nucleo/plataforma';

/**
 * APPLE HEALTH — el hueco que por fin se llena (§13c).
 *
 * EN WEB ESTABA VACÍO PORQUE NO EXISTE NADA PARECIDO: ninguna API del
 * navegador ve los entrenamientos ni los pasos del teléfono. Acá existe, y lo
 * único que faltaba era el `entitlement` de HealthKit, que Expo Go no tiene y
 * no puede tener. Con la build propia, se puede.
 *
 * PARA QUÉ SIRVE Y PARA QUÉ NO. Es un **agregado**, no una fuente de datos: si
 * el teléfono ya sabe que hoy entrenaste, el día no se pierde. La app entera
 * funciona sin esto y sin el permiso, igual que sin el de ubicación (§13).
 * Nada de acá decide nada solo: quien pregunta es la app, y una respuesta que
 * no llega no rompe ninguna pantalla.
 *
 * DOS SEÑALES DISTINTAS, Y LA DIFERENCIA IMPORTA:
 *
 *  - **Los entrenamientos** (`entrenoEse`) son la señal honesta de "fuiste al
 *    gimnasio": alguien —el reloj, otra app— registró un entrenamiento de
 *    fuerza ese día. Es lo único que puede registrar un día solo.
 *  - **Los pasos** (`pasosDe`) NO dicen que entrenaste. Un día de 14.000 pasos
 *    puede ser una caminata, y uno de gimnasio de fuerza puede tener 2.000.
 *    Se leen porque son el dato que el teléfono tiene siempre —no hace falta
 *    reloj ni otra app—, pero se muestran, no deciden.
 *
 * LO QUE HAY QUE SABER DE ESTA LIBRERÍA, que muerde: **pedir un dato para el
 * que no se pidió autorización TIRA ABAJO LA APP.** No devuelve vacío ni
 * error: crashea. Por eso todo pasa por `pedidos`, que es la lista de lo que
 * se pidió, y por `listo`, que es si ya se pidió. Sin esa guarda, abrir la app
 * antes de dar el permiso sería un cierre en seco.
 *
 * Y HEALTHKIT NO EXISTE EN iPAD ni en el simulador: `isHealthDataAvailable()`
 * es la primera pregunta de todo, y con `false` esto queda exactamente como
 * estaba en web.
 */

// Lo único que se lee. Es deliberadamente corto: cada identificador de más es
// una fila más en la ventana de permisos y un dato más que justificar en la
// ficha de privacidad de la tienda. Ascent no escribe NADA en Health, así que
// no hay `toShare`.
const PEDIDOS = [WorkoutTypeIdentifier, 'HKQuantityTypeIdentifierStepCount'] as const;

/**
 * LOS ENTRENAMIENTOS QUE CUENTAN COMO "fui al gimnasio". Correr y nadar no
 * están a propósito: Ascent cuenta días de gimnasio, y meter cualquier
 * actividad haría que salir a correr marcara el día de fuerza. Vale más un
 * automático que no dispara de menos que uno que miente.
 */
const DE_GIMNASIO: readonly WorkoutActivityType[] = [
  WorkoutActivityType.traditionalStrengthTraining,
  WorkoutActivityType.functionalStrengthTraining,
  WorkoutActivityType.coreTraining,
  WorkoutActivityType.highIntensityIntervalTraining,
];

/**
 * El día completo, en el huso del teléfono.
 *
 * `deISO` arma la medianoche LOCAL —no UTC—, que es lo que hace que el día de
 * Health corte donde corta el día de la racha. Con `new Date(iso)` a secas
 * sería medianoche UTC, y en Montevideo (UTC−3) un entrenamiento de las nueve
 * de la noche caería en el día siguiente.
 */
function elDia(fecha: string) {
  const startDate = deISO(fecha);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);
  return { startDate, endDate };
}

/**
 * ¿YA SE PIDIÓ EL PERMISO? Es la única pregunta que hay que contestar antes
 * de consultar cualquier cosa, porque consultar sin haber pedido TIRA ABAJO
 * LA APP (no devuelve vacío: crashea).
 *
 * LA PRIMERA VERSIÓN LA CONTESTABA MAL Y NUNCA LEYÓ NADA (bug del 23/9).
 * Usaba `authorizationStatusFor`, que es el espejo de
 * `HKHealthStore.authorizationStatus(for:)` — y eso informa el permiso de
 * **ESCRITURA**, no el de lectura. Apple lo hace a propósito: decir si
 * concediste lectura filtraría que tenés datos de algo. Ascent solo LEE, así
 * que nunca pidió escritura, así que ese estado se quedaba en
 * `notDetermined` para siempre.
 *
 * Resultado: conectabas, iOS guardaba el permiso, y la guarda seguía
 * diciendo que no se había preguntado. `pasosDe` y `entrenoEse` devolvían
 * "no sé" para siempre y la sección parecía no hacer nada — que es
 * exactamente lo que se reportó.
 *
 * LO CORRECTO ES `getRequestStatusForAuthorization`, que contesta otra cosa:
 * no si te lo dieron, sino **si hace falta volver a preguntar**.
 * `unnecessary` significa que la app ya pidió por esos tipos, que es
 * justamente lo que hay que saber para poder consultar sin crashear. Si la
 * persona dijo que no, las consultas devuelven vacío y eso se lee como "no
 * sé", que es lo honesto.
 */
let listo = false;

async function puedoPreguntar(): Promise<boolean> {
  if (!isHealthDataAvailable()) return false;
  if (listo) return true;
  try {
    const estado = await getRequestStatusForAuthorization({ toRead: PEDIDOS });
    listo = estado === AuthorizationRequestStatus.unnecessary;
  } catch {
    listo = false;
  }
  return listo;
}

/**
 * Si ya está conectado: o sea, si ya se pidió el permiso alguna vez.
 *
 * NO DICE "te dieron permiso", porque eso iOS no lo dice para lectura. Dice
 * que la pregunta ya se hizo, que es lo que la pantalla necesita para dejar
 * de ofrecer un botón que no va a mostrar nada.
 */
export async function yaSePidio(): Promise<boolean> {
  return puedoPreguntar();
}

// ============================================================================
// EL LAG ERA ESTO (28/9). Stats pedía `pasosPorDia(365)` en CADA entrada y en
// cada vuelta al frente, a veces DOS veces (montaje + PESTANA_ACTIVA), y sin
// caché. Y en el teléfono del humano la consulta agrupada (`enCubos`) vuelve
// vacía —lo dice el comentario de abajo— así que entra el CAMINO LARGO, que
// hacía 30 idas al puente UNA TRAS OTRA. Resultado: hasta ~60 round-trips
// seriados a HealthKit por entrada a Stats, sobre el hilo de JS, justo mientras
// se desliza la pestaña. Se arregla con tres cosas, y se MIDE de paso.
//   1. CACHÉ CON TTL: dentro de una ventana corta no se vuelve a preguntar.
//   2. DEDUP EN VUELO: dos pedidos iguales a la vez comparten una sola promesa.
//   3. EL CAMINO LARGO EN PARALELO, no seriado (30× la latencia → ~1×).
// ============================================================================

// Lo que el HUD de diagnóstico lee: la última consulta a Salud y cuántas van.
let ultimaConsulta: { tipo: string; ms: number; cuando: number } | null = null;
let totalConsultas = 0;

export function consultasDeSalud() {
  return ultimaConsulta ? { ...ultimaConsulta, total: totalConsultas } : null;
}

async function medido<T>(tipo: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    return await fn();
  } finally {
    ultimaConsulta = { tipo, ms: Date.now() - t0, cuando: Date.now() };
    totalConsultas++;
  }
}

// La caché vive `TTL_MS`; pasado eso se vuelve a preguntar. 90 s es más que una
// vuelta entre pantallas —así deja de re-pedir en cada cambio de pestaña— y
// menos que una caminata, así que el número no se congela. Además se olvida al
// volver la app al frente (`olvidarLoLeido`), para que "los pasos de hoy" de
// Inicio se refresquen en cada entrada real (item 5.2).
const TTL_MS = 90_000;
type Entrada<T> = { cuando: number; valor: T };
const cacheUnDia = new Map<string, Entrada<number | null>>();
const cacheSerie = new Map<number, Entrada<{ fecha: string; valor: number }[] | null>>();
const enVueloDia = new Map<string, Promise<number | null>>();
const enVueloSerie = new Map<number, Promise<{ fecha: string; valor: number }[] | null>>();

function fresco<T>(e: Entrada<T> | undefined): e is Entrada<T> {
  return !!e && Date.now() - e.cuando < TTL_MS;
}

/** Se olvida lo leído: al volver la app al frente y al conceder el permiso. */
export function olvidarLoLeido() {
  cacheUnDia.clear();
  cacheSerie.clear();
}

/**
 * LA LECTURA CRUDA DE UN DÍA, sin caché ni permiso (el que llama ya preguntó).
 * Es lo que usa tanto `pasosDe` como el camino largo de `pasosPorDia`.
 */
async function leerUnDia(fecha: string): Promise<number | null> {
  try {
    const { startDate, endDate } = elDia(fecha);
    const r = await queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierStepCount',
      ['cumulativeSum'],
      { filter: { date: { startDate, endDate } }, unit: 'count' }
    );
    const n = r.sumQuantity?.quantity;
    if (typeof n !== 'number' || !Number.isFinite(n)) return null;
    return Math.round(n);
  } catch {
    return null;
  }
}

/** La serie cruda de muchos días: cubos si andan, si no el camino largo. */
async function leerSerie(dias: number): Promise<{ fecha: string; valor: number }[] | null> {
  const porCubos = await enCubos(dias).catch(() => null);
  if (porCubos && porCubos.length > 0) {
    ultimaLectura = { como: 'cubos', dias: porCubos.length };
    return porCubos;
  }
  // EL CAMINO LARGO, AHORA EN PARALELO (28/9). Antes eran 30 `await` uno tras
  // otro: 30× la latencia del puente, en cada entrada a Stats. En paralelo, las
  // 30 resuelven en ~1× la latencia. HealthKit atiende consultas concurrentes.
  const cuantos = Math.min(dias, 30);
  const hoy = new Date();
  const fechas: string[] = [];
  for (let i = cuantos - 1; i >= 0; i--) {
    const d = new Date(hoy);
    d.setDate(d.getDate() - i);
    fechas.push(aISO(d));
  }
  const valores = await Promise.all(fechas.map((f) => leerUnDia(f)));
  const serie = fechas
    .map((fecha, i) => ({ fecha, valor: valores[i] }))
    .filter((x): x is { fecha: string; valor: number } => x.valor !== null && x.valor > 0);
  ultimaLectura = { como: serie.length ? 'uno por uno' : 'nada', dias: serie.length };
  return serie;
}

export const saludNativa: Salud = {
  disponible() {
    // En iPad y en el simulador HealthKit no existe. Ahí esto queda como
    // estaba en web y no se ofrece nada que no se pueda cumplir.
    try {
      return isHealthDataAvailable();
    } catch {
      return false;
    }
  },

  async pedirPermiso() {
    if (!isHealthDataAvailable()) return false;
    try {
      await requestAuthorization({ toRead: PEDIDOS });
      // LO QUE DEVUELVE `requestAuthorization` NO ES "te dieron permiso": es
      // "la ventana se mostró y no falló". Apple no dice qué se concedió al
      // leer. Lo que sí se puede saber después es si la pregunta ya está
      // hecha, y eso es lo que habilita consultar sin crashear.
      listo = false; // que lo vuelva a averiguar de la fuente, no de acá
      olvidarLoLeido(); // los `null` cacheados de antes del permiso ya no valen
      return await puedoPreguntar();
    } catch {
      return false;
    }
  },
  async entrenoEse(fecha) {
    if (!(await puedoPreguntar())) return null;
    try {
      const { startDate, endDate } = elDia(fecha);
      const entrenos = await queryWorkoutSamples({
        limit: 0,
        filter: { date: { startDate, endDate } },
      });
      // VACÍO NO ES "NO ENTRENASTE". Sin permiso de lectura HealthKit devuelve
      // exactamente lo mismo que un día en el que no hiciste nada: una lista
      // vacía, sin avisar cuál de las dos cosas es. Decir `false` ahí sería
      // afirmar algo que no sabemos, así que "no hay nada" se contesta con
      // `null` y solo un entreno encontrado contesta `true`.
      if (entrenos.length === 0) return null;
      return entrenos.some((e) => DE_GIMNASIO.includes(e.workoutActivityType));
    } catch {
      return null;
    }
  },

  // `cumulativeSum` y no traer las muestras: los pasos llegan en cientos de
  // pedacitos por día, y sumarlos acá sería traerlos todos a JavaScript para una
  // cuenta que HealthKit ya sabe hacer. Con caché + dedup en vuelo: el mismo día
  // no se vuelve a preguntar dentro de la ventana, y dos pedidos simultáneos
  // comparten una sola consulta. Sin suma no es cero: es que no hay dato.
  async pasosDe(fecha) {
    if (!(await puedoPreguntar())) return null;
    const cacheado = cacheUnDia.get(fecha);
    if (fresco(cacheado)) return cacheado.valor;
    const yaEnVuelo = enVueloDia.get(fecha);
    if (yaEnVuelo) return yaEnVuelo;
    const p = medido('día', () => leerUnDia(fecha))
      .then((v) => {
        cacheUnDia.set(fecha, { cuando: Date.now(), valor: v });
        return v;
      })
      .finally(() => {
        enVueloDia.delete(fecha);
      });
    enVueloDia.set(fecha, p);
    return p;
  },

  // LOS PASOS DE UNA VENTANA CUALQUIERA (3.3): "cuántos caminaste EN la sesión".
  // La misma consulta que `pasosDe` pero con las fechas del reloj del aparato en
  // vez de un día entero. Sin caché: cada sesión es una ventana distinta y se
  // pregunta una sola vez, al cerrar. `null` es "no sé" (sin permiso/Health), 0
  // es "no caminó" —acá 0 sí es un dato, pero el resumen no lo muestra—.
  async pasosEntre(inicio, fin) {
    if (!(await puedoPreguntar())) return null;
    try {
      const r = await queryStatisticsForQuantity(
        'HKQuantityTypeIdentifierStepCount',
        ['cumulativeSum'],
        { filter: { date: { startDate: inicio, endDate: fin } }, unit: 'count' }
      );
      const n = r.sumQuantity?.quantity;
      if (typeof n !== 'number' || !Number.isFinite(n)) return null;
      return Math.round(n);
    } catch {
      return null;
    }
  },

  /**
   * LOS PASOS DE MUCHOS DÍAS, EN UNA SOLA CONSULTA.
   *
   * `queryStatisticsCollectionForQuantity` le pide a HealthKit la suma
   * agrupada por día. La alternativa era llamar a `pasosDe` noventa veces para
   * un gráfico de tres meses: noventa saltos al puente nativo para una cuenta
   * que iOS hace de un lado solo, y cada una deduplicando por su cuenta el
   * reloj contra el teléfono.
   *
   * EL ANCLA ES MEDIANOCHE LOCAL, y ahí está el detalle que importa: los cubos
   * se arman a partir del ancla, así que un ancla en UTC partiría los días tres
   * horas corridas en Montevideo y los pasos de la noche caerían en el día
   * siguiente. `deISO` da medianoche local, igual que en `elDia`.
   *
   * LOS DÍAS SIN DATO SE SALTEAN. HealthKit devuelve el cubo igual, sin suma;
   * ponerlo en 0 diría "ese día no caminaste" cuando lo que pasó es que el
   * teléfono no estaba encima. Un hueco es un hueco.
   */
  async pasosPorDia(dias) {
    if (!(await puedoPreguntar())) return null;
    const cacheado = cacheSerie.get(dias);
    if (fresco(cacheado)) return cacheado.valor;
    const yaEnVuelo = enVueloSerie.get(dias);
    if (yaEnVuelo) return yaEnVuelo;
    const p = medido('serie', () => leerSerie(dias))
      .then((v) => {
        cacheSerie.set(dias, { cuando: Date.now(), valor: v });
        return v;
      })
      .finally(() => {
        enVueloSerie.delete(dias);
      });
    enVueloSerie.set(dias, p);
    return p;
  },
};

/**
 * LA CONSULTA BUENA: una sola, con la suma agrupada por día del lado de iOS.
 *
 * Separada para que el camino largo pueda existir sin ensuciarla: si esta anda
 * —y en el simulador anda— es la que corre siempre.
 */
async function enCubos(dias: number): Promise<{ fecha: string; valor: number }[]> {
  const hoy = new Date();
  const atras = new Date(hoy);
  atras.setDate(atras.getDate() - (dias - 1));
  const ancla = deISO(aISO(atras));
  const hasta = deISO(aISO(hoy));
  hasta.setDate(hasta.getDate() + 1);

  const cubos = await queryStatisticsCollectionForQuantity(
    'HKQuantityTypeIdentifierStepCount',
    ['cumulativeSum'],
    ancla,
    { day: 1 },
    { filter: { date: { startDate: ancla, endDate: hasta } }, unit: 'count' }
  );

  const serie: { fecha: string; valor: number }[] = [];
  cubos.forEach((c, i) => {
    const n = c.sumQuantity?.quantity;
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return;
    // LA FECHA DEL CUBO, DE DONDE SE PUEDA. `startDate` debería ser un `Date`,
    // pero esto cruza el puente nativo y del otro lado bien puede llegar una
    // cadena; `aISO` le pediría `getFullYear` y tiraría, y toda la lectura se
    // caía en silencio. Si no viene ninguna de las dos, los cubos son diarios y
    // consecutivos desde el ancla, así que la fecha se deduce del índice.
    const bruta = c.startDate as unknown;
    let fecha: string;
    if (bruta instanceof Date) fecha = aISO(bruta);
    else if (typeof bruta === 'string' && bruta.length >= 10) fecha = bruta.slice(0, 10);
    else {
      const d = new Date(ancla);
      d.setDate(d.getDate() + i);
      fecha = aISO(d);
    }
    serie.push({ fecha, valor: Math.round(n) });
  });
  // De más viejo a más nuevo: la cuenta de la tendencia recorre la serie hacia
  // atrás y da por sentado que está ordenada.
  serie.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return serie;
}

/**
 * QUÉ PASÓ EN LA ÚLTIMA LECTURA DE PASOS, para el diagnóstico de Ajustes.
 *
 * No es telemetría ni un registro: es una variable que la pantalla de
 * diagnóstico lee para poder contestar "¿y por qué no hay gráfico?" sin un
 * iPhone conectado a una computadora. Con "cubos: 0" o "nada" ya se sabe si el
 * problema es HealthKit o el dibujo.
 */
let ultimaLectura: { como: string; dias: number } | null = null;

export function comoLeyoLosPasos(): { como: string; dias: number } | null {
  return ultimaLectura;
}
