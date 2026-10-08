import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';
import { GOLPES, PAUSA_MS } from '@nucleo/avisoDescanso';
import type { Haptica } from '@nucleo/plataforma';

/**
 * VIBRACIÓN — y acá está la mitad de la razón de migrar, en tres líneas.
 *
 * En web, `navigator.vibrate` no existe en iPhone y no va a existir: WebKit
 * nunca implementó la API (§18.7). O sea que el aviso de fin de descanso, con
 * el teléfono en el bolsillo, no llegaba de ninguna forma en el único teléfono
 * que importa acá.
 *
 * Nativo no solo puede vibrar: puede elegir CÓMO. Se usa el impacto medio y no
 * el pesado —el pesado se siente como una alarma— y no el de notificación,
 * que en iOS es un patrón de tres golpes pensado para avisos del sistema.
 * Esto es un golpe corto que dice "ya está".
 *
 * SIGUE DEVOLVIENDO BOOLEANO Y SIGUE SIN TIRAR, igual que en web: quien lo
 * llama no tiene que saber en qué teléfono está.
 */
export const hapticaNativa: Haptica = {
  disponible() {
    // En web dentro de Expo no hay motor háptico; en los dos teléfonos sí.
    return Platform.OS === 'ios' || Platform.OS === 'android';
  },

  pulso() {
    if (!this.disponible()) return false;
    // No se espera: es un efecto, no un dato. Si falla —modo de bajo consumo,
    // teléfono sin motor— no pasa nada y la app no se entera.
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    return true;
  },

  // LA VIBRACIÓN DE VERDAD, no el golpecito háptico (8/10): es la que se siente
  // con el teléfono en el bolsillo. El patrón se lee distinto en cada sistema:
  // en iOS cada vibración dura lo suyo (~0,4 s) y los números son ESPERAS
  // entre el arranque de una y el de la otra; en Android alternan espera y
  // duración. SOLO SE PUEDE COMPROBAR EN EL TELÉFONO.
  aviso() {
    if (!this.disponible()) return false;
    try {
      const esperas = Array.from({ length: GOLPES - 1 }, () => PAUSA_MS);
      Vibration.vibrate(Platform.OS === 'ios' ? [0, ...esperas] : [0, 400, ...esperas.flatMap(() => [PAUSA_MS - 400, 400])]);
    } catch {
      return this.pulso();
    }
    return true;
  },
};
