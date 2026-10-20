import { useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { T } from '@nucleo/textos';
import { C } from './colores';

/**
 * EL CORAZÓN DE LA FOTO ABIERTA (19/10, en lugar del fueguito de la galería). Sin
 * corazones no hay número; con corazones, el número va adentro. Sin `alTocar` es solo
 * la cuenta: la foto propia, que no se da corazón a sí misma.
 */
const FORMA = 'M50 90 C24 71 5 55 5 34 C5 19 16 8 30 8 C39 8 46 13 50 20 C54 13 61 8 70 8 C84 8 95 19 95 34 C95 55 76 71 50 90 Z';
const TAM = 50;

export default function Corazon({ cantidad, mio, alTocar }: { cantidad: number; mio: boolean; alTocar?: () => void }) {
  const late = useRef(new Animated.Value(1)).current;
  const dibujo = (
    <Animated.View style={[estilos.caja, { transform: [{ scale: late }] }]}>
      <Svg width={TAM} height={TAM} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Path d={FORMA} fill={mio ? C.corazon : 'rgba(5,6,10,0.72)'} stroke={mio ? C.corazon : C.tinta} strokeWidth={5} strokeLinejoin="round" />
      </Svg>
      {cantidad > 0 && <Text style={[estilos.numero, { color: mio ? C.fondo : C.tinta }]}>{cantidad > 99 ? '99+' : cantidad}</Text>}
    </Animated.View>
  );
  if (!alTocar) {
    return (
      <View testID="foto-corazon" accessible accessibilityLabel={T.social.cuantosMeGusta(cantidad)}>
        {dibujo}
      </View>
    );
  }
  return (
    <Pressable
      testID="foto-corazon"
      hitSlop={10}
      accessibilityRole="button"
      accessibilityState={{ selected: mio }}
      accessibilityLabel={`${mio ? T.social.quitarMeGusta : T.social.meGusta} · ${T.social.cuantosMeGusta(cantidad)}`}
      onPress={() => {
        late.setValue(1);
        Animated.sequence([
          Animated.timing(late, { toValue: 1.35, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(late, { toValue: 1, duration: 290, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
        ]).start();
        alTocar();
      }}
    >
      {dibujo}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  // Sin sombra: en la web y en Android se dibuja con la forma de la caja, un cuadrado detrás del corazón.
  caja: { width: TAM, height: TAM, alignItems: 'center', justifyContent: 'center', paddingBottom: 5 },
  numero: { fontSize: 14, fontWeight: '700' },
});
