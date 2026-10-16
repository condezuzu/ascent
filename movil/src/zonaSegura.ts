import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * EL MARGEN DE ARRIBA DE UNA PANTALLA (15/10): debajo de la hora y de la isla del
 * teléfono, con un respiro. Las pantallas tenían un número fijo, y en Tu rutina y
 * Mis marcas (16) el "Volver" quedaba pegado a la hora, sin poder tocarse.
 * `minimo` es el número de antes: nunca queda más arriba que eso.
 */
export function useArriba(minimo: number): number {
  return Math.max(minimo, useSafeAreaInsets().top + 12);
}
