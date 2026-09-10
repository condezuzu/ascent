import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
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
};
