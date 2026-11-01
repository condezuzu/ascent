import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type LayoutRectangle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { modosDeLasVidas } from '@nucleo/impulsos';
import { C, conTema } from './colores';
import Estrella from './Estrella';
import EstrellaQueTitila from './EstrellaQueTitila';
import { L } from './fuentes';
import { LLEGA, sinMovimiento } from './movimiento';
import { Text } from './Texto';
import Tocable from './Tocable';
import { useTema } from './useTema';

const TAM = 16;
const HUECO = 8;
const DIA = 26;
const DIAS = ['lleno', 'lleno', 'lleno', 'lleno', 'falta', 'futuro', 'futuro'] as const;
const FALTA = DIAS.indexOf('falta');
const VUELVE_A_LOS = 30;
const LARGO_DEL_ARO = 2 * Math.PI * 11;
const AroAnimado = Animated.createAnimatedComponent(Circle);

/**
 * QUÉ ES UNA VIDA, SIN LEERLO (propuesta A de la galería, aprobada el 31/10). Decía «Si faltas un
 * día se usa una y la racha sigue. Cada una vuelve a los 30 días.». Ahora se ve: al tocar, una
 * estrella vuela al día que faltó, la racha no se mueve, y un aro la trae de vuelta contando los 30.
 *
 * Es una demostración: no toca ninguna vida de verdad. Las estrellas de arriba sí son las de la
 * persona, y lo que falta para ganar la próxima es el número debajo. VoiceOver lee el texto de siempre.
 */
