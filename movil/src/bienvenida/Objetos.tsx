import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, RadialGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { RANGOS_DE_LA_ENTRADA } from '@nucleo/bienvenida';
import { paletaDe } from '@nucleo/paletas';

/**
 * EL FONDO DE LA TERCERA EN NATIVO: los objetos de otras rachas flotando lejos.
 * La misma idea que la web (`src/components/bienvenida/Objetos.tsx`): cada objeto
 * es alguien en su punto del camino, y cada uno tiene SU forma —ocho bolas
 * iguales dirían que no se gana nada—. Saturno con anillo, la luna con cráteres,
 * el sol con corona, la roca irregular, la galaxia una elipse, el agujero un aro
 * de luz sobre negro.
 *
 * La web los dibuja con degradados de CSS y `::after`; el teléfono no tiene eso,
 * así que acá van con `react-native-svg` (mismos colores por rango desde
 * `nucleo/paletas`) y flotan con `Animated`. La banda del medio —donde va el
 * texto— se apaga con un velo (en la web es un `mask-image`): un planeta atrás de
 * una palabra la vuelve ilegible.
 */

const LUGARES = [
  { x: 10, y: 20, tam: 30, s: 13 },
  { x: 72, y: 12, tam: 26, s: 17 },
  { x: 30, y: 44, tam: 34, s: 11 },
  { x: 82, y: 46, tam: 52, s: 19 }, // Saturno: el más grande, se tiene que leer
  { x: 6, y: 64, tam: 30, s: 15 },
  { x: 56, y: 70, tam: 44, s: 21 },
  { x: 22, y: 86, tam: 56, s: 12 },
  { x: 76, y: 90, tam: 38, s: 16 },
];

const TIPOS: Record<number, string> = {
  1: 'polvo',
  2: 'roca',
  3: 'luna',
  4: 'saturno',
  5: 'sol',
  6: 'galaxia',
  7: 'agujero',
};

/** El cuerpo redondo de siempre: el degradado claro→principal→apagado. */
function Cuerpo({ pal, r = 24 }: { pal: ReturnType<typeof paletaDe>; r?: number }) {
  return (
    <>
      <Defs>
        <RadialGradient id="cuerpo" cx="43%" cy="40%" r="62%">
          <Stop offset="0" stopColor={pal.claro} />
          <Stop offset="0.52" stopColor={pal.principal} />
          <Stop offset="0.86" stopColor={pal.apagado} />
          <Stop offset="1" stopColor={pal.apagado} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="50" cy="50" r={r} fill="url(#cuerpo)" />
    </>
  );
}

