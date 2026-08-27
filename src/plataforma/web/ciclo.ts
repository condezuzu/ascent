import type { CicloDeVida } from '../tipos';

/**
 * En web, "la app está adelante" es `document.visibilityState`.
 *
 * Se escuchan DOS eventos y no uno. `visibilitychange` avisa cuando la pestaña
 * se esconde o vuelve, pero no cuando la ventana pierde y recupera el foco
 * estando visible — y eso también significa que la persona volvió a mirar. El
 * cronómetro necesita repintarse en los dos casos: al volver, el intervalo
 * estuvo suspendido y el número que se ve es viejo.
 *
 * Por eso el aviso NO trae "cambió a visible": trae "mirá de nuevo, puede
 * haber pasado tiempo". Quien lo escucha decide si le importa.
 */
export const cicloWeb: CicloDeVida = {
  visible() {
    if (typeof document === 'undefined') return true;
    return document.visibilityState === 'visible';
  },

  alCambiar(escuchar) {
    if (typeof document === 'undefined') return () => {};
    const avisar = () => escuchar(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', avisar);
    window.addEventListener('focus', avisar);
    return () => {
      document.removeEventListener('visibilitychange', avisar);
      window.removeEventListener('focus', avisar);
    };
  },
};
