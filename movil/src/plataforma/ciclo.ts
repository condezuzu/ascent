import { AppState } from 'react-native';
import type { CicloDeVida } from '@nucleo/plataforma';

/**
 * ¿LA APP ESTÁ ADELANTE? — la versión nativa.
 *
 * ES EL PUERTO QUE MÁS COSAS SOSTIENE: el cronómetro de sesión, el descanso
 * entre series, el vigilante del gimnasio y el de la sesión dependen los
 * cuatro de saber cuándo la persona volvió a mirar la pantalla.
 *
 * En web es `document.visibilityState` más el foco de la ventana; acá es
 * `AppState`, que dice lo mismo con otras palabras.
 *
 * SE CUENTA `inactive` COMO NO VISIBLE, y no es un detalle de iOS: es el
 * estado del centro de control abierto, de la llamada entrante, del selector
 * de apps. La app se está viendo a medias y los intervalos ya se están
 * suspendiendo. Tratarlo como visible dejaría al cronómetro creyendo que
 * corrió mientras no corría — que es exactamente el error que este puerto
 * existe para evitar.
 *
 * Y el aviso significa lo mismo que en web: **"volvé a mirar, puede haber
 * pasado tiempo"**, no "cambió a visible". Quien lo escucha decide si le
 * importa.
 */
export const cicloNativo: CicloDeVida = {
  visible() {
    return AppState.currentState === 'active';
  },

  alCambiar(escuchar) {
    const sub = AppState.addEventListener('change', (estado) => {
      escuchar(estado === 'active');
    });
    return () => sub.remove();
  },
};
