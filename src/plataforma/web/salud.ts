import type { Salud } from '../tipos';

// El navegador no tiene acceso a Apple Health ni a Health Connect, y no hay
// nada parecido: no es que la API sea peor, es que no existe. Este hueco queda
// vacío a propósito hasta la versión nativa (§13c).
//
// Todo devuelve "no sé" en vez de "no": quien pregunta ya distingue los dos
// casos, y confundirlos haría que la app dijera "no entrenaste" cuando lo que
// pasa es que no puede saberlo.
export const saludWeb: Salud = {
  disponible() {
    return false;
  },
  async pedirPermiso() {
    return false;
  },
  async entrenoEse(_fecha) {
    return null;
  },
};
