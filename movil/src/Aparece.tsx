import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';

/**
 * LO QUE ENTRA EN PANTALLA NO EMPUJA DE UN SALTO (26/10, a pedido). Crece desde alto cero
 * hasta el suyo mientras aparece, así lo de abajo baja acompañando en vez de saltar. Al
 * terminar suelta el alto: si después cambia (un texto que pasa a dos renglones), sigue solo.
 *
 * Los márgenes del hijo quedan adentro de lo que se mide, así que se envuelve tal cual está.
 * Con «reducir movimiento» aparece en el acto.
 */
export default function Aparece({ children, duracion = 280, testID }: { children: ReactNode; duracion?: number; testID?: string }) {
  const [alto, setAlto] = useState<number | null>(null);
  const [listo, setListo] = useState(false);
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (alto === null || listo) return;
    let vivo = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((quieto) => {
        if (!vivo) return;
        // El alto no va por el motor nativo: se anima en JS, como el resto de los altos de la app.
        Animated.timing(t, { toValue: 1, duration: quieto ? 0 : duracion, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(({ finished }) => {
          if (finished && vivo) setListo(true);
        });
      });
    return () => {
      vivo = false;
    };
    // Arranca una vez, cuando se midió por primera vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alto === null]);

  if (listo) return <View testID={testID}>{children}</View>;
  return (
    <Animated.View
      testID={testID}
      style={{
        overflow: 'hidden',
        height: alto === null ? 0 : t.interpolate({ inputRange: [0, 1], outputRange: [0, alto] }),
        opacity: t,
        transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
      }}
    >
      <View onLayout={(e) => setAlto(e.nativeEvent.layout.height)}>{children}</View>
    </Animated.View>
  );
}
