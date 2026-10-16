import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { numeroDeRango } from '@nucleo/rangos';
import { T } from '@nucleo/textos';
import Insignia from '../Insignia';
import { C, conAlfa } from '../colores';

/**
 * LA ÚLTIMA PANTALLA DE LA ENTRADA (15/10): "Mira quién llega más lejos". Las
 * insignias de cada racha flotando detrás, la lista, sofi que pasa a mateo, y una
 * luz que baja de las insignias y se abre en "Crear cuenta". Es la más fuerte a
 * propósito: termina en la cuenta.
 */
const GENTE = [
  { n: 'lucia', racha: 63 },
  { n: 'mateo', racha: 38 },
  { n: 'sofi', racha: 37 },
  { n: 'nico', racha: 21 },
  { n: 'vale', racha: 9 },
];
// Dónde flota cada insignia, en % de la pantalla: en los bordes, nunca detrás de la lista.
const LUGARES = [
  { x: 78, y: 7 },
  { x: 16, y: 8 },
  { x: 84, y: 66 },
  { x: 18, y: 72 },
  { x: 58, y: 79 },
];
const ALTO_FILA = 52;
// Los momentos de la coreografía, en segundos desde que aparece.
const APARECE_S = 0.4;
const PASA_S = 2.6;
const SUBE_S = 4.6;
const BOTON_S = 5.6;
const sale = Easing.bezier(0.2, 0.7, 0.2, 1);

function Flotante({ rango, tam, x, y, demora, apagada }: { rango: number; tam: number; x: number; y: number; demora: number; apagada: Animated.Value }) {
  const flota = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(demora),
        Animated.timing(flota, { toValue: 1, duration: 3500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(flota, { toValue: 0, duration: 3500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [flota, demora]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - tam / 2,
        top: y - tam / 2,
        opacity: apagada.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0.35] }),
        transform: [{ translateY: flota.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }],
        shadowColor: C.claro,
        shadowOpacity: 0.35,
        shadowRadius: 8 + tam / 6,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      <Insignia rango={rango} tam={tam} />
    </Animated.View>
  );
}

