import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import type { Audio } from '@nucleo/plataforma';

/**
 * EL BIP DEL FIN DE DESCANSO — la versión nativa.
 *
 * ES EL MISMO SONIDO QUE EN WEB, y eso costó un archivo. En web se SINTETIZA
 * con el AudioContext: dos tonos, 880 Hz y 1175 Hz, con rampa para que no
 * haga click. Acá no hay sintetizador —`expo-audio` reproduce archivos— así
 * que ese mismo sonido se generó una vez y quedó en `assets/bip.wav`. Que sean
 * el mismo sonido no es un detalle de purista: es la diferencia entre migrar
 * la app y hacer una parecida.
 *
 * LO QUE ACÁ SE PUEDE Y EN WEB NO: declarar la categoría de audio DE VERDAD.
 * El criterio, pedido después de usar la app en el gimnasio: el aviso tiene
 * que CORTAR la música, no sonar por encima —con auriculares y la música
 * fuerte, un bip que solo atenúa no se escucha—. Con `interruptionMode:
 * 'doNotMix'` el sistema baja lo que esté sonando mientras dura el bip y lo
 * devuelve al terminar.
 *
 * Y `playsInSilentMode`: sin eso, en iPhone con el switch de silencio puesto
 * —que es como va la mitad de la gente en un gimnasio— el aviso no suena. Es
 * un temporizador, no una notificación social: si no suena, no sirve.
 */

let bip: AudioPlayer | null = null;

export const audioNativo: Audio = {
  // Acá la respuesta es sí de verdad: el sistema deja manejar la sesión de
  // audio, cortar la música a propósito y devolverla.
  respetaLaMusica() {
    return true;
  },

  async preparar() {
    if (bip) return;
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        // Corta lo que esté sonando mientras dura el bip.
        interruptionMode: 'doNotMix',
        interruptionModeAndroid: 'doNotMix',
        shouldPlayInBackground: false,
      });
      bip = createAudioPlayer(require('../../assets/bip.wav'));
    } catch {
      bip = null;
    }
  },

  async avisar() {
    // `preparar()` va con el gesto que abre el descanso, pero si por lo que
    // sea no corrió, se prepara acá: en nativo no hace falta un gesto del
    // usuario para crear audio, así que esto no puede fallar por política del
    // navegador como en web.
    if (!bip) await this.preparar();
    try {
      // Al principio SIEMPRE: si el descanso terminó dos veces seguidas, la
      // segunda encontraría el reproductor al final y no sonaría nada.
      bip?.seekTo(0);
      bip?.play();
    } catch {
      /* si no suena, queda el aviso visual y el háptico */
    }
  },

  async soltar() {
    try {
      bip?.remove();
    } catch {
      /* nada que hacer */
    }
    bip = null;
  },
};
