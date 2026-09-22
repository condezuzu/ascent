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
