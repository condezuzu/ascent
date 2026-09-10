import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { Ubicacion } from '@nucleo/plataforma';

/**
 * DÓNDE ESTÁ EL TELÉFONO — la versión nativa, y la razón de la migración.
 *
 * LA DIFERENCIA CON WEB NO ES DE PRECISIÓN, ES DE QUIÉN PREGUNTA. En web la
 * app tiene que estar abierta para mirar: el navegador no despierta a una PWA
 * cerrada, así que el "automático" era en realidad "abrí la app en el
 * gimnasio". Acá se registra una zona en el sistema operativo y es el TELÉFONO
 * el que despierta a la app al entrar, con la pantalla bloqueada y la app
 * cerrada. Eso es §13, y es lo que no se podía hacer del otro lado.
 *
 * DOS PERMISOS Y NO UNO. `puntoActual` necesita el de primer plano; el
 * geofencing necesita ADEMÁS el de segundo plano, que iOS solo concede después
 * de haber usado el de primer plano y que el usuario puede negar por separado.
 * Por eso `vigilarLlegada` devuelve `false` en vez de tirar: quien llama ya
 * sabe convivir con eso —es lo que hacía la web siempre— y no hay que
 * preguntar antes de intentar.
 *
 * EN EXPO GO EL GEOFENCING NO ANDA COMPLETO: las tareas en segundo plano
 * necesitan una build de desarrollo. `vigilarLlegada` devuelve `false` ahí, que
 * es exactamente el camino que la app ya recorre en web, así que no hay nada
 * roto mientras tanto: el atajo de mirar al abrir sigue funcionando.
 */

// El nombre de la tarea. Va afuera del objeto y en el módulo, porque
// TaskManager exige que la tarea esté definida ANTES de que la app termine de
// arrancar: si se definiera adentro de `vigilarLlegada`, el sistema podría
// despertar a la app con una tarea que todavía no existe y perdería el evento.
const TAREA = 'ascent-llegada-al-gimnasio';

// Lo que hay que llamar cuando el sistema avisa. Es una variable de módulo y
// no un argumento de la tarea porque el sistema puede despertar a la app con
// el proceso muerto: ahí este archivo se vuelve a evaluar y `alLlegar` está en
// `null` hasta que alguien vuelva a registrar. Ver el comentario de abajo.
let alLlegar: (() => void) | null = null;

// `async` porque TaskManager espera una promesa: el sistema usa lo que
// devuelve para saber cuándo puede dormir a la app de nuevo.
TaskManager.defineTask(TAREA, async ({ data, error }) => {
  if (error) return;
  const evento = (data as { eventType?: Location.GeofencingEventType } | null)?.eventType;
  if (evento === Location.GeofencingEventType.Enter) alLlegar?.();
});

export const ubicacionNativa: Ubicacion = {
  disponible() {
    return true;
  },

  async puntoActual(edadMaxima = 0) {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;

      // Con `edadMaxima` > 0 se acepta el último arreglo conocido, que es
      // gratis: no enciende la antena. `estoyEnElGimnasio` lo usa en dos pasos
      // justamente para no pagar el GPS cuando la respuesta vieja ya alcanza.
      if (edadMaxima > 0) {
        const ultimo = await Location.getLastKnownPositionAsync({ maxAge: edadMaxima });
        if (ultimo) {
          return {
            lat: ultimo.coords.latitude,
            lon: ultimo.coords.longitude,
            precision: ultimo.coords.accuracy ?? 9999,
            medidoEn: ultimo.timestamp,
          };
        }
      }

      const pos = await Location.getCurrentPositionAsync({
        // La diferencia entre 50 y 500 metros es justo lo que decide si esto
        // sirve, así que se pide la buena.
        accuracy: Location.Accuracy.High,
      });
      return {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        // `null` sería "no sé cuánto me equivoco", y el peor caso de eso es
        // que la app crea que estás adentro cuando no lo sabe: el radio se
        // suma a la precisión, así que un número enorme no dispara nada.
        precision: pos.coords.accuracy ?? 9999,
        // Cuándo se midió DE VERDAD, no cuándo lo miramos.
        medidoEn: pos.timestamp,
      };
    } catch {
      // Sin permiso, sin señal o timeout: los tres son "no sé dónde estás", y
      // la app tiene que andar entera sin esto (§13).
      return null;
    }
  },

  async vigilarLlegada(centro, radio, avisar) {
    try {
      const primerPlano = await Location.requestForegroundPermissionsAsync();
      if (primerPlano.status !== 'granted') return false;
      const fondo = await Location.requestBackgroundPermissionsAsync();
      if (fondo.status !== 'granted') return false;

      alLlegar = avisar;
      await Location.startGeofencingAsync(TAREA, [
        {
          latitude: centro.lat,
          longitude: centro.lon,
          radius: radio,
          notifyOnEnter: true,
          // La SALIDA no se vigila desde el sistema: la sesión se cierra con
          // la última vez que se lo vio adentro, y esa hora la tiene la app.
          // Un evento de salida que llegue con la app muerta no sabría con qué
          // hora cerrar.
          notifyOnExit: false,
        },
      ]);
      return true;
    } catch {
      // En Expo Go, o sin permiso de segundo plano, esto tira. `false` es la
      // misma respuesta que da la web, y la app ya sabe seguir con eso.
      return false;
    }
  },

  async dejarDeVigilar() {
    alLlegar = null;
    try {
      if (await TaskManager.isTaskRegisteredAsync(TAREA)) {
        await Location.stopGeofencingAsync(TAREA);
      }
    } catch {
      /* si no estaba vigilando, no hay nada que soltar */
    }
  },
};
