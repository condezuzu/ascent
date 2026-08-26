import type { Avisos } from '../tipos';

// En web el aviso solo existe con la app ADELANTE: el navegador no despierta
// una PWA cerrada, y con la pantalla bloqueada no corre nada. Así que
// `programar` es un `setTimeout` y nada más.
//
// La cuenta NO sale de acá. El descanso siempre se calcula contra el timestamp
// de fin guardado (§18.4); esto es un aviso encima de eso. Si el teléfono
// suspende la app y el timeout no dispara, el tiempo que se ve sigue bien.
const pendientes = new Map<string, ReturnType<typeof setTimeout>>();

export const avisosWeb: Avisos = {
  conPantallaBloqueada() {
    return false;
  },

  async permiso() {
    // No se pide el permiso de notificaciones del navegador: con la app
    // adelante no hace falta, y pedirlo sin usarlo gasta la única vez que el
    // usuario va a decir que sí.
    return true;
  },

  async programar(id, enSegundos, alSonar) {
    await this.cancelar(id);
    pendientes.set(
      id,
      setTimeout(() => {
        pendientes.delete(id);
        alSonar();
      }, Math.max(0, enSegundos) * 1000)
    );
  },

  async cancelar(id) {
    const t = pendientes.get(id);
    if (t === undefined) return;
    clearTimeout(t);
    pendientes.delete(id);
  },
};