function Forma({ tipo, pal }: { tipo: string; pal: ReturnType<typeof paletaDe> }) {
  if (tipo === 'polvo') {
    return (
      <Svg viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="polvo" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={pal.claro} />
            <Stop offset="0.62" stopColor={pal.claro} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="30" fill="url(#polvo)" opacity={0.8} />
      </Svg>
    );
  }
  if (tipo === 'roca') {
    return (
      <Svg viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="roca" cx="42%" cy="38%" r="62%">
            <Stop offset="0" stopColor={pal.claro} />
            <Stop offset="0.58" stopColor={pal.principal} />
            <Stop offset="1" stopColor={pal.apagado} />
          </RadialGradient>
        </Defs>
        {/* La silueta irregular: un blob, no un círculo. */}
        <G transform="rotate(-14 50 50)">
          <Ellipse cx="50" cy="50" rx="26" ry="23" fill="url(#roca)" />
        </G>
      </Svg>
    );
  }
  if (tipo === 'luna') {
    return (
      <Svg viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Cuerpo pal={pal} />
        {/* Los cráteres: manchas más oscuras sobre la superficie. */}
        <Circle cx="56" cy="42" r="4.2" fill="#000" opacity={0.5} />
        <Circle cx="44" cy="54" r="3.2" fill="#000" opacity={0.45} />
        <Circle cx="52" cy="61" r="2.4" fill="#000" opacity={0.4} />
      </Svg>
    );
  }
  if (tipo === 'saturno') {
    return (
      <Svg viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Cuerpo pal={pal} r={22} />
        {/* El anillo: un óvalo con borde y sin relleno, girado; de frente sería
            un plato. Pasa por delante y por detrás del cuerpo. */}
        <G transform="rotate(-18 50 50)">
          <Ellipse cx="50" cy="50" rx="42" ry="11" fill="none" stroke={pal.claro} strokeWidth="1.6" opacity={0.85} />
        </G>
      </Svg>
    );
  }
  if (tipo === 'sol') {
    return (
      <Svg viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="corona" cx="50%" cy="50%" r="50%">
            <Stop offset="0.42" stopColor={pal.claro} stopOpacity="0.55" />
            <Stop offset="1" stopColor={pal.claro} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {/* La corona sale del cuerpo, no es un borde. */}
        <Circle cx="50" cy="50" r="46" fill="url(#corona)" />
        <Cuerpo pal={pal} r={22} />
      </Svg>
    );
  }
  if (tipo === 'galaxia') {
    return (
      <Svg viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="galaxia" cx="50%" cy="50%" r="50%">
            <Stop offset="0.06" stopColor={pal.claro} />
            <Stop offset="0.26" stopColor={pal.principal} />
            <Stop offset="0.7" stopColor={pal.principal} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {/* Una elipse borrosa con el centro encendido, inclinada. */}
        <G transform="rotate(-24 50 50)">
          <Ellipse cx="50" cy="50" rx="31" ry="13" fill="url(#galaxia)" />
        </G>
      </Svg>
    );
  }
  // agujero: negro adentro, aro de luz afuera.
  return (
    <Svg viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="agujero" cx="50%" cy="50%" r="50%">
          <Stop offset="0.42" stopColor="#000" />
          <Stop offset="0.46" stopColor={pal.principal} />
          <Stop offset="0.52" stopColor={pal.claro} />
          <Stop offset="0.62" stopColor={pal.claro} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="50" cy="50" r="30" fill="url(#agujero)" />
    </Svg>
  );
}

/** Un objeto: la forma dentro de una caja que respira (flota). */
function Objeto({ rango, lugar, quieto }: { rango: number; lugar: (typeof LUGARES)[number]; quieto: boolean }) {
  const { width, height } = useWindowDimensions();
  const t = useRef(new Animated.Value(0)).current;
  const pal = paletaDe(rango);
  const tipo = TIPOS[rango] ?? 'polvo';
  // La caja es más grande que el cuerpo: el anillo de Saturno y la corona del
  // sol se salen del diámetro. El cuerpo ocupa la mitad del viewBox, así que a
  // 2x la caja el cuerpo queda del tamaño pedido.
  const caja = lugar.tam * 2;

  useEffect(() => {
    if (quieto) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: lugar.s * 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: lugar.s * 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [quieto, t, lugar.s]);

  const tx = t.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });
  const ty = t.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        // El centro del cuerpo cae en (x%, y%) de la pantalla; la caja (2× el
        // cuerpo, para que entren anillo y corona) se corre media caja.
        left: (lugar.x / 100) * width - caja / 2,
        top: (lugar.y / 100) * height - caja / 2,
        width: caja,
        height: caja,
        transform: [{ translateX: tx }, { translateY: ty }],
      }}
    >
      <Forma tipo={tipo} pal={pal} />
    </Animated.View>
  );
}

export default function Objetos({ quieto = false }: { quieto?: boolean }) {
  const { width } = useWindowDimensions();
  const objetos = useMemo(
    () => RANGOS_DE_LA_ENTRADA.map((r, i) => ({ r, l: LUGARES[i] })),
    []
  );
  return (
    <View style={estilos.raiz} pointerEvents="none">
      <View style={estilos.capa}>
        {objetos.map(({ r, l }) => (
          <Objeto key={r} rango={r} lugar={l} quieto={quieto} />
        ))}
      </View>
      {/* EL VELO: apaga la banda del medio, donde va el texto (en la web es un
          `mask-image`). Un planeta atrás de una palabra la vuelve ilegible. */}
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(5,6,10,0.72)', 'rgba(5,6,10,0.72)', 'transparent']}
        locations={[0.32, 0.46, 0.66, 0.8]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  // La capa de objetos, atenuada como en la web (opacity 0.45).
  capa: { ...StyleSheet.absoluteFillObject, opacity: 0.45 },
});
