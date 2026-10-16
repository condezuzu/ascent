import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { T } from '@nucleo/textos';
import { C } from './colores';

/**
 * EL GLOBO DE CÓMIC (15/10, aprobado en la galería): el globito de siempre, del
 * ancho de su texto, con una colita que sale de lo que explica. Antes los globos
 * flotaban en el medio y no apuntaban a nada, y el del + tapaba el ejercicio.
 *
 * Va DEBAJO del elemento del que habla, con un ancla de alto cero: flota sin
 * correr nada. `colaX` es dónde está ese elemento, en puntos desde el borde
 * izquierdo del contenedor; `alinear` decide hacia dónde crece el globo. `subir`
 * descuenta el margen de abajo del elemento, para que la cola salga de él y no del aire.
 */
export default function GloboComic({
  texto,
  alCerrar,
  colaX,
  alinear = 'izquierda',
  subir = 0,
  testID,
}: {
  texto: string;
  alCerrar: () => void;
  colaX: number;
  alinear?: 'izquierda' | 'centro' | 'derecha';
  subir?: number;
  testID?: string;
}) {
  const opacidad = useRef(new Animated.Value(0)).current;
  const cerrando = useRef(false);
  const [ancho, setAncho] = useState(0);
  const [anchoGlobo, setAnchoGlobo] = useState(0);
  const medido = ancho > 0 && anchoGlobo > 0;

  // Aparece recién medido: centrado sin medir saltaría de lugar.
  useEffect(() => {
    if (medido) Animated.timing(opacidad, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [medido, opacidad]);

  function cerrar() {
    if (cerrando.current) return;
    cerrando.current = true;
    Animated.timing(opacidad, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => alCerrar());
  }

  const izquierda =
    alinear === 'izquierda'
      ? 0
      : alinear === 'derecha'
        ? Math.max(0, ancho - anchoGlobo)
        : Math.min(Math.max(0, colaX - anchoGlobo / 2), Math.max(0, ancho - anchoGlobo));

  return (
    <View style={estilos.ancla} pointerEvents="box-none">
      <Animated.View style={[estilos.capa, { top: 9 - subir, opacity: opacidad }]} pointerEvents="box-none" onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
        <Pressable
          testID={testID}
          onLayout={(e) => setAnchoGlobo(e.nativeEvent.layout.width)}
          style={[estilos.globo, { left: izquierda, maxWidth: ancho || undefined }]}
          onPress={cerrar}
          accessibilityRole="button"
          accessibilityHint={T.general.entendido}
        >
          <Text style={estilos.texto} numberOfLines={1}>
            {texto}
          </Text>
          {/* Una cruz de dos rayas, sin SVG: son dos vistas rotadas. */}
          <View style={estilos.cruz}>
            <View style={[estilos.raya, { transform: [{ rotate: '45deg' }] }]} />
            <View style={[estilos.raya, { transform: [{ rotate: '-45deg' }] }]} />
          </View>
        </Pressable>
        {/* La cola: un cuadrado girado con el borde en los dos lados de afuera, encima del borde del globo. */}
        <View pointerEvents="none" style={[estilos.cola, { left: colaX - 6 }]} />
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  ancla: { height: 0, zIndex: 30, elevation: 30 },
  capa: { position: 'absolute', top: 9, left: 0, right: 0 },
  globo: {
    position: 'absolute',
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    backgroundColor: C.hoja,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  texto: { color: C.tinta, fontSize: 13, flexShrink: 1 },
  cruz: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  raya: { position: 'absolute', width: 12, height: 1.4, borderRadius: 1, backgroundColor: C.apagado },
  cola: {
    position: 'absolute',
    top: -5.5,
    width: 12,
    height: 12,
    backgroundColor: C.hoja,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    transform: [{ rotate: '45deg' }],
  },
});
