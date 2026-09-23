import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import type { Audio } from '@nucleo/plataforma';

/**
 * LA CAMPANA DEL FIN DE DESCANSO — la versión nativa.
 *
 * ─────────────────────────────────────────────────────────────────────
 * LA APP NO CORTA LA MÚSICA. NUNCA. (25/9)
 *
 * Es la regla que manda acá, y reemplaza a la de ayer, que decía lo contrario:
 * "el aviso tiene que CORTAR la música, no sonar por encima". Sonaba razonable
 * —un bip que solo se mezcla se pierde— y en el gimnasio resultó ser el peor
 * comportamiento posible: *"se frena mi música, al entrar a la app y al elegir
 * el tiempo de descanso"*.
 *
 * Y no era un bug: era `interruptionMode: 'doNotMix'`. Ese modo no le pide al
 * sistema "bajá lo que suena mientras dura el bip": le declara que esta app no
 * comparte la salida de audio, y el sistema lo aplica AL ACTIVAR LA SESIÓN, no
 * al reproducir. O sea que la música se frenaba al abrir la pantalla del
 * descanso, mucho antes de que sonara nada, y quedaba frenada.
 *
 * Ahora es `mixWithOthers`: la campana entra ENCIMA de lo que esté sonando y
 * no toca nada más.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Y ENTONCES LA CAMPANA TIENE QUE SER FUERTE, porque ya no tiene el silencio
 * a favor. Eso se arregló donde estaba el problema de verdad: el archivo. El
 * anterior estaba al 24,7% de la escala —bajito antes de salir del parlante— y
 * ahora va normalizado al 95%, con tres toques en vez de dos y las frecuencias
 * más arriba (1175 / 1568 / 2093 Hz), que es donde la música casi nunca tiene
 * energía y el aviso se separa solo de la mezcla. Ver `assets/bip.wav`.
 *
 * ─────────────────────────────────────────────────────────────────────
 * LA SESIÓN SE DECLARA AL ARRANCAR, y no cuando se abre el descanso.
 *
 * `preparar()` se llama también desde la raíz de la app (ver `app/_layout.tsx`)
 * y no solo desde la pantalla del descanso. El motivo es el mismo reporte: la
 * música se frenaba AL ENTRAR A LA APP. Quien decide la categoría de audio es
 * el primero que la toca, y si no la tocamos nosotros la toca el módulo con lo
 * que traiga de fábrica. Declarándola nosotros, y mezclando, la primera
 * palabra sobre la música de la persona es "no la toco".
 *
 * Y `playsInSilentMode`: sin eso, con el switch de silencio puesto —que es
 * como va la mitad de la gente en un gimnasio— el aviso no suena. Es un
 * temporizador, no una notificación social: si no suena, no sirve.
 */

let bip: AudioPlayer | null = null;
let modoPuesto = false;

/**
 * LA CATEGORÍA, UNA SOLA VEZ. Volver a declararla en cada descanso no cambia
 * nada y vuelve a tocar la sesión de audio del sistema doce veces por sesión,
 * que es justo lo que hay que dejar de hacer.
 */
async function declararLaSesion() {
  if (modoPuesto) return;
  modoPuesto = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      // ENCIMA DE LA MÚSICA, NUNCA EN LUGAR DE ELLA.
      interruptionMode: 'mixWithOthers',
      interruptionModeAndroid: 'doNotMix',
      shouldPlayInBackground: false,
    });
  } catch {
    // Si el sistema no deja declararla, la campana igual suena con lo que haya:
    // peor sería no tenerla.
  }
}

export const audioNativo: Audio = {
  // Acá la respuesta es sí de verdad: el sistema deja manejar la sesión de
  // audio y declarar que se mezcla en vez de interrumpir.
  respetaLaMusica() {
    return true;
  },

  async preparar() {
    await declararLaSesion();
    if (bip) return;
    try {
      bip = createAudioPlayer(require('../../assets/bip.wav'));
      // A FONDO. El archivo ya viene normalizado; esto es para que ningún
      // valor guardado de otra vida lo deje a medias.
      bip.volume = 1;
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
    // NO SE SUELTA EL REPRODUCTOR, y es un cambio del 25/9. Se creaba y se
    // destruía con cada apertura de la pantalla del descanso, o sea doce veces
    // por sesión, y cada creación vuelve a tocar la sesión de audio. Ahora se
    // crea una vez y vive lo que viva la app: es un archivo de un segundo.
    //
    // La firma se queda porque el contrato la tiene y la web sí necesita
    // soltar su `AudioContext`.
  },
};
