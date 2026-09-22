/**
 * LOS NÚMEROS DE LAS ANIMACIONES QUE COMPARTEN LAS DOS APPS.
 *
 * Están acá por lo mismo que las reglas del gesto (`nucleo/deslizar.ts`): una
 * entrada que en la web tarda 420 ms y en el teléfono 200 no es la misma app
 * con dos interfaces. La diferencia no se razona, se siente.
 *
 * LA WEB LOS ESCRIBE EN CSS y no puede importar esto —una hoja de estilos no
 * importa TypeScript—, así que los números están dos veces. Para que no se
 * separen en silencio, `test:db` compara `globals.css` contra este archivo: si
 * alguien cambia uno de los dos lados, el test lo canta.
 */

/** Lo que tarda un bloque en entrar. */
export const SURGIR_MS = 420;

/** Cuánto desplazado arranca, en píxeles hacia abajo. */
export const SURGIR_PX = 9;

/** Entre una fila y la siguiente. */
export const ESCALON_MS = 55;

/**
 * A partir de acá entran todas juntas. Sin tope, una lista de cuarenta filas
 * tardaría dos segundos y pico en terminar de aparecer: lo que es un detalle
 * vivo en una lista corta es una app lenta en una larga.
 */
export const ESCALON_TOPE = 12;

/** Lo que espera la primera fila, para que se note que entran en orden. */
export const DEMORA_MS = 60;

/** Cuándo le toca entrar a la fila número `i` (desde 0). */
export function demoraDeEntrada(i: number): number {
  const paso = Math.min(Math.max(0, Math.round(i)), ESCALON_TOPE);
  return paso * ESCALON_MS + DEMORA_MS;
}
