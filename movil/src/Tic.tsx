import { useEffect, useRef, type ReactNode } from 'react';
import { Animated } from 'react-native';
import { LLEGA, MS, sinMovimiento } from './movimiento';

/** UN NÚMERO QUE CAMBIÓ da un salto chico (30/10): se ve que contó sin tener que leerlo de nuevo. */
export default function Tic({ valor, children }: { valor: number; children: ReactNode }) {
  const antes = useRef(valor);
  const escala = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (antes.current === valor) return;
    antes.current = valor;
    void sinMovimiento().then((quieto) => {
      if (quieto) return;
      escala.setValue(1.16);
      Animated.timing(escala, { toValue: 1, duration: MS.tic, easing: LLEGA, useNativeDriver: true }).start();
    });
  }, [valor, escala]);
  return <Animated.View style={{ transform: [{ scale: escala }] }}>{children}</Animated.View>;
}
