import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { C } from './colores';

/**
 * EL INTERRUPTOR DE LA APP, no el de Apple (item 4).
 *
 * El `Switch` de React Native trae el verde de iOS y su forma: se nota que es
 * prestado. Este usa el MISMO lenguaje que el resto —el prendido es el
 * off-white `claro` con la perilla oscura, igual que el chip "listo" de Inicio
 * y los botones sólidos— así que un toggle prendido se lee igual que cualquier
 * otra cosa activa de la app. La perilla se desliza; nada de verde.
 */
export default function Interruptor({
  value,
  onValueChange,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  accessibilityLabel?: string;
}) {
  const t = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: value ? 1 : 0, duration: 160, useNativeDriver: false }).start();
  }, [value, t]);

  const izq = t.interpolate({ inputRange: [0, 1], outputRange: [3, 23] });
  const fondo = t.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.04)', C.claro],
  });
  const perilla = t.interpolate({
    inputRange: [0, 1],
    outputRange: [C.sub, C.fondo],
  });

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      hitSlop={10}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[estilos.via, { backgroundColor: fondo }]}>
        <Animated.View style={[estilos.perilla, { left: izq, backgroundColor: perilla }]} />
      </Animated.View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  via: {
    width: 46,
    height: 26,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    justifyContent: 'center',
  },
  perilla: { position: 'absolute', width: 20, height: 20, borderRadius: 999 },
});
