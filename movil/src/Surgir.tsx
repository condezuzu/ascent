import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { demoraDeEntrada, SURGIR_MS, SURGIR_PX } from '@nucleo/animacion';
import { CURVA } from '@nucleo/deslizar';

/**
 * LO QUE ENTRA, ENTRA: opacidad y nueve píxeles desde abajo.
 *
 * POR QUÉ, Y NO ES ADORNO. La pantalla caía entera de golpe apenas llegaban
 * los datos, y de golpe se lee como un parpadeo: no se sabe si algo cambió o
 * si la app se reinició. Escalonado se lee como una lista que se escribe, y de
 * paso tapa que las filas no llegan todas en el mismo instante.
 *
 * LOS NÚMEROS SALEN DE `nucleo/animacion.ts`, los mismos que usa la web en
 * CSS: 420 ms, 9 px, 55 ms entre filas y todas juntas a partir de la
 * duodécima, para que una lista larga no tarde en aparecer.
 *
 * CON "REDUCIR MOVIMIENTO" APARECE PUESTO, sin viaje: el ajuste del sistema
 * existe para quien el movimiento le hace mal, y una entrada linda no vale
 * eso.
 */
export default function Surgir({
  indice = 0,
  style,
  children,
}: {
  /** La posición en la lista: de ahí sale cuándo le toca entrar. */
  indice?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((quieto) => {
        if (!vivo) return;
        if (quieto) return t.setValue(1);
        Animated.timing(t, {
          toValue: 1,
          duration: SURGIR_MS,
          delay: demoraDeEntrada(indice),
          easing: Easing.bezier(...CURVA),
          useNativeDriver: true,
        }).start();
      });
    return () => {
      vivo = false;
    };
  }, [indice, t]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [SURGIR_PX, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
