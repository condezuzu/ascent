/**
 * EL PULSO DEL DÍA: el aviso, y la forma de la curva.
 *
 * El aviso vive acá, y no adentro de `FondoEspacial`, porque lo emite la
 * PANTALLA —el momento en que se registró el día— y lo escucha el MOTOR. Si el
 * nombre viviera en cualquiera de los dos, el otro tendría que importar un
 * componente entero para conocer una cadena de texto.
 *
 * Y la curva vive acá porque es una función pura del tiempo, y porque ES DONDE
 * ME EQUIVOQUÉ. La primera versión estaba metida adentro del bucle de
 * animación, donde no se puede probar sin un navegador, y tenía dos errores que
 * se tapaban entre sí: el timestamp de `requestAnimationFrame` llega con el
 * tiempo del COMIENZO del cuadro, que puede ser anterior al `performance.now()`
 * de un instante antes —medido: -3 ms—, así que la altura salía NEGATIVA y el
 * objeto se oscurecía en vez de brillar; y como la condición de seguir era
 * "altura > 0", el bucle se cortaba en el primer cuadro y lo dejaba apagado
 * para siempre.
 *
 * Tres tandas de capturas no encontraron eso. Sacarlo a una función pura y
 * probarlo con números sí.
 */

export const PULSO = 'ascent:pulso';

/** Lo que tarda en encenderse. Corto: la subida rápida es lo que se lee como peso. */
export const SUBIDA_MS = 60;
/** Y lo que tarda en volver. Lento, para que no parezca un parpadeo. */
export const VUELTA_MS = 500;
/** Cuánto sube la luz en el pico, en proporción al brillo de reposo. */
export const ALTURA = 0.45;

/** Cuánto dura el pulso entero. */
export const DURACION_MS = SUBIDA_MS + VUELTA_MS;

/**
 * Cuánto brilla de más el objeto a los `t` milisegundos del disparo, de 0 a 1.
 *
 * Antes del disparo y después del final vale 0 exacto: nunca negativo, nunca
 * un residuo. Un tiempo negativo no es un caso raro que haya que tolerar —es lo
 * que manda el navegador en el primer cuadro— y por eso se acota acá y no en
 * quien llama.
 */
export function alturaDelPulso(t: number): number {
  if (!Number.isFinite(t) || t <= 0) return 0;
  if (t < SUBIDA_MS) return t / SUBIDA_MS;
  if (t >= DURACION_MS) return 0;
  return 1 - (t - SUBIDA_MS) / VUELTA_MS;
}

/** Si todavía queda pulso por dibujar. Se pregunta por el TIEMPO y no por la
 * altura: la altura vale 0 en el primer cuadro Y en el último, así que usarla
 * como condición confunde el arranque con el final. Ese era el otro medio del
 * bug. */
export function siguePulsando(t: number): boolean {
  return t < DURACION_MS;
}
