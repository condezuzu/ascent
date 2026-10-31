import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

const PressableAnimado = Animated.createAnimatedComponent(Pressable);

/**
 * UN BOTÓN QUE SE HUNDE AL TOCARLO (26/10, las microanimaciones): baja un poco con el dedo
 * y vuelve con un rebote corto. Es un Pressable más; el estilo va fijo (sin la función de
 * `pressed`), porque la respuesta al toque es esto.
 */
export default function Tocable({
  style,
  hundir,
  onPressIn,
  onPressOut,
  onLayout,
  ...resto
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; hundir?: number }) {
  const escala = useRef(new Animated.Value(1)).current;
  const ancho = useRef(0);
  const ir = (a: number, rebote: number) => Animated.spring(escala, { toValue: a, speed: 40, bounciness: rebote, useNativeDriver: true }).start();
  return (
    <PressableAnimado
      {...resto}
      style={[StyleSheet.flatten(style), { transform: [{ scale: escala }] }]}
      onLayout={(e) => {
        ancho.current = e.nativeEvent.layout.width;
        onLayout?.(e);
      }}
      onPressIn={(e) => {
        // Lo ancho se hunde menos: una fila entera a 0,95 se correría 18 puntos por lado.
        ir(hundir ?? (ancho.current > 200 ? 0.98 : 0.95), 0);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        ir(1, 8);
        onPressOut?.(e);
      }}
    />
  );
}
