import type { Audio } from '../tipos';

// El navegador no expone la categoría de audio del sistema... salvo por la
// Audio Session API, que Safari implementa (experimental) y nadie más.
//
// CAMBIO DE CRITERIO (2026-08-28), pedido después de usar la app en el
// gimnasio de verdad: el aviso tiene que CORTAR la música, no sonar por
// encima. Con auriculares y la música fuerte, un bip que solo atenúa no se
// escucha, y un temporizador de descanso que no se escucha no sirve para
// nada.
//
// Antes se pedía `transient`, que la especificación define como "deberían
// sonar por encima del audio de reproducción y quizá atenuarlo" — el "quizá"
// es exactamente el problema. Ahora se pide `transient-solo`, que INTERRUMPE
// el otro audio mientras suena y lo deja volver solo al terminar.
//
// NO es `playback`. Esa categoría toma el audio como si la app fuera un
// reproductor: corta la música y NO la devuelve. Para un bip de medio segundo
// eso es dejar a alguien en silencio en la mitad de una serie.
//
// Lo que sigue sin poder hacerse en web es sonar con la pantalla bloqueada o
// la app cerrada: eso es nativo (`expo-av`, `interruptionModeIOS: DoNotMix`) y
// está en spec/etapa-nativa.md §13b.
type SesionDeAudio = { type: string };
const sesion = (): SesionDeAudio | null => {
  const n = navigator as Navigator & { audioSession?: SesionDeAudio };
  return typeof navigator !== 'undefined' && n.audioSession ? n.audioSession : null;
};

let ctx: AudioContext | null = null;

export const audioWeb: Audio = {
  // El nombre quedó de cuando el objetivo era NO tocar la música. Hoy lo que
  // contesta es otra cosa: si este teléfono deja manejar la sesión de audio,
  // que es lo que permite cortarla a propósito y devolverla. Sin la API, el
  // bip suena y lo que pase con la música lo decide el sistema operativo.
  //
  // Se renombra cuando se toque el puerto en la migración a nativo: cambiarlo
  // hoy es tocar el contrato de `plataforma` para un solo llamador.
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
      // `transient-solo`: interrumpe la música mientras dura el bip y la deja
      // volver sola. Ver el comentario de arriba para por qué no es
      // `transient` (no se escucha) ni `playback` (no la devuelve).
      if (s) s.type = 'transient-solo';

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