export default function VidasExplicadas({
  vidas,
  racha,
  dias,
  explicacion,
}: {
  vidas: { quedan: number; total: number; tope?: number };
  racha: number;
  /** Lo que falta para la próxima, si falta algo. */
  dias: number | null;
  explicacion: string;
}) {
  useTema();
  const modos = modosDeLasVidas(vidas);
  // Vuela la última que queda: es la que se usaría.
  const laQueVuela = Math.max(modos.lastIndexOf('luz'), 0);
  const conDias = modos.findIndex((m) => m !== 'luz');

  const [vuela, setVuela] = useState(false);
  const [prestada, setPrestada] = useState(false);
  const [cubierto, setCubierto] = useState(false);
  const [aro, setAro] = useState(false);
  const [faltan, setFaltan] = useState(VUELVE_A_LOS);
  const viaje = useRef(new Animated.Value(0)).current;
  const avanceAro = useRef(new Animated.Value(0)).current;
  const vuelta = useRef(new Animated.Value(1)).current;
  const ocupado = useRef(false);
  const vivo = useRef(true);
  const lugares = useRef<{ arriba?: LayoutRectangle; estrellas?: LayoutRectangle; dias?: LayoutRectangle }>({});

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  // El día que faltó llama: es lo que se toca.
  const llamada = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let vuelta_: Animated.CompositeAnimation | null = null;
    let sigue = true;
    void sinMovimiento().then((quieto) => {
      if (quieto || !sigue) return;
      vuelta_ = Animated.loop(Animated.timing(llamada, { toValue: 1, duration: 1700, easing: LLEGA, useNativeDriver: true, isInteraction: false }));
      vuelta_.start();
    });
    return () => {
      sigue = false;
      vuelta_?.stop();
    };
  }, [llamada]);

  const terminar = () => {
    setTimeout(() => {
      if (!vivo.current) return;
      setCubierto(false);
      ocupado.current = false;
    }, 1500);
  };

  async function contar() {
    if (ocupado.current) return;
    ocupado.current = true;
    if (await sinMovimiento()) {
      setCubierto(true);
      terminar();
      return;
    }
    if (!vivo.current) return;
    setVuela(true);
    setPrestada(true);
    viaje.setValue(0);
    Animated.timing(viaje, { toValue: 1, duration: 720, easing: LLEGA, useNativeDriver: true }).start(() => {
      if (!vivo.current) return;
      setVuela(false);
      setCubierto(true);
      setAro(true);
      setFaltan(VUELVE_A_LOS);
      avanceAro.setValue(0);
      const oyente = avanceAro.addListener(({ value }) => setFaltan(Math.ceil(VUELVE_A_LOS * (1 - value))));
      // Por JS: el trazo de un SVG no va por el motor nativo.
      Animated.timing(avanceAro, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: false }).start(() => {
        avanceAro.removeListener(oyente);
        if (!vivo.current) return;
        setAro(false);
        setPrestada(false);
        vuelta.setValue(0);
        Animated.timing(vuelta, { toValue: 1, duration: 520, easing: LLEGA, useNativeDriver: true }).start();
        terminar();
      });
    });
  }

  // De dónde sale y adónde llega, con lo medido.
  const { arriba, estrellas, dias: filaDias } = lugares.current;
  const x0 = (arriba?.x ?? 0) + (estrellas?.x ?? 0) + laQueVuela * (TAM + HUECO);
  const y0 = (arriba?.y ?? 0) + (estrellas?.y ?? 0);
  const x1 = (filaDias?.x ?? 0) + ((filaDias?.width ?? 0) - DIA) * (FALTA / (DIAS.length - 1)) + (DIA - TAM) / 2;
  const y1 = (filaDias?.y ?? 0) + (DIA - TAM) / 2;

  return (
    <Tocable hundir={1} onPress={() => void contar()} accessibilityLabel={explicacion} testID="vidas-explicadas" style={estilos.todo}>
      <View style={estilos.arriba} onLayout={(e) => (lugares.current.arriba = e.nativeEvent.layout)}>
        <Text style={estilos.numero} testID="vidas-racha">{racha}</Text>
        <View style={estilos.estrellas} testID="vidas-stats" onLayout={(e) => (lugares.current.estrellas = e.nativeEvent.layout)}>
          {modos.map((modo, i) => (
            <View key={i} style={estilos.lugar}>
              {i === laQueVuela && prestada ? (
                <View style={estilos.vacia} />
              ) : (
                <Animated.View style={i === laQueVuela && { transform: [{ scale: vuelta.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.3, 1.5, 1] }) }] }}>
                  <EstrellaQueTitila indice={i} modo={modo} tam={TAM} />
                </Animated.View>
              )}
              {i === laQueVuela && aro && (
                <Svg width={DIA} height={DIA} style={estilos.aro} testID="vidas-aro">
                  <Circle cx={DIA / 2} cy={DIA / 2} r={11} fill="none" stroke={C.linea} strokeWidth={1.5} />
                  <AroAnimado
                    cx={DIA / 2}
                    cy={DIA / 2}
                    r={11}
                    fill="none"
                    stroke={C.claro}
                    strokeWidth={1.5}
                    strokeDasharray={LARGO_DEL_ARO}
                    strokeDashoffset={avanceAro.interpolate({ inputRange: [0, 1], outputRange: [LARGO_DEL_ARO, 0] })}
                  />
                </Svg>
              )}
              {i === laQueVuela && aro ? (
                <Text style={estilos.faltan} testID="vidas-contando">{faltan}</Text>
              ) : (
                i === conDias && dias !== null && dias > 0 && <Text style={estilos.faltan} testID="vidas-faltan">{dias}</Text>
              )}
            </View>
          ))}
        </View>
      </View>
      <View style={estilos.dias} onLayout={(e) => (lugares.current.dias = e.nativeEvent.layout)}>
        {DIAS.map((c, i) => (
          <View key={i} style={[estilos.dia, c === 'lleno' && estilos.lleno, c === 'futuro' && estilos.futuro, c === 'falta' && estilos.falta]} testID={c === 'falta' ? 'vidas-dia-que-falto' : undefined}>
            {c === 'falta' && !cubierto && (
              <Animated.View
                testID="vidas-llama"
                style={[estilos.llama, { opacity: llamada.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }), transform: [{ scale: llamada.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.3] }) }] }]}
              />
            )}
            {c === 'falta' && cubierto && <Estrella tam={TAM} modo="luz" />}
          </View>
        ))}
      </View>
      {vuela && (
        <Animated.View
          testID="vidas-vuela"
          pointerEvents="none"
          style={[
            estilos.vuela,
            {
              transform: [
                { translateX: viaje.interpolate({ inputRange: [0, 0.45, 1], outputRange: [x0, (x0 + x1) / 2, x1] }) },
                { translateY: viaje.interpolate({ inputRange: [0, 0.45, 1], outputRange: [y0, Math.min(y0, y1) - 26, y1] }) },
                { scale: viaje.interpolate({ inputRange: [0, 0.45, 1], outputRange: [1, 1.5, 1] }) },
              ],
            },
          ]}
        >
          <Estrella tam={TAM} modo="luz" />
        </Animated.View>
      )}
    </Tocable>
  );
}

const estilos = conTema(() => StyleSheet.create({
  todo: { marginTop: 4 },
  arriba: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 },
  numero: { color: C.claro, fontFamily: L.racha, fontWeight: '300', fontSize: 58, lineHeight: 62, letterSpacing: -2 },
  estrellas: { flexDirection: 'row', gap: HUECO, paddingBottom: 10 },
  lugar: { width: TAM, height: TAM, alignItems: 'center' },
  vacia: { width: TAM, height: TAM },
  aro: { position: 'absolute', left: (TAM - DIA) / 2, top: (TAM - DIA) / 2, transform: [{ rotate: '-90deg' }] },
  faltan: { position: 'absolute', top: TAM + 6, width: 30, textAlign: 'center', color: C.sub, fontSize: 10.5, fontFamily: L.dato },
  dias: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  dia: { width: DIA, height: DIA, borderRadius: DIA / 2, alignItems: 'center', justifyContent: 'center' },
  lleno: { backgroundColor: C.diaLleno },
  futuro: { borderWidth: 1, borderColor: C.diaFuturo },
  falta: { borderWidth: 1, borderColor: C.claro },
  llama: { position: 'absolute', left: -5, right: -5, top: -5, bottom: -5, borderRadius: 999, borderWidth: 1, borderColor: C.claro },
  vuela: { position: 'absolute', left: 0, top: 0, width: TAM, height: TAM, zIndex: 3 },
}));
