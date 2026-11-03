import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { T } from '@nucleo/textos';
import { MOSS } from './coloresDeMoss';
import { taparElFondo } from './desenfoqueDelFondo';
import { cargarFuentesDeMoss, LETRAS_DE_MOSS } from './fuentes';
import { LLEGA, SE_VA, sinMovimiento } from './movimiento';
import { Text } from './Texto';
import Tocable from './Tocable';

/** Cuánto hay que tirar para abajo, desde el tope de Stats, para entrar. */
export const TIRON_PARA_ENTRAR = 96;
const ENTRA_MS = 720;
const SALE_MS = 420;

// La constelación: puntos en una caja de 260×190 y qué par une cada línea.
const ESTRELLAS: [number, number, number][] = [
  [28, 142, 2.2], [78, 92, 2.8], [132, 118, 2], [176, 52, 3.2], [226, 84, 2.2], [150, 164, 1.8],
];
const LINEAS: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5]];

/**
 * EL CIELO DE MOSS (2/11, a pedido): lo que hay del otro lado de Stats. Todavía no está hecho, y lo dice:
 * «Pronto». Con los colores y las letras de Moss (`src/tema.ts` de esa app), que no son los de Ascent: es
 * otro lugar, y tiene que notarse. El borde de abajo es un horizonte de oro, que es lo que se ve bajar.
 */
