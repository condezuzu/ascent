import type { Salud } from '@nucleo/plataforma';

/**
 * APPLE HEALTH / HEALTH CONNECT — el hueco que sigue vacío, y por qué.
 *
 * En web estaba vacío porque **no existe nada parecido**: ninguna API del
 * navegador da acceso a los entrenamientos del teléfono. Acá existe, pero no
 * alcanza con instalar una librería:
 *
 * - Apple Health necesita un `entitlement` de HealthKit, que Expo Go no tiene
 *   y no puede tener: hay que hacer una **build de desarrollo**.
 * - Health Connect en Android pide su propio permiso y un mínimo de SDK.
 *
 * Así que este puerto queda con la misma respuesta que en web —"no
 * disponible"— hasta que exista la build de desarrollo, que es otra tanda.
 * **La app entera funciona sin esto**: es un agregado para no perder un día
 * que el teléfono ya sabe que entrenaste, no una fuente de datos.
 *
 * `entrenoEse` devuelve `null` para "no sé", que NO es lo mismo que `false`:
 * confundirlos haría que la app diera por no entrenado un día que sí lo fue.
 * El día que se implemente, esa distinción es lo único que no se puede
 * relajar.
 */
export const saludNativa: Salud = {
  disponible() {
    return false;
  },

  async pedirPermiso() {
    return false;
  },

  async entrenoEse() {
    return null;
  },
};
