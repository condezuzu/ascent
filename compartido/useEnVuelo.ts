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
 * TRABA POR IDENTIDAD, NO POR COMPONENTE. Este es el punto fino: una sola traba
 * booleana para todo el componente trabaría también la acción SIGUIENTE distinta
 * —quitar el bloque 1 y después el 2, aceptar dos solicitudes seguidas, anotar
 * dos ejercicios— y perder una escritura legítima EN SILENCIO es peor que la
 * fila duplicada que estamos arreglando. Por eso lo que se traba es una CLAVE:
 * por defecto el primer argumento (el id del bloque, de la solicitud, del
 * amigo), y sin argumentos una sola clave vacía (la acción es una sola). Dos
 * claves distintas nunca se pisan; solo se ignora el REPETIDO de la misma.
 *
 * Se bloquea:
 *   - mientras esa clave está EN VUELO (si la acción devuelve una promesa, hasta
 *     que resuelva), y
 *   - una ventana CORTA después (`ventanaMs`, 350 ms por defecto): lo justo para
 *     el rebote del dedo / el segundo toque de un doble-tap sobre una acción
 *     SINCRÓNICA que ya volvió (el caso de "quitar bloque", que corre sincrónico
 *     y corre la lista). No es un segundo entero: con la clave por identidad, la
 *     acción distinta ya pasa igual, así que la ventana solo cuida el repetido.
 *
 * Devuelve `undefined` cuando ignora un toque; el resto de las veces, lo que
 * devuelva la acción. Una sola llamada a este hook por acción a nivel del
 * componente (no adentro de un `.map`: los hooks no van en loops — para una
 * lista alcanza una traba y la clave decide sobre qué fila actúa).
 */
export function useEnVuelo<A extends unknown[], R>(
  fn: (...args: A) => R | Promise<R>,
  opciones: { ventanaMs?: number; clave?: (...args: A) => string } = {}
): (...args: A) => Promise<R | undefined> {
  const { ventanaMs = 350, clave } = opciones;
  // Todo por refs para que la función envuelta sea estable y no dependa del
  // render: la traba tiene que ser LA MISMA entre renders o no traba nada.
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const claveRef = useRef(clave);
  claveRef.current = clave;
  const ventanaRef = useRef(ventanaMs);
  ventanaRef.current = ventanaMs;
  // Las claves en vuelo (o enfriándose en la ventana). Un Set, no un booleano:
  // así conviven varias acciones distintas a la vez y solo choca el repetido.
  const enVuelo = useRef<Set<string>>(new Set());
  return useCallback(async (...args: A) => {
    const k = claveRef.current ? claveRef.current(...args) : String(args[0] ?? '');
    if (enVuelo.current.has(k)) return undefined;
    enVuelo.current.add(k);
    try {
      return await Promise.resolve(fnRef.current(...args));
    } finally {
      // Se suelta DESPUÉS de la ventana, no al instante: un doble-tap sobre una
      // acción sincrónica ya habría terminado, y sin la ventana el segundo
      // toque volvería a pasar. Solo bloquea ESTA clave.
      setTimeout(() => enVuelo.current.delete(k), ventanaRef.current);
    }
  }, []);
}
