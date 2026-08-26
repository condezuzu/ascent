import type { Almacenamiento } from '../tipos';

// `localStorage` envuelto en promesas. Es sincrónico de verdad, así que las
// promesas resuelven en el mismo tick; la asincronía es del contrato, para que
// AsyncStorage entre después sin tocar a nadie.
//
// El `typeof` no es paranoia: en el render del servidor de Next no existe.
export const almacenamientoWeb: Almacenamiento = {
  async leer(clave) {
    if (typeof localStorage === 'undefined') return null;
    try {
      return localStorage.getItem(clave);
    } catch {
      return null;
    }
  },

  async guardar(clave, valor) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(clave, valor);
    } catch {
      // lleno, en modo privado, o deshabilitado: se sigue sin guardar
    }
  },

  async borrar(clave) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(clave);
    } catch {
      // nada que hacer
    }
  },
};

// Lo mismo con `sessionStorage`: muere al cerrar la pestaña y sobrevive a
// recargarla.
export const efimeroWeb: Almacenamiento = {
  async leer(clave) {
    if (typeof sessionStorage === 'undefined') return null;
    try {
      return sessionStorage.getItem(clave);
    } catch {
      return null;
    }
  },

  async guardar(clave, valor) {
    if (typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(clave, valor);
    } catch {
      // se sigue con el predeterminado
    }
  },

  async borrar(clave) {
    if (typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.removeItem(clave);
    } catch {
      // nada que hacer
    }
  },
};