function CieloDeMoss({ avance, alto }: { avance: Animated.Value | Animated.AnimatedInterpolation<number>; alto: number }) {
  const aparece = (avance as Animated.Value).interpolate({ inputRange: [0.25, 0.8], outputRange: [0, 1], extrapolate: 'clamp' });
  return (
    <View style={[estilos.cielo, { height: alto }]}>
      <LinearGradient colors={[MOSS.noche0, MOSS.noche1, MOSS.noche2, MOSS.noche3]} locations={[0, 0.45, 0.82, 1]} style={StyleSheet.absoluteFill} />
      {/* El verde de Moss, abajo: un musgo que apenas se ve. */}
      <LinearGradient colors={['transparent', MOSS.musgoTenue]} locations={[0.68, 1]} style={StyleSheet.absoluteFill} />
      <Animated.View style={[estilos.centro, { opacity: aparece, transform: [{ translateY: aparece.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>
        <Svg width={260} height={190} viewBox="0 0 260 190">
          {LINEAS.map(([a, b]) => (
            <Line key={`${a}-${b}`} x1={ESTRELLAS[a][0]} y1={ESTRELLAS[a][1]} x2={ESTRELLAS[b][0]} y2={ESTRELLAS[b][1]} stroke={MOSS.oro} strokeOpacity={0.35} strokeWidth={1} />
          ))}
          {ESTRELLAS.map(([x, y, r]) => (
            <Circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={MOSS.oroClaro} />
          ))}
        </Svg>
        <Text style={estilos.nombre}>{T.moss.nombre}</Text>
        <Text testID="moss-pronto" style={estilos.pronto}>
          {T.moss.pronto}
        </Text>
      </Animated.View>
      {/* El horizonte que baja. */}
      <LinearGradient colors={['transparent', MOSS.oroBrillo]} style={estilos.brillo} />
      <View style={estilos.horizonte} />
    </View>
  );
}

/**
 * LA ENTRADA A MOSS, ARRIBA DE STATS (2/11, a pedido). Dos cosas la hacen obvia: la flecha que sube y
 * el renglón con las letras de Moss, y que al tirar para abajo su cielo ya asoma siguiendo al dedo. Pasado
 * `TIRON_PARA_ENTRAR` entra sola; tocarla también, y es lo que usa VoiceOver.
 *
 * `tiron` es cuánto se tiró, atado al desplazamiento de Stats por el motor nativo, sin pasar por JS.
 */
export default function PuertaDeMoss({ abierta, desde = 0, alAbrir, alCerrar }: { abierta: boolean; /** Cuánto se tiró antes de soltar: de ahí sigue bajando. */ desde?: number; alAbrir: () => void; alCerrar: () => void }) {
  const flecha = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    void cargarFuentesDeMoss();
    let vuelta: Animated.CompositeAnimation | null = null;
    let vivo = true;
    void sinMovimiento().then((quieto) => {
      if (!vivo || quieto) return;
      vuelta = Animated.loop(
        Animated.sequence([
          Animated.timing(flecha, { toValue: 1, duration: 900, easing: LLEGA, useNativeDriver: true, isInteraction: false }),
          Animated.timing(flecha, { toValue: 0, duration: 900, easing: SE_VA, useNativeDriver: true, isInteraction: false }),
          Animated.delay(1400),
        ]),
      );
      vuelta.start();
    });
    return () => {
      vivo = false;
      vuelta?.stop();
    };
  }, [flecha]);
  return (
    <>
      <Tocable testID="entrada-a-moss" style={estilos.entrada} onPress={alAbrir} accessibilityRole="button" accessibilityLabel={`${T.moss.nombre}. ${T.moss.pronto}`}>
        <Animated.View style={{ transform: [{ translateY: flecha.interpolate({ inputRange: [0, 1], outputRange: [2, -3] }) }] }}>
          <Svg width={18} height={10} viewBox="0 0 18 10">
            <Path d="M1 9l8-8 8 8" fill="none" stroke={MOSS.oro} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
        <Text style={estilos.entradaNombre}>{T.moss.nombre}</Text>
        <Text style={estilos.entradaPronto}>{T.moss.pronto}</Text>
      </Tocable>
      <PantallaDeMoss visible={abierta} desde={desde} alCerrar={alCerrar} />
    </>
  );
}

/** Lo que asoma al tirar: el mismo cielo, atado al dedo. No se toca. */
export function MossAsomando({ tiron }: { tiron: Animated.Value }) {
  const { height: alto } = useWindowDimensions();
  const avance = useMemo(() => tiron.interpolate({ inputRange: [0, alto], outputRange: [0, 1], extrapolate: 'clamp' }), [tiron, alto]);
  return (
    <Animated.View
      pointerEvents="none"
      testID="moss-asomando"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { transform: [{ translateY: tiron.interpolate({ inputRange: [0, alto], outputRange: [-alto, 0], extrapolate: 'clamp' }) }] }]}
    >
      <CieloDeMoss avance={avance} alto={alto} />
    </Animated.View>
  );
}

function PantallaDeMoss({ visible, desde, alCerrar }: { visible: boolean; desde: number; alCerrar: () => void }) {
  const { height: alto } = useWindowDimensions();
  const [montada, setMontada] = useState(visible);
  const avance = useRef(new Animated.Value(0)).current;
  const quien = useRef(Symbol('moss')).current;

  useEffect(() => {
    let vivo = true;
    if (visible) {
      setMontada(true);
      // Sigue desde donde lo dejó el dedo: arrancar de arriba de todo se vería como un salto.
      avance.setValue(Math.min(1, desde / alto));
    } else taparElFondo(quien, false);
    void sinMovimiento().then((quieto) => {
      if (!vivo) return;
      Animated.timing(avance, { toValue: visible ? 1 : 0, duration: quieto ? 0 : visible ? ENTRA_MS : SALE_MS, easing: visible ? LLEGA : SE_VA, useNativeDriver: true }).start(({ finished }) => {
        if (!finished || !vivo) return;
        // Tapado del todo, el motor no tiene por qué seguir dibujando.
        if (visible) taparElFondo(quien, true);
        else setMontada(false);
      });
    });
    return () => {
      vivo = false;
    };
    // Solo al abrir y cerrar: `desde` se lee en ese momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, avance, quien]);
  useEffect(() => () => taparElFondo(quien, false), [quien]);

  // Hacia arriba, sigue al dedo y vuelve a Ascent: se entró bajando el cielo, se sale subiéndolo.
  const gesto = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy < -8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => avance.setValue(Math.max(0, Math.min(1, 1 + g.dy / alto))),
        onPanResponderRelease: (_, g) => {
          if (g.dy < -alto * 0.18 || g.vy < -0.8) return alCerrar();
          Animated.timing(avance, { toValue: 1, duration: 260, easing: LLEGA, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () => {
          Animated.timing(avance, { toValue: 1, duration: 260, easing: LLEGA, useNativeDriver: true }).start();
        },
      }),
    [avance, alto, alCerrar],
  );

  if (!montada) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={alCerrar} statusBarTranslucent>
      <Animated.View
        testID="pantalla-de-moss"
        accessibilityViewIsModal
        {...gesto.panHandlers}
        style={[StyleSheet.absoluteFill, { transform: [{ translateY: avance.interpolate({ inputRange: [0, 1], outputRange: [-alto, 0] }) }] }]}
      >
        <CieloDeMoss avance={avance} alto={alto} />
        <Tocable testID="moss-volver" style={estilos.volver} onPress={alCerrar} accessibilityRole="button">
          <Svg width={18} height={10} viewBox="0 0 18 10">
            <Path d="M1 9l8-8 8 8" fill="none" stroke={MOSS.pergaminoTenue} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={estilos.volverTexto}>{T.moss.volver}</Text>
        </Tocable>
      </Animated.View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  entrada: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 8, minHeight: 44, paddingHorizontal: 14, marginTop: -8, marginBottom: 8 },
  entradaNombre: { color: MOSS.oroClaro, fontFamily: LETRAS_DE_MOSS.titulo, fontSize: 21, lineHeight: 24 },
  entradaPronto: { color: MOSS.oro, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase' },
  cielo: { width: '100%', overflow: 'hidden', backgroundColor: MOSS.noche0 },
  centro: { position: 'absolute', left: 0, right: 0, top: '22%', alignItems: 'center' },
  nombre: { color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.titulo, fontSize: 64, lineHeight: 72, marginTop: 6 },
  pronto: { color: MOSS.oro, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 13, letterSpacing: 4, textTransform: 'uppercase', marginTop: 10 },
  brillo: { position: 'absolute', left: 0, right: 0, bottom: 1, height: 70 },
  horizonte: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, backgroundColor: MOSS.oro },
  volver: { position: 'absolute', left: 0, right: 0, bottom: 44, alignItems: 'center', gap: 8, paddingVertical: 10 },
  volverTexto: { color: MOSS.pergaminoTenue, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 13, letterSpacing: 0.6 },
});
