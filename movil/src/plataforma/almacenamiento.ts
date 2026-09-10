import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Almacenamiento } from '@nucleo/plataforma';

/**
 * GUARDAR EN EL TELÉFONO — la versión nativa.
 *
 * Es el puerto que justificó que el contrato fuera asíncrono desde el
 * principio, cuando en web `localStorage` es sincrónico: acá no hay
 * `localStorage`, hay AsyncStorage, y es asíncrono. Haberlo dejado sincrónico
 * habría significado cambiar las firmas de cinco librerías y de todos sus
 * llamadores justo hoy, con el resto de Expo encima. La deuda se pagó antes de
 * tomarla.
 *
 * NO TIRA NUNCA, igual que la web: si el almacenamiento está lleno o corrupto,
 * `leer` devuelve `null` y `guardar` no hace nada. Todo lo que se guarda acá
 * es una conveniencia; la fuente de la verdad es la base.
 */
export const almacenamientoNativo: Almacenamiento = {
  async leer(clave) {
    try {
      return await AsyncStorage.getItem(clave);
    } catch {
      return null;
    }
  },

  async guardar(clave, valor) {
    try {
      await AsyncStorage.setItem(clave, valor);
    } catch {
      /* se pierde el dato, no la app */
    }
  },

  async borrar(clave) {
    try {
      await AsyncStorage.removeItem(clave);
    } catch {
      /* idem */
    }
  },
};

/**
 * EL EFÍMERO: muere al cerrar la app.
 *
 * En web es `sessionStorage`, que además sobrevive a recargar la pestaña. Acá
 * es un `Map` en memoria y muere igual de bien, porque en nativo no existe el
 * recargar: cerrar la app ES el final del proceso.
 *
 * Acá vive, por ejemplo, la duración de descanso elegida con un preset: vale
 * para lo que queda de esta sesión y mañana tiene que arrancar de nuevo en el
 * predeterminado (§18.5). Guardarla en el persistente sería recordar para
 * siempre los 90 segundos de los accesorios de ayer.
 */
const enMemoria = new Map<string, string>();

export const efimeroNativo: Almacenamiento = {
  async leer(clave) {
    return enMemoria.has(clave) ? (enMemoria.get(clave) as string) : null;
  },
  async guardar(clave, valor) {
    enMemoria.set(clave, valor);
  },
  async borrar(clave) {
    enMemoria.delete(clave);
  },
};
