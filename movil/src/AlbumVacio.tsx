import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { T } from '@nucleo/textos';
import { C, conTema, luz } from './colores';
import { L } from './fuentes';
import { LLEGA, MS, SE_VA, sinMovimiento } from './movimiento';
import { Text } from './Texto';
import Tocable from './Tocable';
import { useTema } from './useTema';

const ALTO = 190;
const MARCO = { w: 92, h: 112 };
const PLANETA = 170;

/**
 * QUÉ ES EL ÁLBUM, SIN LEERLO (propuesta I, aprobada el 31/10). Decía «Al registrar un día puedes
 * sumar una: queda pegada al planeta de ese día.». Ahora se ve: el marco vacío, y una foto que cae y
 * se pega al planeta. Cae una vez al aparecer, y se saca y se pone al tocar. Es una demostración:
 * no hay foto de verdad. VoiceOver lee el texto de siempre.
 */
export default function AlbumVacio() {
  useTema();
  const [puesta, setPuesta] = useState(false);
  const t = useRef(new Animated.Value(0)).current;
  const vivo = useRef(true);

  const poner = (si: boolean) => {
    setPuesta(si);
    void sinMovimiento().then((quieto) => {
      if (!vivo.current) return;
      Animated.timing(t, { toValue: si ? 1 : 0, duration: quieto ? 0 : si ? 720 : MS.sale, easing: si ? LLEGA : SE_VA, useNativeDriver: true }).start();
    });
  };

  useEffect(() => {
    vivo.current = true;
    const espera = setTimeout(() => poner(true), 900);
    return () => {
      vivo.current = false;
      clearTimeout(espera);
    };
    // Una vez, al aparecer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={estilos.todo}>
      <Text style={estilos.titulo}>{T.album.vacioTitulo}</Text>
      <Tocable
        hundir={1}
        style={estilos.escena}
        onPress={() => poner(!puesta)}
        accessibilityLabel={`${T.album.vacioTitulo} ${T.album.vacioPie}`}
        testID="album-vacio"
      >
        {/* El halo va en una vista redonda: en el Svg saldría cuadrado. */}
        <View style={estilos.planeta} pointerEvents="none" testID="album-planeta">
          <Svg width={PLANETA} height={PLANETA}>
            <Defs>
              <RadialGradient id="album-planeta" cx="32%" cy="30%" r="72%">
                <Stop offset="0" stopColor={C.claro} />
                <Stop offset="0.46" stopColor={C.principal} />
                <Stop offset="1" stopColor={C.fondo} />
              </RadialGradient>
            </Defs>
            <Circle cx={PLANETA / 2} cy={PLANETA / 2} r={PLANETA / 2} fill="url(#album-planeta)" />
          </Svg>
        </View>
        <Animated.View style={[estilos.marco, { opacity: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25] }) }]}>
          <Svg width={MARCO.w} height={MARCO.h} pointerEvents="none">
            <Rect x={0.5} y={0.5} width={MARCO.w - 1} height={MARCO.h - 1} fill="none" stroke={C.lineaFuerte} strokeDasharray="4 5" />
          </Svg>
          <Text style={estilos.mas}>+</Text>
        </Animated.View>
        <Animated.View
          testID={puesta ? 'album-foto-puesta' : 'album-foto'}
          pointerEvents="none"
          style={[
            estilos.foto,
            {
              opacity: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] }),
              transform: [
                { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-34, 112] }) },
                { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-90, 30] }) },
                { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '7deg'] }) },
                { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }) },
              ],
            },
          ]}
        >
          <View style={estilos.imagen} />
          <Text style={estilos.pie} numberOfLines={1}>{T.stats.diaN(1)}</Text>
        </Animated.View>
      </Tocable>
    </View>
  );
}

const estilos = conTema(() => StyleSheet.create({
  todo: { paddingVertical: 20, gap: 14 },
  titulo: { color: C.sub, fontSize: 14, textAlign: 'center' },
  // Sin recortar: el planeta se sale por el borde de la pantalla, no por el de la escena.
  escena: { height: ALTO },
  planeta: { position: 'absolute', right: -30, bottom: -20, width: PLANETA, height: PLANETA, borderRadius: PLANETA / 2, ...luz(C.claro, 0.22, 17) },
  marco: { position: 'absolute', left: '12%', top: 14, width: MARCO.w, height: MARCO.h, alignItems: 'center', justifyContent: 'center' },
  mas: { position: 'absolute', color: C.sub, fontSize: 22, fontWeight: '300' },
  foto: { position: 'absolute', left: '12%', top: 14, width: MARCO.w, height: MARCO.h, padding: 5, paddingBottom: 18, backgroundColor: C.tinta, ...luz(C.claro, 0.2, 8) },
  imagen: { flex: 1, backgroundColor: C.lineaFuerte },
  pie: { position: 'absolute', left: 0, right: 0, bottom: 3, textAlign: 'center', color: C.negro, fontSize: 9.5, fontFamily: L.dato },
}));
