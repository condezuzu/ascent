import {
  authorizationStatusFor,
  AuthorizationStatus,
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

/** Si ya se pidió el permiso. Ver el comentario de arriba: sin esto, crashea. */
let listo = false;

function puedoPreguntar(): boolean {
  if (!isHealthDataAvailable()) return false;
  if (listo) return true;
  // AL VOLVER A ABRIR LA APP, `listo` arranca en `false` aunque el permiso se
  // haya dado hace semanas. Se le pregunta a HealthKit, que se acuerda.
  //
  // OJO CON LO QUE CONTESTA: para LEER, iOS nunca dice "te lo dieron" —sería
  // filtrar que la persona tiene datos de algo—, así que `sharingAuthorized`
  // no es la respuesta esperable acá. Lo único que se puede saber es si
  // todavía está SIN PREGUNTAR (`notDetermined`), y eso alcanza: lo que hay
  // que evitar es consultar antes de haber preguntado.
  try {
    listo = PEDIDOS.every(
      (p) => authorizationStatusFor(p) !== AuthorizationStatus.notDetermined
    );
  } catch {
    listo = false;
  }
  return listo;
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
      // LO QUE DEVUELVE NO ES "te dieron permiso": es "la ventana se mostró y
      // no falló". Apple no dice qué se concedió al leer, a propósito. Así que
      // lo único que se marca es que YA SE PREGUNTÓ, que es justo lo que hacía
      // falta para poder consultar sin tirar la app abajo. Si la persona dijo
      // que no, las consultas devuelven vacío y eso se lee como "no sé".
      listo = true;
      return true;
    } catch {
      return false;
    }
  },

  async entrenoEse(fecha) {
    if (!puedoPreguntar()) return null;
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
    if (!puedoPreguntar()) return null;
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
