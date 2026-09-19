/**
 * CUÁNDO EL MOTOR NO TIENE QUE DIBUJAR.
 *
 * El fondo es la única pieza de la app que trabaja cuando nadie hace nada.
 * Todo lo demás reacciona a un toque; el motor dibuja sesenta cuadros por
 * segundo mientras mirás tu racha, mientras leés, y mientras el teléfono está
 * boca arriba sobre el banco entre serie y serie.
 *
 * YA SE PAUSA CON LA APP ATRÁS (`plataforma.ciclo.alCambiar`). Lo que falta es
 * el caso de la app abierta y la pantalla quieta, que en un gimnasio es la
 * mayor parte del tiempo.
 *
 * POR QUÉ NO ES UN FRENO SECO. "No tocar" no es "no mirar". Si te quedás
 * mirando el fondo y la galaxia se congela de golpe, eso se ve, y parece que
 * la app se colgó. Entonces son tres escalones y no dos:
 *
 *   VIVO   — sesenta por segundo, mientras hay actividad y tres segundos más.
 *   LENTO  — doce por segundo. El fondo gira a 0,022 rad/s: a doce cuadros son
 *            0,1 grados por cuadro. No hay forma de ver el escalón, y se deja
 *            de hacer el 80% del trabajo de GPU.
 *   QUIETO — nada, al minuto sin tocar. A esa altura el teléfono está en el
 *            bolsillo o la persona se fue.
 *
 * HACIA DÓNDE SE FALLA. Si el número que llega no tiene sentido —un NaN, un
 * negativo porque dos relojes no son el mismo reloj— se DIBUJA. Un cuadro de
 * más no se nota; un fondo congelado por una resta mal hecha parece una app
 * rota, y encima no se arregla solo. Es la misma familia del bug de "seguí
 * mientras sea mayor que cero" que un negativo corta para siempre.
 *
 * Eso incluye a Infinity, que no es finito y por lo tanto sale como VIVO
 * aunque "infinito tiempo sin tocar" suene a quieto. Es a propósito: un
 * Infinity acá no significa que pasó mucho tiempo, significa que alguien
 * dividió por cero. No es un dato, es un síntoma, y ante un síntoma se
 * dibuja.
 *
 * Esto es aritmética y por eso vive acá y no en `motor/`: las capturas no
 * pueden ver una animación, pero sí pueden verificar esta decisión.
 */

/** Sin tocar durante esto, se baja a pocos cuadros por segundo. */
export const ESPERA_LENTO_MS = 3_000;

/** Sin tocar durante esto, se deja de dibujar del todo. */
export const ESPERA_QUIETO_MS = 60_000;

/** Cuántos cuadros por segundo se dibujan en el escalón del medio. */
export const CUADROS_LENTOS = 12;

export const MS_ENTRE_CUADROS_LENTOS = 1000 / CUADROS_LENTOS;

/**
 * EL MARGEN, y no es un detalle: sin él se dibujan diez cuadros por segundo
 * en vez de doce.
 *
 * La pantalla ofrece cuadros cada 16,67 ms. Doce por segundo es uno de cada
 * cinco, o sea 83,33 ms —justo el umbral—, pero esa cuenta en coma flotante
 * cae un pelo por debajo y el cuadro se saltea: hay que esperar al sexto, que
 * son 100 ms, y el resultado es diez por segundo.
 *
 * Dos milisegundos de margen lo resuelven sin tocar nada más, y además
 * funcionan igual en una pantalla de 90 o 120 Hz. Lo encontró el test que
 * cuenta cuadros en un segundo simulado, no el ojo.
 */
export const MARGEN_MS = 2;

export type PasoDeQuietud = 'vivo' | 'lento' | 'quieto';

export function pasoDeQuietud(msSinTocar: number): PasoDeQuietud {
  // El orden importa: un negativo o un NaN caen acá y salen como 'vivo'.
  if (!Number.isFinite(msSinTocar) || msSinTocar < ESPERA_LENTO_MS) return 'vivo';
  if (msSinTocar < ESPERA_QUIETO_MS) return 'lento';
  return 'quieto';
}

/**
 * La decisión de UN cuadro. `msDesdeElCuadro` es cuánto pasó desde el último
 * que SÍ se dibujó, no desde el último que pidió el navegador: es lo que
 * mantiene constante la velocidad del movimiento al bajar de escalón.
 */
/**
 * Con algo que se mueve RÁPIDO en la escena, el escalón lento dibuja a esto
 * (19/9). Los doce por segundo se decidieron para el giro del fondo, 0,022
 * rad/s, donde el escalón no se ve. Una luna va a 0,30 rad/s: a doce cuadros
 * salta unos 12 px por cuadro, y "la luna va a pocos fps" era eso. Treinta ya
 * se ve continuo y sigue siendo la mitad del trabajo.
 */
export const CUADROS_LENTOS_CON_MOVIMIENTO = 30;
export const MS_ENTRE_CUADROS_CON_MOVIMIENTO = 1000 / CUADROS_LENTOS_CON_MOVIMIENTO;

export function debeDibujar(msSinTocar: number, msDesdeElCuadro: number, hayMovimiento = false): boolean {
  const paso = pasoDeQuietud(msSinTocar);
  if (paso === 'vivo') return true;
  if (paso === 'quieto') return false;
  if (!Number.isFinite(msDesdeElCuadro)) return true;
  const entre = hayMovimiento ? MS_ENTRE_CUADROS_CON_MOVIMIENTO : MS_ENTRE_CUADROS_LENTOS;
  return msDesdeElCuadro >= entre - MARGEN_MS;
}
