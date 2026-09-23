import {
  AuthorizationRequestStatus,
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  queryStatisticsForQuantity,
  queryWorkoutSamples,
  requestAuthorization,
  WorkoutActivityType,
  WorkoutTypeIdentifier,
} from '@kingstinct/react-native-healthkit';
import { deISO } from '@nucleo/fechas';
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

  async pasosDe(fecha) {
    if (!(await puedoPreguntar())) return null;
    try {
      const { startDate, endDate } = elDia(fecha);
      // `cumulativeSum` y no traer las muestras: los pasos llegan en cientos
      // de pedacitos por día, y sumarlos acá sería traerlos todos a JavaScript
      // para hacer una cuenta que HealthKit ya sabe hacer. Además deduplica
      // solo cuando el reloj y el teléfono contaron lo mismo dos veces.
      const r = await queryStatisticsForQuantity(
        'HKQuantityTypeIdentifierStepCount',
        ['cumulativeSum'],
        { filter: { date: { startDate, endDate } }, unit: 'count' }
      );
      const n = r.sumQuantity?.quantity;
      // Sin suma no es cero: es que no hay dato, o que no hay permiso.
      if (typeof n !== 'number' || !Number.isFinite(n)) return null;
      return Math.round(n);
    } catch {
      return null;
    }
  },
};
