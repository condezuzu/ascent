/**
 * EL NÚMERO QUE CUENTA, sin React: cuándo se cuenta y qué número se muestra en
 * cada instante.
 *
 * Vivía adentro del efecto de `NumeroQueCuenta`, donde no se podía probar. Es
 * poco, pero es la racha: el número más mirado de la app.
 */

/**
 * Un salto más grande que esto no se cuenta: de 3 a 47 serían cuarenta y
 * cuatro números ilegibles pasando. Eso es carga de datos, no un cambio.
 */
export const SALTO_MAXIMO = 12;

/**
 * Si el cambio de `desde` a `hasta` se anima o se reemplaza de una.
 *
 * No se anima: si no cambió, si es un salto grande, si hay "reducir
 * movimiento", o si alguno de los dos números llegó roto — un `NaN` contando
 * sería un número roto en la pantalla durante 700 ms.
 */
export function hayQueContar(desde: number, hasta: number, quieto: boolean): boolean {
  if (quieto) return false;
  if (!Number.isFinite(desde) || !Number.isFinite(hasta)) return false;
  if (desde === hasta) return false;
  return Math.abs(hasta - desde) <= SALTO_MAXIMO;
}

/**
 * El número que se muestra a la fracción `t` (0 a 1) del viaje.
 *
 * Misma curva que `--curva-salida`: llega rápido y se asienta.
 *
 * GARANTÍAS, las tres probadas:
 *  - `t` negativo o roto es `desde`. El primer cuadro de la animación puede
 *    llegar con un tiempo anterior al arranque, y sin acotar eso la curva da
 *    negativo: de 0 a 12 daba -0 en el primer cuadro.
 *  - Nunca se sale del tramo: contando de 46 a 47 no puede aparecer un 48.
 *  - Siempre es entero, y `t ≥ 1` es `hasta` exacto.
 */
export function valorContado(desde: number, hasta: number, t: number): number {
  if (!Number.isFinite(t) || t <= 0) return desde;
  if (t >= 1) return hasta;
  const suave = 1 - Math.pow(1 - t, 3);
  const v = Math.round(desde + (hasta - desde) * suave);
  const bajo = Math.min(desde, hasta);
  const alto = Math.max(desde, hasta);
  // `+ 0` convierte el -0 en 0: `Math.round(-0.36)` es -0, y aunque se pinte
  // igual, compararlo con `Object.is` o serializarlo no da lo mismo.
  return Math.min(alto, Math.max(bajo, v)) + 0;
}
