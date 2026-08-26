import type { Audio } from '../tipos';

// El navegador no expone la categoría de audio del sistema... salvo por la
// Audio Session API, que Safari implementa (experimental) y nadie más. Con
// ella se puede pedir `transient`, que la especificación define exactamente
// como nuestro caso: "audio transitorio, como un ping de notificación; deberían
// sonar por encima del audio de reproducción y quizá atenuarlo".
//
// O sea que esto NO es 100% nativo, al revés de lo que decía la spec: en
// iPhone hay una mejora real disponible hoy.
type SesionDeAudio = { type: string };
const sesion = (): SesionDeAudio | null => {
  const n = navigator as Navigator & { audioSession?: SesionDeAudio };
  return typeof navigator !== 'undefined' && n.audioSession ? n.audioSession : null;
};

let ctx: AudioContext | null = null;

export const audioWeb: Audio = {
  respetaLaMusica() {
    return sesion() !== null;
  },

  async preparar() {
    if (ctx) return;
    try {
      ctx = new AudioContext();
    } catch {
      ctx = null;
      return;
    }
    // Suspendido HASTA que suene. Un AudioContext despierto mantiene viva la
    // sesión de audio del sistema, así que dejarlo corriendo los tres minutos
    // del descanso puede apagarle la música al usuario todo ese rato — y el
    // sonido dura menos de medio segundo. Esto vale aunque no haya
    // `audioSession`, así que es la mejora que llega a todos los teléfonos.
    try {
      await ctx.suspend();
    } catch {
      /* si no se puede suspender, igual suena */
    }
  },

  async avisar() {
    if (!ctx) return;
    try {
      // Se pide la categoría lo más tarde posible y se devuelve enseguida:
      // mientras no suena, la página no tiene por qué estar declarando nada.
      const s = sesion();
      const antes = s?.type;
      if (s) s.type = 'transient';

      await ctx.resume();
      const ahora = ctx.currentTime;
      for (const [cuando, hz] of [
        [0, 880],
        [0.18, 1175],
      ] as const) {
        const osc = ctx.createOscillator();
        const vol = ctx.createGain();
        osc.frequency.value = hz;
        // rampa en vez de encender y apagar: un corte seco hace "click"
        vol.gain.setValueAtTime(0.0001, ahora + cuando);
        vol.gain.exponentialRampToValueAtTime(0.25, ahora + cuando + 0.02);
        vol.gain.exponentialRampToValueAtTime(0.0001, ahora + cuando + 0.14);
        osc.connect(vol).connect(ctx.destination);
        osc.start(ahora + cuando);
        osc.stop(ahora + cuando + 0.16);
      }

      // 400 ms: los dos bips terminan a los 340.
      setTimeout(() => {
        ctx?.suspend().catch(() => {});
        if (s && antes) s.type = antes;
      }, 400);
    } catch {
      /* si el navegador lo bloquea, queda el aviso visual */
    }
  },

  async soltar() {
    try {
      await ctx?.close();
    } catch {
      /* nada que hacer */
    }
    ctx = null;
  },
};