export default function RankingDeEntrada({ alSalir }: { alSalir: (destino: 'crear' | 'entrar') => void }) {
  const { width, height } = useWindowDimensions();
  const [paso, setPaso] = useState(0);
  const [anchoBoton, setAnchoBoton] = useState(0);
  const aparece = useRef(new Animated.Value(0)).current;
  const lugares = useRef(GENTE.map((_, i) => new Animated.Value(i))).current;
  const sube = useRef(new Animated.Value(0)).current;
  const luz = useRef(new Animated.Value(0)).current;
  const boton = useRef(new Animated.Value(0)).current;
  const crece = useRef(new Animated.Value(0)).current;
  const textoBoton = useRef(new Animated.Value(0)).current;
  const yaTengo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const relojes = [
      setTimeout(() => {
        setPaso(1);
        Animated.timing(aparece, { toValue: 1, duration: 700, useNativeDriver: true }).start();
      }, APARECE_S * 1000),
      setTimeout(() => {
        setPaso(2);
        // sofi (2) pasa a mateo (1).
        Animated.parallel([
          Animated.timing(lugares[1], { toValue: 2, duration: 800, easing: sale, useNativeDriver: true }),
          Animated.timing(lugares[2], { toValue: 1, duration: 800, easing: sale, useNativeDriver: true }),
        ]).start();
      }, PASA_S * 1000),
      setTimeout(() => {
        setPaso(3);
        Animated.parallel([
          Animated.timing(sube, { toValue: 1, duration: 1000, easing: sale, useNativeDriver: true }),
          Animated.timing(luz, { toValue: 1, duration: 1000, easing: Easing.bezier(0.5, 0, 0.3, 1), useNativeDriver: false }),
          Animated.timing(boton, { toValue: 1, duration: 400, useNativeDriver: false }),
        ]).start();
      }, SUBE_S * 1000),
      setTimeout(() => {
        setPaso(4);
        Animated.parallel([
          Animated.timing(crece, { toValue: 1, duration: 700, easing: sale, useNativeDriver: false }),
          Animated.timing(textoBoton, { toValue: 1, delay: 450, duration: 400, useNativeDriver: false }),
          Animated.timing(yaTengo, { toValue: 1, delay: 800, duration: 500, useNativeDriver: true }),
        ]).start();
      }, BOTON_S * 1000),
    ];
    return () => relojes.forEach(clearTimeout);
  }, [aparece, lugares, sube, luz, boton, crece, textoBoton, yaTengo]);

  const rachaDe = (g: (typeof GENTE)[number]) => (g.n === 'sofi' && paso >= 2 ? 39 : g.racha);
  const lugarDe = (n: string) => {
    const orden = GENTE.map((g) => ({ ...g, racha: rachaDe(g) })).sort((a, b) => b.racha - a.racha);
    return orden.findIndex((g) => g.n === n);
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      {GENTE.map((g, i) => (
        <Flotante
          key={g.n}
          rango={numeroDeRango(g.racha)}
          tam={16 + (g.racha / 63) * 22}
          x={(LUGARES[i].x / 100) * width}
          y={(LUGARES[i].y / 100) * height}
          demora={i * 1300}
          apagada={sube}
        />
      ))}

      <Animated.View style={[estilos.centro, { transform: [{ translateY: sube.interpolate({ inputRange: [0, 1], outputRange: [0, -36] }) }] }]}>
        <Animated.View style={[estilos.lista, { height: ALTO_FILA * GENTE.length + 12, opacity: aparece }]}>
          {GENTE.map((g, i) => (
            <Animated.View
              key={g.n}
              style={[
                estilos.fila,
                { transform: [{ translateY: lugares[i].interpolate({ inputRange: [0, GENTE.length], outputRange: [0, ALTO_FILA * GENTE.length] }) }] },
              ]}
            >
              {lugarDe(g.n) > 0 && <View style={estilos.linea} />}
              <Text style={estilos.puesto}>{lugarDe(g.n) + 1}</Text>
              <View style={estilos.avatar}>
                <Text style={estilos.inicial}>{g.n[0].toUpperCase()}</Text>
              </View>
              <Text style={estilos.nombre}>{g.n}</Text>
              <Insignia rango={numeroDeRango(rachaDe(g))} tam={20} />
              <Text style={[estilos.racha, g.n === 'sofi' && paso >= 2 && { color: C.tinta }]}>{rachaDe(g)}</Text>
            </Animated.View>
          ))}
        </Animated.View>
        <Text style={estilos.titulo}>{T.bienvenida.rankingTitulo}</Text>
      </Animated.View>

      {/* La luz que baja de las insignias y se vuelve el botón. */}
      <Animated.View
        pointerEvents="none"
        style={[
          estilos.luz,
          {
            top: height * 0.64,
            height: luz.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.21] }),
            opacity: luz.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.9, 0] }),
          },
        ]}
      />

      <View style={estilos.pie} onLayout={(e: LayoutChangeEvent) => setAnchoBoton(e.nativeEvent.layout.width - 56)}>
        <Animated.View
          style={[
            estilos.botonCaja,
            {
              opacity: boton,
              width: crece.interpolate({ inputRange: [0, 1], outputRange: [12, Math.max(12, anchoBoton)] }),
              height: crece.interpolate({ inputRange: [0, 1], outputRange: [12, 52] }),
              borderRadius: crece.interpolate({ inputRange: [0, 1], outputRange: [6, 2] }),
            },
          ]}
        >
          <Pressable testID="bienvenida-crear" disabled={paso < 4} onPress={() => alSalir('crear')} style={estilos.botonToque} accessibilityRole="button">
            <Animated.Text numberOfLines={1} style={[estilos.botonTexto, { opacity: textoBoton }]}>
              {T.bienvenida.crear}
            </Animated.Text>
          </Pressable>
        </Animated.View>
        <Animated.View style={{ opacity: yaTengo }}>
          <Pressable testID="bienvenida-entrar" disabled={paso < 4} onPress={() => alSalir('entrar')} hitSlop={8} style={estilos.enlace} accessibilityRole="button">
            <Text style={estilos.enlaceTexto}>{T.bienvenida.entrar}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 30 },
  lista: { borderWidth: 1, borderColor: C.linea, borderRadius: 14, backgroundColor: conAlfa(C.hoja, 0.9), paddingVertical: 6, paddingHorizontal: 18 },
  fila: { position: 'absolute', left: 18, right: 18, top: 6, height: ALTO_FILA, flexDirection: 'row', alignItems: 'center', gap: 12 },
  linea: { position: 'absolute', top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: C.linea },
  puesto: { width: 16, color: C.sub, fontSize: 14 },
  avatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: C.lineaFuerte, alignItems: 'center', justifyContent: 'center' },
  inicial: { color: C.tinta, fontSize: 13 },
  nombre: { flex: 1, color: C.tinta, fontSize: 15 },
  racha: { width: 30, textAlign: 'right', color: C.claro, fontSize: 17, fontVariant: ['tabular-nums'] },
  titulo: { color: C.tinta, fontSize: 30, lineHeight: 36, fontWeight: '500' },
  luz: { position: 'absolute', alignSelf: 'center', width: 2, backgroundColor: C.claro },
  pie: { alignItems: 'center', paddingHorizontal: 28, paddingBottom: 50, minHeight: 140, justifyContent: 'flex-end' },
  botonCaja: {
    backgroundColor: C.tinta,
    overflow: 'hidden',
    shadowColor: C.tinta,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  botonToque: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  botonTexto: { color: C.fondo, fontSize: 16, fontWeight: '600' },
  enlace: { paddingVertical: 14, paddingHorizontal: 12 },
  enlaceTexto: { color: C.sub, fontSize: 15 },
});
