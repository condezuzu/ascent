import { createContext, useContext, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { LLEGA, sinMovimiento } from './movimiento';

/** Sube cada vez que se llega a esta pestaña tocando la barra: es lo que dispara la entrada. */
export const ContextoLlegada = createContext(0);

const VIAJE_PX = 12;
const DURA_MS = 520;

/**
 * LO DE UNA PANTALLA LLEGA EN CASCADA (2/11, «Movimiento» en la galería), de arriba abajo, en vez de
 * estar puesto antes de que la pantalla termine de llegar. Solo al tocar la barra: deslizando, la
 * pantalla ya venía a la vista con el dedo, y volverla a hacer entrar sería un parpadeo.
 */
export default function Entra({ orden = 0, style, children }: { orden?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const llegada = useContext(ContextoLlegada);
  const t = useRef(new Animated.Value(1)).current;
  const quieto = useRef(false);
  useEffect(() => {
    void sinMovimiento().then((q) => {
      quieto.current = q;
    });
  }, []);
  // Antes de pintar: si no, se vería un cuadro puesto y después saldría de la nada.
  useLayoutEffect(() => {
    if (!llegada || quieto.current) return;
    t.setValue(0);
    const anim = Animated.timing(t, { toValue: 1, duration: DURA_MS, delay: 40 + Math.min(orden, 12) * 45, easing: LLEGA, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [llegada, orden, t]);
  return (
    <Animated.View style={[style, { opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [VIAJE_PX, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}
