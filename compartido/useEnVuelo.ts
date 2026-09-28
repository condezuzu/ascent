import { useCallback, useRef } from 'react';

/**
 * UNA TRABA CONTRA EL DOBLE-TAP, de verdad, para acciones que ESCRIBEN.
 *
 * El bug: casi todas las guardas de la app son de ESTADO —`disabled={ocupado}`
 * con `setOcupado(true)` antes del `await`—, y eso recién frena en el próximo
 * render. Un segundo toque que cae antes de ese render pasa igual: así se
 * duplicaban la marca, la foto del día, y se borraba el bloque equivocado. La
 * única guarda que servía era una `useRef` síncrona (la de contar series), y de
 * ahí salió justamente el bug de la última serie.
 *
 * Esto envuelve una acción y garantiza que no corra dos veces pisándose:
 *   - Mientras la acción está EN VUELO (si devuelve una promesa, hasta que
 *     resuelva), un segundo toque se ignora.
 *   - Y un ratito MÁS (`ventanaMs`) después de terminar, para cubrir el segundo
 *     toque de un doble-tap aunque la acción sea sincrónica y ya haya vuelto
 *     (ese es el caso de "quitar bloque", que corre sincrónico y corre la lista).
 *
 * La traba es un `useRef`: síncrona, no espera al render. Devuelve la función
 * envuelta; se llama igual que la original. Una sola por acción a nivel del
 * componente (no adentro de un `.map`: los hooks no van en loops — para una lista
 * alcanza una traba y el argumento decide sobre qué fila actúa).
 */
export function useEnVuelo<A extends unknown[], R>(
  fn: (...args: A) => R | Promise<R>,
  ventanaMs = 400
): (...args: A) => Promise<R | undefined> {
  const enVuelo = useRef(false);
  return useCallback(
    async (...args: A) => {
      if (enVuelo.current) return undefined;
      enVuelo.current = true;
      try {
        return await Promise.resolve(fn(...args));
      } finally {
        // Se suelta DESPUÉS de la ventana, no al instante: un doble-tap sobre una
        // acción sincrónica ya habría terminado, y sin la ventana el segundo
        // toque volvería a pasar.
        setTimeout(() => {
          enVuelo.current = false;
        }, ventanaMs);
      }
    },
    [fn, ventanaMs]
  );
}
