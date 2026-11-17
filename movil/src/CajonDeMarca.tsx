import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, PanResponder, StyleSheet, View } from 'react-native';
import { redondear } from '@nucleo/fuerza';
import { T } from '@nucleo/textos';
import type { MarcaEnElMomento } from '@compartido/marcaSugerida';
import { C, conTema } from './colores';
import { useTema } from './useTema';
import { Text } from './Texto';
import { L } from './fuentes';
import { R } from './roles';

/** Cuánto se queda a la vista antes de irse solo. */
export const CAJON_MS = 5000;

/**
 * LA MARCA NUEVA COMO UN CAJÓN (16/11, a pedido). Entra de izquierda a derecha encima del renglón de la
 * racha y las vidas —tapa eso y nada más: el bloque, que es lo que se toca, queda libre—, se queda cinco
 * segundos y vuelve a salir. Deslizarlo a la izquierda lo cierra antes.
 */
export default function CajonDeMarca({ marca, alCerrar }: { marca: MarcaEnElMomento | null; alCerrar: () => void }) {
  useTema();
  const x = useRef(new Animated.Value(-1)).current;
  const ancho = useRef(400);
  const visible = !!marca && marca.estado === 'guardada' && !!marca.esNueva;
  const clave = visible ? `${marca.ejercicio}:${marca.peso}:${marca.reps}` : null;
  const cerrarRef = useRef(alCerrar);
  cerrarRef.current = alCerrar;

  const salir = useRef((rapido = false) => {
    Animated.timing(x, { toValue: -1, duration: rapido ? 160 : 320, useNativeDriver: true }).start(({ finished }) => {
      if (finished) cerrarRef.current();
    });
  }).current;

  useEffect(() => {
    if (!clave) return;
    let vivo = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((quieto) => {
        if (!vivo) return;
        if (quieto) x.setValue(0);
        else Animated.spring(x, { toValue: 0, damping: 22, stiffness: 180, useNativeDriver: true }).start();
      });
    const t = setTimeout(() => salir(), CAJON_MS);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [clave, x, salir]);

  const gesto = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => x.setValue(Math.min(0, g.dx / ancho.current)),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -40 || g.vx < -0.4) salir(true);
        else Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  if (!visible) return null;
  return (
    <Animated.View
      testID="cajon-de-marca"
      accessibilityLiveRegion="polite"
      onLayout={(e) => (ancho.current = e.nativeEvent.layout.width || 400)}
      style={[estilos.cajon, { borderRightColor: C.principal, transform: [{ translateX: Animated.multiply(x, ancho.current + 40) }] }]}
      {...gesto.panHandlers}
    >
      <Text style={estilos.rotulo}>{T.marcaSugerida.cajonTitulo}</Text>
      <Text style={estilos.nombre} numberOfLines={1}>{marca.nombre}</Text>
      {typeof marca.dotsSubio === 'number' && marca.dotsSubio > 0 && (
        <Text style={estilos.dots}>{T.marcaSugerida.cajonDots(redondear(marca.dotsSubio))}</Text>
      )}
    </Animated.View>
  );
}

const estilos = conTema(() => StyleSheet.create({
  cajon: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: C.hoja,
    borderWidth: 1,
    borderColor: C.linea,
    borderRightWidth: 2,
  },
  rotulo: { ...R.etiqueta, marginBottom: 4 },
  nombre: { color: C.tinta, fontSize: 20, fontWeight: '300' },
  dots: { color: C.claro, fontSize: 13, marginTop: 4, fontFamily: L.dato },
}));
