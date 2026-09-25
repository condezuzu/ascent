/**
 * EL CONTEO DE LA SESIÓN, EN UN SOLO LUGAR.
 *
 * EL PROBLEMA QUE RESUELVE (27/9, reporte del gimnasio: "termino la serie y la
 * última no se suma al contador; pero en la lista sí aparece"). Había dos
 * números que se movían por separado: `series` (el total de la sesión, la única
 * verdad del conteo y de la racha) y `bloques` (la lista de lo hecho). Se
 * tocaban en la misma función pero cada uno leído del closure del render, y con
 * un `await` en el medio dos toques rápidos arrancaban del mismo número viejo:
 * el segundo pisaba al primero y el total quedaba una serie atrás, mientras la
 * lista —por otro camino— llegaba entera. Dos fuentes que pueden discrepar.
 *
 * LA REGLA. El total NO se deriva de los bloques —alguien que nunca elige
 * ejercicio no tiene bloques y su racha no puede depender de eso (regla 3 de
 * `bloques.ts`)—, pero las dos cuentas se mueven SIEMPRE juntas, con la misma
 * función y sobre el mismo objeto. Si el total y la lista salen de acá, no
 * pueden discrepar: no hay dos caminos, hay uno.
 *
 * Estas funciones son PURAS: reciben un `Conteo` y devuelven otro. Quien las
 * usa (`useSesion`) las aplica sobre un ref siempre-al-día, no sobre el estado
 * del render, así dos toques seguidos cada uno ve el número del anterior. Y
 * `test:db` las corre con node pelado, como al resto de `nucleo/`.
 */

import {
  corregirBloque,
  quitarBloque,
  restar,
  sumar,
  type EstadoBloques,
} from './bloques.ts';

/** El total de la sesión y la lista de bloques, que se mueven juntos. */
export type Conteo = {
  /** El total de la sesión: la única verdad del conteo y de la racha. */
  series: number;
  /** La anotación de lo hecho, por bloques. */
  bloques: EstadoBloques;
};

/** Una serie más: sube el total Y la anota en el bloque en curso. */
export function sumarSerie(c: Conteo): Conteo {
  return { series: c.series + 1, bloques: sumar(c.bloques) };
}

/** Una serie menos en el bloque en curso: baja el total (nunca de cero). */
export function restarSerie(c: Conteo): Conteo {
  return { series: Math.max(0, c.series - 1), bloques: restar(c.bloques) };
}

/**
 * Corregir un bloque ya cerrado desde la lista: mover sus series de a una, o
 * sacarlo entero. El total se ajusta por lo que cambió el bloque —no se
 * recalcula desde los bloques—, así que las dos cuentas siguen en línea.
 */
export function corregirEnLista(c: Conteo, indice: number, delta: number | 'quitar'): Conteo {
  const r = delta === 'quitar' ? quitarBloque(c.bloques, indice) : corregirBloque(c.bloques, indice, delta);
  return { series: Math.max(0, c.series + r.cambioEnTotal), bloques: r.estado };
}
