/**
 * CUÁNDO UN ARRASTRE CAMBIA DE PESTAÑA.
 *
 * Las reglas viven acá y no en cada app porque el gesto tiene que sentirse
 * IGUAL en las dos: si en la web hay que arrastrar un quinto de la pantalla y
 * en el teléfono la mitad, no es la misma app con dos interfaces, son dos apps.
 *
 * Las dos formas de cambiar, y las dos hacen falta:
 *   - **arrastrar lejos**: pasar del umbral y soltar, sin importar la
 *     velocidad. Es el gesto de quien mira mientras arrastra.
 *   - **tirar rápido**: un golpe corto pero veloz. Sin esto, el gesto natural
 *     de pasar de pantalla —rápido y de dos centímetros— no hacía nada, que se
 *     siente como que la app no escuchó.
 */

/** Fracción del ancho a partir de la cual se cambia. */
export const UMBRAL = 0.22;

/** px/ms: un gesto rápido cambia aunque sea corto. */
export const VELOCIDAD_MIN = 0.35;

/** Lo que tarda el viaje al soltar. */
export const VIAJE_MS = 340;

/**
 * La curva del viaje: sale disparada y frena de a poco. Es la misma que usa
 * la web en CSS; en nativo se arma con `Easing.bezier(...CURVA)`.
 */
export const CURVA = [0.16, 1, 0.3, 1] as const;

/**
 * Si soltar acá cambia de pestaña.
 *
 * `dx` es lo arrastrado en píxeles (negativo hacia la izquierda) y `velocidad`
 * en px/ms con el mismo signo. `ancho` es el de la pantalla.
 *
 * LA VELOCIDAD SE MIRA CON SU SIGNO, no en valor absoluto: un tirón rápido
 * hacia el otro lado —el que arrepiente el gesto sobre el final— no puede
 * contar como que se quiso ir para allá.
 */
export function cambiaDePestana(dx: number, ancho: number, velocidad: number): boolean {
  if (ancho <= 0 || dx === 0) return false;
  const haciaLaIzquierda = dx < 0;
  const lejos = Math.abs(dx) >= ancho * UMBRAL;
  const rapido = haciaLaIzquierda ? velocidad <= -VELOCIDAD_MIN : velocidad >= VELOCIDAD_MIN;
  return lejos || rapido;
}

/**
 * A qué pestaña se va desde `indice` arrastrando `dx`, o `null` si de ese lado
 * no hay nada. En los extremos no se da la vuelta: la primera y la última son
 * paredes, y rebotar contra una dice dónde estás.
 */
export function vecina(indice: number, dx: number, total: number): number | null {
  const destino = dx < 0 ? indice + 1 : indice - 1;
  return destino < 0 || destino >= total ? null : destino;
}

/**
 * DÓNDE DESCANSA LA TIRA con la pestaña `indice` al frente: Inicio en 0 y cada
 * una un ancho más a la izquierda.
 */
export function reposo(indice: number, ancho: number): number {
  return 0 - indice * ancho;
}

/** Contra el borde —no hay pestaña de ese lado— la tira cede un cuarto del dedo. */
const CEDE_EN_EL_BORDE = 0.25;

/**
 * MIENTRAS SE ARRASTRA: cuál asoma y dónde va la tira.
 *
 * `indice` es la pestaña en la que la tira ESTÁ O A LA QUE ESTÁ YENDO, que
 * durante un viaje no es "la activa". Esa diferencia fue el titileo al deslizar
 * rápido (3/10): el gesto partía de la activa, que cambia recién cuando el
 * viaje termina, y un segundo gesto en ese rato colocaba la tira en la pestaña
 * de antes. Quien llama le pasa el rumbo, no lo que se está dibujando.
 */
export function arrastre(indice: number, dx: number, ancho: number, total: number): { asoma: number | null; x: number } {
  const asoma = vecina(indice, dx, total);
  return { asoma, x: reposo(indice, ancho) + (asoma === null ? dx * CEDE_EN_EL_BORDE : dx) };
}

/** AL SOLTAR: en qué pestaña queda la tira. La misma si el gesto no alcanzó. */
export function alSoltar(indice: number, dx: number, ancho: number, velocidad: number, total: number): number {
  const destino = vecina(indice, dx, total);
  return destino !== null && cambiaDePestana(dx, ancho, velocidad) ? destino : indice;
}

/**
 * LA LUZ DE LA BARRA SALE DE LA TIRA (3/10).
 *
 * Cuánto se enciende el rótulo de cada pestaña según DÓNDE ESTÁ LA TIRA: entera
 * cuando la tira descansa en esa pestaña, apagada a un ancho de distancia, y en
 * el medio lo que corresponda. Devuelve los dos rangos de una interpolación:
 * posiciones de la tira (`entrada`, de menor a mayor) y opacidad (`salida`).
 *
 * POR QUÉ ASÍ. La luz seguía a la pestaña activa, que es estado: al deslizar
 * llegaba 340 ms tarde —al terminar el viaje— y encima esperaba a que se
 * redibujaran todas las pantallas. Atada a la posición de la tira no espera a
 * nadie, acompaña al dedo, y NO SE PUEDE DESINCRONIZAR de lo que se ve: no es
 * un estado aparte que alguien tenga que acordarse de mover. Esa es la
 * propiedad que faltó cuando se rompió el titileo.
 *
 * EN LOS BORDES LA LUZ NO SE APAGA: contra el borde la tira cede un poco
 * (`arrastre`), y sin esto Inicio se oscurecería al tirar hacia la derecha.
 */
export function luzDePestana(indice: number, total: number, ancho: number): { entrada: number[]; salida: number[] } {
  const aca = reposo(indice, ancho);
  // Un ancho de cero dejaría los tres puntos iguales, y la interpolación los
  // quiere en orden.
  const paso = Math.max(1, ancho);
  if (total <= 1) return { entrada: [aca - paso, aca], salida: [1, 1] };
  if (indice === 0) return { entrada: [aca - paso, aca], salida: [0, 1] };
  if (indice === total - 1) return { entrada: [aca, aca + paso], salida: [1, 0] };
  return { entrada: [aca - paso, aca, aca + paso], salida: [0, 1, 0] };
}
