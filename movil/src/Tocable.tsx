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
  hundir = 0.95,
  onPressIn,
  onPressOut,
  ...resto
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; hundir?: number }) {
  const escala = useRef(new Animated.Value(1)).current;
  const ir = (a: number, rebote: number) => Animated.spring(escala, { toValue: a, speed: 40, bounciness: rebote, useNativeDriver: true }).start();
  return (
    <PressableAnimado
      {...resto}
      style={[StyleSheet.flatten(style), { transform: [{ scale: escala }] }]}
      onPressIn={(e) => {
        ir(hundir, 0);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        ir(1, 8);
        onPressOut?.(e);
      }}
    />
  );
}
