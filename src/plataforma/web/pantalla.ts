import type { Pantalla } from '../tipos';

// Wake Lock: sin esto la pantalla se bloquea a los treinta segundos y el aviso
// visual —el único que funciona en todos los teléfonos— no lo ve nadie. En
// nativo el equivalente es `expo-keep-awake`.
//
// Es una comodidad, nunca un requisito: si el sistema lo niega —batería baja,
// modo ahorro— la cuenta sigue siendo correcta igual.
let sentinela: WakeLockSentinel | null = null;

export const pantallaWeb: Pantalla = {
  disponible() {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  },

  async mantenerDespierta() {
    if (!this.disponible()) return false;
    // Si ya tenemos uno vivo, no se pide otro: `mantenerDespierta` se llama de
    // nuevo cada vez que la pantalla se vuelve a ver, y pedir sin soltar
    // dejaría sentinelas colgados que nadie libera.
    if (sentinela && !sentinela.released) return true;
    // Pedirlo con la pestaña oculta tira siempre: no es un error que haya que
    // mostrar, es que todavía no es el momento.
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return false;
    try {
      sentinela = await navigator.wakeLock.request('screen');
      return true;
    } catch {
      return false;
    }
  },

  async soltar() {
    try {
      await sentinela?.release();
    } catch {
      /* ya estaba suelto */
    }
    sentinela = null;
  },
};
