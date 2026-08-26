import type { Haptica } from '../tipos';

// `navigator.vibrate` existe en Android y NO en iPhone: WebKit nunca
// implementó la Vibration API. Por eso el aviso que siempre funciona es el
// visual, y por eso Ajustes dice qué va a pasar de verdad en cada teléfono
// (§18.7) en vez de prometer una vibración que no va a llegar.
export const hapticaWeb: Haptica = {
  disponible() {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  },

  pulso() {
    if (!this.disponible()) return false;
    // Dos golpes cortos con una pausa: uno solo se confunde con una
    // notificación cualquiera del teléfono.
    return navigator.vibrate([120, 90, 120]);
  },
};
