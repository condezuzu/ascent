import { eventos } from '@compartido/eventos';

/**
 * AVISARLE AL MOTOR QUE HAY ALGUIEN MIRANDO.
 *
 * En la web el motor escucha `pointerdown`, `touchstart`, `scroll`… sobre el
 * `window`. En React Native no hay `window` al que colgarse: los toques los ve
 * la vista que los recibe. Por eso la raíz de la app (`Pestanas`) llama esto
 * en cada toque, y el motor —cuando está montado— lo escucha por el bus.
 *
 * Vive aparte y no adentro de `motorNativo.ts` a propósito: la raíz lo importa
 * siempre, y si viniera de ahí arrastraría three.js al arranque de la app, que
 * es justo lo que el motor se cuida de no hacer.
 */
export const DESPERTAR_MOTOR = 'motor:despertar';

export function despertarMotor() {
  eventos.emitir(DESPERTAR_MOTOR);
}
