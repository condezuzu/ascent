import { useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { T } from '@nucleo/textos';
import { C, conTema, luz } from './colores';
import Estrella from './Estrella';
import { LLENA, sinMovimiento } from './movimiento';
import { Text } from './Texto';
import Tocable from './Tocable';
import { useTema } from './useTema';

const ANCHO = 300;
const ALTO = 184;
const CENTRO = { x: ANCHO / 2, y: ALTO / 2 };
const SITIOS = [{ x: 64, y: 44 }, { x: 236, y: 34 }, { x: 52, y: 146 }, { x: 244, y: 138 }];
const RAYA = 130;
const LineaAnimada = Animated.createAnimatedComponent(Line);

/**
 * LA CONSTELACIÓN, SIN LEERLA (propuesta J, aprobada el 31/10). Decía «Busca a alguien más abajo y
 * empieza la constelación.». Ahora se ve: tu estrella, y los lugares vacíos alrededor. Tocar uno
 * tira la línea y lleva al buscador, que es donde se agrega a alguien. No inventa amigos: el lugar se
 * prende, pero queda con su +. VoiceOver lee el texto de siempre.
 */
export default function SocialVacio({ alBuscar }: { alBuscar: () => void }) {
  useTema();
  const [prendidos, setPrendidos] = useState<number[]>([]);
  const trazos = useRef(SITIOS.map(() => new Animated.Value(0))).current;

  const tocar = (i: number) => {
    setPrendidos((p) => (p.includes(i) ? p : [...p, i]));
    void sinMovimiento().then((quieto) => {
      // Por JS: el trazo de un SVG no va por el motor nativo.
      Animated.timing(trazos[i], { toValue: 1, duration: quieto ? 0 : 520, easing: LLENA, useNativeDriver: false }).start();
    });
    alBuscar();
  };

  return (
    <View style={estilos.todo}>
      <Text style={estilos.titulo}>{T.social.vacioTitulo}</Text>
      <View style={estilos.cielo} testID="social-vacio" accessible={false}>
        <Svg width={ANCHO} height={ALTO} pointerEvents="none">
          {SITIOS.map((s, i) => (
            <LineaAnimada
              key={i}
              x1={CENTRO.x}
              y1={CENTRO.y}
              x2={s.x}
              y2={s.y}
              stroke={C.claro}
              strokeWidth={1}
              strokeOpacity={0.55}
              strokeDasharray={[RAYA, RAYA]}
              strokeDashoffset={trazos[i].interpolate({ inputRange: [0, 1], outputRange: [RAYA, 0] })}
            />
          ))}
        </Svg>
        <View style={[estilos.yo, { left: CENTRO.x - 22, top: CENTRO.y - 22 }]} pointerEvents="none">
          <Estrella tam={44} modo="luz" />
        </View>
        {SITIOS.map((s, i) => {
          const prendido = prendidos.includes(i);
          return (
            <Tocable
              key={i}
              onPress={() => tocar(i)}
              style={[estilos.sitio, { left: s.x - 22, top: s.y - 22 }]}
              accessibilityLabel={`${T.social.vacioPie} ${T.social.buscarGente}`}
              testID={`social-lugar-${i}`}
            >
              <View style={[estilos.aro, prendido && estilos.aroPrendido]} testID={prendido ? 'social-lugar-prendido' : undefined}>
                <Text style={[estilos.mas, prendido && estilos.masPrendido]}>+</Text>
              </View>
            </Tocable>
          );
        })}
      </View>
    </View>
  );
}

const estilos = conTema(() => StyleSheet.create({
  todo: { alignItems: 'center', paddingVertical: 12, gap: 8 },
  titulo: { color: C.sub, fontSize: 14, textAlign: 'center' },
  cielo: { width: ANCHO, height: ALTO },
  yo: { position: 'absolute', width: 44, height: 44 },
  // 44 de lugar para el dedo, 30 de dibujo.
  sitio: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  aro: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderStyle: 'dashed', borderColor: C.lineaFuerte, alignItems: 'center', justifyContent: 'center' },
  aroPrendido: { borderStyle: 'solid', borderColor: C.claro, ...luz(C.claro, 0.35, 6) },
  mas: { color: C.sub, fontSize: 15, fontWeight: '300' },
  masPrendido: { color: C.claro },
}));
