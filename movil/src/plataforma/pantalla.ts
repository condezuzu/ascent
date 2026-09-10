import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import type { Pantalla } from '@nucleo/plataforma';

/**
 * QUE LA PANTALLA NO SE APAGUE mientras corre el descanso (§18).
 *
 * En web es la Wake Lock API, que existe en Chrome y en Safari 16.4+ y se
 * cae sola cuando la pestaña se esconde. Acá es `expo-keep-awake`, que es lo
 * mismo pero de verdad y sin excepciones por navegador.
 *
 * ES UNA COMODIDAD, NO UN REQUISITO, y por eso `mantenerDespierta` devuelve
 * `false` en vez de tirar: el descanso se calcula siempre contra el timestamp
 * de fin guardado (§18.4), así que si la pantalla se apaga la cuenta sigue
 * bien igual. Lo único que se pierde es no tener que tocar el teléfono.
 *
 * LA ETIQUETA importa: sin ella, dos partes de la app que pidan mantener la
 * pantalla despierta se pisan y la primera en soltar apaga la de la otra.
 */
const ETIQUETA = 'ascent-descanso';

export const pantallaNativa: Pantalla = {
  disponible() {
    return true;
  },

  async mantenerDespierta() {
    try {
      await activateKeepAwakeAsync(ETIQUETA);
      return true;
    } catch {
      return false;
    }
  },

  async soltar() {
    try {
      await deactivateKeepAwake(ETIQUETA);
    } catch {
      /* si no estaba tomada, no hay nada que soltar */
    }
  },
};
