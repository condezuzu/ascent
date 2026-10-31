import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, View } from 'react-native';
import { DESPLAZA, LLEGA, MS, SE_VA, sinMovimiento } from './movimiento';

/**
 * LO QUE ENTRA EN PANTALLA NO EMPUJA DE UN SALTO (26/10, a pedido). Crece desde alto cero
 * hasta el suyo mientras aparece, así lo de abajo baja acompañando en vez de saltar. Al
 * terminar suelta el alto: si después cambia (un texto que pasa a dos renglones), sigue solo.
 *
 * Y SE VA IGUAL, MÁS CORTO (30/10): con `visible` en falso se encoge y recién ahí desaparece, con lo
 * último que mostraba. Lo que se iba, se cortaba.
 *
 * Los márgenes del hijo quedan adentro de lo que se mide, así que se envuelve tal cual está.
 * Con «reducir movimiento» aparece en el acto.
 */
export default function Aparece({
  children,
  duracion = MS.entra,
  testID,
  visible = true,
}: {
  children: ReactNode;
  duracion?: number;
  testID?: string;
  visible?: boolean;
}) {
  const [montado, setMontado] = useState(visible);
  const ultimo = useRef(children);
  if (visible) ultimo.current = children;
  const [alto, setAlto] = useState<number | null>(null);
  const [listo, setListo] = useState(false);
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (alto === null || listo) return;
    let vivo = true;
    void sinMovimiento()
      .then((quieto) => {
        if (!vivo) return;
        // El alto no va por el motor nativo: se anima en JS, como el resto de los altos de la app.
        Animated.timing(t, { toValue: 1, duration: quieto ? 0 : duracion, easing: LLEGA, useNativeDriver: false }).start(({ finished }) => {
          if (finished && vivo) setListo(true);
        });
      });
    return () => {
      vivo = false;
    };
    // Arranca una vez, cuando se midió por primera vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alto === null]);

  // La salida: del alto que tenía a cero.
  useEffect(() => {
    if (visible) {
      setMontado(true);
      return;
    }
    if (!montado) return;
    let vivo = true;
    setListo(false);
    void sinMovimiento().then((quieto) => {
      if (!vivo) return;
      Animated.timing(t, { toValue: 0, duration: quieto ? 0 : MS.sale, easing: SE_VA, useNativeDriver: false }).start(({ finished }) => {
        if (finished && vivo) {
          setMontado(false);
          setAlto(null);
        }
      });
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!montado && !visible) return null;
  if (listo) return <View testID={testID}>{ultimo.current}</View>;
  return (
    <Animated.View
      testID={testID}
      style={{
        overflow: 'hidden',
        height: alto === null ? 0 : t.interpolate({ inputRange: [0, 1], outputRange: [0, alto] }),
        opacity: t,
        transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-DESPLAZA, 0] }) }],
      }}
    >
      <View onLayout={(e) => setAlto(e.nativeEvent.layout.height)}>{ultimo.current}</View>
    </Animated.View>
  );
}
