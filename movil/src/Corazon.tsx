import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { T } from '@nucleo/textos';
import { C } from './colores';

/**
 * EL CORAZÓN DE LA RUTINA DE OTRA PERSONA (20/10). Sin corazones no hay número; con
 * corazones, el número va adentro. Al darlo, estalla como en la galería: late, un anillo
 * que se abre y seis chispas, en 450 ms. Sacarlo no estalla.
 */
const FORMA = 'M50 90 C24 71 5 55 5 34 C5 19 16 8 30 8 C39 8 46 13 50 20 C54 13 61 8 70 8 C84 8 95 19 95 34 C95 55 76 71 50 90 Z';
const ESTALLIDO_MS = 450;
const CHISPAS = Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2);

export default function Corazon({ cantidad, mio, alTocar, tam = 46 }: { cantidad: number; mio: boolean; alTocar: () => void; tam?: number }) {
  const late = useRef(new Animated.Value(1)).current;
  const estallido = useRef(new Animated.Value(0)).current;
  // Cuántas veces estalló: la animación arranca con la capa ya montada (arrancada antes, en
  // el mismo toque, terminaba sola en un cuadro y la capa se iba sin verse).
  const [estallidos, setEstallidos] = useState(0);
  const [estallando, setEstallando] = useState(false);

  useEffect(() => {
    if (estallidos === 0) return;
    late.setValue(1);
    estallido.setValue(0);
    const anim = Animated.parallel([
      Animated.sequence([
        Animated.timing(late, { toValue: 1.3, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(late, { toValue: 1, duration: ESTALLIDO_MS - 150, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
      ]),
      Animated.timing(estallido, { toValue: 1, duration: ESTALLIDO_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => finished && setEstallando(false));
    return () => anim.stop();
  }, [estallidos, late, estallido]);

  async function tocar() {
    const loDa = !mio;
    alTocar();
    if (!loDa || (await AccessibilityInfo.isReduceMotionEnabled().catch(() => false))) return;
    setEstallando(true);
    setEstallidos((n) => n + 1);
  }

  const radio = tam * 1.15;
  return (
    <Pressable
      testID="rutina-corazon"
      hitSlop={10}
      onPress={() => void tocar()}
      accessibilityRole="button"
      accessibilityState={{ selected: mio }}
      accessibilityLabel={`${mio ? T.social.quitarMeGusta : T.social.meGusta} · ${T.social.cuantosMeGusta(cantidad)}`}
      style={{ width: tam, height: tam }}
    >
      <Animated.View style={[estilos.caja, { width: tam, height: tam, transform: [{ scale: late }] }]}>
        <Svg width={tam} height={tam} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
          <Path d={FORMA} fill={mio ? C.corazon : 'rgba(5,6,10,0.72)'} stroke={mio ? C.corazon : C.tinta} strokeWidth={5} strokeLinejoin="round" />
        </Svg>
        {cantidad > 0 && <Text style={[estilos.numero, { color: mio ? C.fondo : C.tinta }]}>{cantidad > 99 ? '99+' : cantidad}</Text>}
      </Animated.View>
      {/* Desde el borde hacia afuera y por encima: son del color del corazón, y sobre él no se veían. */}
      {estallando && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              estilos.anillo,
              { width: tam, height: tam, borderRadius: tam / 2, left: 0, top: 0 },
              { opacity: estallido.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ scale: estallido.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.8] }) }] },
            ]}
          />
          {CHISPAS.map((ang, i) => (
            <Animated.View
              key={i}
              style={[
                estilos.chispa,
                { left: tam / 2 - 2.5, top: tam / 2 - 2.5 },
                {
                  opacity: estallido.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                  transform: [
                    { translateX: estallido.interpolate({ inputRange: [0, 1], outputRange: [Math.cos(ang) * tam * 0.5, Math.cos(ang) * radio] }) },
                    { translateY: estallido.interpolate({ inputRange: [0, 1], outputRange: [Math.sin(ang) * tam * 0.5, Math.sin(ang) * radio] }) },
                    { scale: estallido.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) },
                  ],
                },
              ]}
            />
          ))}
        </View>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  // Sin sombra: en la web y en Android se dibuja con la forma de la caja, un cuadrado detrás del corazón.
  caja: { alignItems: 'center', justifyContent: 'center', paddingBottom: 5 },
  numero: { fontSize: 13, fontWeight: '700' },
  anillo: { position: 'absolute', borderWidth: 2, borderColor: C.corazon },
  chispa: { position: 'absolute', width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.corazon },
});
