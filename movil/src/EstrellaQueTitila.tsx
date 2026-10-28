import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import Estrella, { type ModoDeEstrella } from './Estrella';

// El titileo aprobado en la galería para el aviso de la vida (RachaSalvada): 2400 ms la vuelta,
// y cada estrella un tercio de vuelta después de la anterior.
const CICLO_MS = 2400;

/**
 * UNA VIDA QUE TITILA (28/10, a pedido): la de Inicio y la de Stats, como la del aviso. Titila
 * solo la que queda; la usada y la que falta ganar se quedan quietas. Con «reducir movimiento», quieta.
 */
export default function EstrellaQueTitila({ modo, indice, tam = 16 }: { modo: ModoDeEstrella; indice: number; tam?: number }) {
  const t = useRef(new Animated.Value(0)).current;
  const titila = modo !== 'apagada' && modo !== 'porGanar';
  useEffect(() => {
    if (!titila) return;
    let vuelta: Animated.CompositeAnimation | null = null;
    let espera: ReturnType<typeof setTimeout> | null = null;
    let vivo = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((quieto) => {
        if (!vivo || quieto) return;
        vuelta = Animated.loop(
          Animated.sequence([
            Animated.timing(t, { toValue: 1, duration: CICLO_MS / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(t, { toValue: 0, duration: CICLO_MS / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ]),
        );
        espera = setTimeout(() => vuelta?.start(), indice * (CICLO_MS / 3));
      });
    return () => {
      vivo = false;
      if (espera) clearTimeout(espera);
      vuelta?.stop();
    };
  }, [titila, indice, t]);
  if (!titila) return <Estrella tam={tam} modo={modo} />;
  return (
    <Animated.View
      style={{
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.08] }) }],
      }}
    >
      <Estrella tam={tam} modo={modo} />
    </Animated.View>
  );
}
