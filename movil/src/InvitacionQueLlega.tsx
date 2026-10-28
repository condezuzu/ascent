import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Novedad } from '@nucleo/novedades';
import { T } from '@nucleo/textos';
import Avatar from './Avatar';
import { C, conAlfa } from './colores';

/** Lo que dura la mecha. Si se quema entera, la invitación se cancela sola. */
export const MECHA_MS = 10_000;
const ALTO = 56;
const MARGEN = 12;

/**
 * LA INVITACIÓN QUE LLEGA (29/10, la fusión de B y C de la galería). Cae como
 * las burbujas de Inicio, rebota y se abre en píldora. La cuenta es una mecha
 * que se quema con una chispa en la punta; si llega al final, la píldora se
 * cierra en burbuja, se va volando y la invitación se cancela. Flota encima: no
 * mueve nada de lo que hay en pantalla.
 */
export default function InvitacionQueLlega({
  novedad,
  alContestar,
  alTerminar,
}: {
  novedad: Novedad;
  /** null = se quemó la mecha. */
  alContestar: (acepta: boolean | null) => void;
  alTerminar: () => void;
}) {
  const { width } = useWindowDimensions();
  const ancho = width - MARGEN * 2;
  const caida = useRef(new Animated.Value(0)).current;
  const abre = useRef(new Animated.Value(0)).current;
  const mecha = useRef(new Animated.Value(1)).current;
  const salida = useRef(new Animated.Value(0)).current;
  const chispa = useRef(new Animated.Value(0)).current;
  const brillo = useRef(new Animated.Value(0)).current;
  const [abierta, setAbierta] = useState(false);
  const contestada = useRef(false);
  const quieto = useRef(false);

  function irse(acepta: boolean | null) {
    if (contestada.current) return;
    contestada.current = true;
    setAbierta(false);
    mecha.stopAnimation();
    alContestar(acepta);
    const d = quieto.current ? 0 : 1;
    Animated.sequence([
      Animated.timing(abre, { toValue: 0, duration: 350 * d, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
      Animated.timing(salida, { toValue: 1, duration: 500 * d, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
    ]).start(() => alTerminar());
  }

  useEffect(() => {
    let vivo = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((q) => {
        if (!vivo) return;
        quieto.current = q;
        const d = q ? 0 : 1;
        Animated.sequence([
          Animated.spring(caida, { toValue: 1, useNativeDriver: false, speed: 9, bounciness: 12 }),
          Animated.timing(abre, { toValue: 1, duration: 500 * d, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        ]).start(({ finished }) => {
          if (!finished || !vivo) return;
          setAbierta(true);
          // Solo se cancela si la mecha llegó al final: interrumpida (alguien contestó) no.
          Animated.timing(mecha, { toValue: 0, duration: MECHA_MS, easing: Easing.linear, useNativeDriver: false }).start((r) => {
            if (r.finished && vivo) irse(null);
          });
          if (!q) {
            Animated.loop(Animated.sequence([
              Animated.timing(chispa, { toValue: 1, duration: 90, useNativeDriver: false }),
              Animated.timing(chispa, { toValue: 0, duration: 90, useNativeDriver: false }),
            ])).start();
            Animated.loop(Animated.sequence([
              Animated.timing(brillo, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
              Animated.delay(1200),
              Animated.timing(brillo, { toValue: 0, duration: 0, useNativeDriver: false }),
            ])).start();
          }
        });
      });
    return () => {
      vivo = false;
      [caida, abre, mecha, salida, chispa, brillo].forEach((v) => v.stopAnimation());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anchoAhora = abre.interpolate({ inputRange: [0, 1], outputRange: [ALTO, ancho] });
  const radio = abre.interpolate({ inputRange: [0, 1], outputRange: [ALTO / 2, 18] });
  const resto = abre.interpolate({ inputRange: [0.6, 1], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <Animated.View
      testID="cartel-de-arriba"
      accessibilityRole="alert"
      accessibilityLabel={T.social.teInvita(novedad.otro.username)}
      pointerEvents="box-none"
      style={[
        estilos.lugar,
        {
          opacity: salida.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [
            { translateY: Animated.add(caida.interpolate({ inputRange: [0, 1], outputRange: [-220, 0] }), salida.interpolate({ inputRange: [0, 1], outputRange: [0, -200] })) },
            { scale: salida.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }) },
          ],
        },
      ]}
    >
      <Animated.View testID="invitacion-pildora" style={[estilos.sombra, { width: anchoAhora, borderRadius: radio }]}>
        <Animated.View style={[estilos.pildora, { borderRadius: radio }]}>
          <View style={[estilos.fila, { width: ancho }]} pointerEvents={abierta ? 'auto' : 'none'}>
            <View style={estilos.cara}>
              <Avatar url={novedad.otro.avatar_url} nombre={novedad.otro.username} tam={40} />
            </View>
            <Animated.View style={[estilos.resto, { opacity: resto }]}>
              <View style={estilos.textos}>
                <Text style={estilos.nombre} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                  {novedad.otro.username}
                </Text>
                <Text style={estilos.que} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                  {T.social.cartelInvitacion}
                </Text>
              </View>
              <Pressable testID="cartel-no" style={estilos.no} hitSlop={8} onPress={() => irse(false)}>
                <Text style={estilos.noTexto} maxFontSizeMultiplier={1.3}>{T.social.no}</Text>
              </Pressable>
              <Pressable testID="cartel-aceptar" style={estilos.si} hitSlop={4} onPress={() => irse(true)}>
                <Text style={estilos.siTexto} maxFontSizeMultiplier={1.3}>{T.social.aceptar}</Text>
                <Animated.View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, { transform: [{ translateX: brillo.interpolate({ inputRange: [0, 1], outputRange: [-90, 90] }) }] }]}
                >
                  <LinearGradient
                    colors={['transparent', conAlfa(C.brillo, 0.6), 'transparent']}
                    start={{ x: 0, y: 0.4 }}
                    end={{ x: 1, y: 0.6 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
              </Pressable>
            </Animated.View>
          </View>
          <Animated.View style={[estilos.mecha, { opacity: resto }]}>
            <Animated.View testID="invitacion-mecha" style={[estilos.fuego, { width: mecha.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}>
              <LinearGradient colors={[C.mechaOscura, C.mecha, C.chispaClara]} locations={[0, 0.7, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              <Animated.View style={[estilos.chispa, { opacity: chispa.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }), transform: [{ scale: chispa.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }] }]} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  lugar: { position: 'absolute', top: 54, left: MARGEN, right: MARGEN, alignItems: 'center' },
  sombra: {
    height: ALTO,
    backgroundColor: C.hoja,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  pildora: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    backgroundColor: C.hoja,
  },
  fila: { height: ALTO, flexDirection: 'row', alignItems: 'center' },
  cara: { width: ALTO, height: ALTO, alignItems: 'center', justifyContent: 'center' },
  resto: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 10 },
  textos: { flex: 1, minWidth: 0 },
  nombre: { color: C.tinta, fontSize: 14, fontWeight: '600' },
  que: { color: C.sub, fontSize: 13, marginTop: 1 },
  no: { borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineaFuerte, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  noTexto: { color: C.sub, fontSize: 13 },
  si: { backgroundColor: C.tinta, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13, overflow: 'hidden' },
  siTexto: { color: C.fondo, fontSize: 13, fontWeight: '600' },
  mecha: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: C.linea },
  fuego: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  chispa: {
    position: 'absolute',
    right: -5,
    top: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: C.chispa,
    shadowColor: C.chispaClara,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
});
