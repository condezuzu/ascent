import { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { LLENA, MS, sinMovimiento } from './movimiento';

/** UNA BARRA QUE SE LLENA al aparecer (30/10), desde la izquierda. El color y el alto los da `style`. */
export default function Relleno({ fraccion, style }: { fraccion: number; style?: StyleProp<ViewStyle> }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let vivo = true;
    void sinMovimiento().then((quieto) => {
      if (!vivo) return;
      if (quieto) return t.setValue(1);
      Animated.timing(t, { toValue: 1, duration: MS.barra, easing: LLENA, useNativeDriver: true }).start();
    });
    return () => {
      vivo = false;
    };
  }, [t]);
  return <Animated.View style={[style, { width: `${fraccion * 100}%`, transformOrigin: 'left', transform: [{ scaleX: t }] }]} />;
}
