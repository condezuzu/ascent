import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { T } from '@nucleo/textos';
import { C } from './colores';

/**
 * EL GLOBITO (15/10): un renglón que FLOTA encima de la pantalla y la tapa, sin
 * correr nada para abajo. Antes ocupaba su lugar y empujaba todo; quedaba feo y
 * movía el botón que se estaba por tocar. Está para dar calidad, no para
 * explicar: poco texto, y un toque en cualquier lado lo saca.
 *
 * El ancla no mide nada (alto cero): el globo se dibuja desde ahí hacia abajo,
 * por encima de lo que siga.
 */
export default function Globito({ texto, alCerrar, testID }: { texto: string; alCerrar: () => void; testID?: string }) {
  const opacidad = useRef(new Animated.Value(0)).current;
  const cerrando = useRef(false);

  useEffect(() => {
    Animated.timing(opacidad, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [opacidad]);

  function cerrar() {
    if (cerrando.current) return;
    cerrando.current = true;
    Animated.timing(opacidad, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => alCerrar());
  }

  return (
    <View style={estilos.ancla} pointerEvents="box-none">
      <Animated.View style={[estilos.globo, { opacity: opacidad }]}>
        <Pressable testID={testID} style={estilos.toque} onPress={cerrar} accessibilityRole="button" accessibilityHint={T.general.entendido}>
          {/* Dos renglones (21/10): el aviso de subir el peso dice el rango, y en uno se cortaba. */}
          <Text style={estilos.texto} numberOfLines={2}>
            {texto}
          </Text>
          {/* Una cruz de dos rayas, sin SVG: son dos vistas rotadas. */}
          <View style={estilos.cruz}>
            <View style={[estilos.raya, { transform: [{ rotate: '45deg' }] }]} />
            <View style={[estilos.raya, { transform: [{ rotate: '-45deg' }] }]} />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  ancla: { height: 0, zIndex: 30, elevation: 30 },
  globo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    backgroundColor: C.hoja,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  toque: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  texto: { flex: 1, color: C.tinta, fontSize: 13 },
  cruz: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  raya: { position: 'absolute', width: 12, height: 1.4, borderRadius: 1, backgroundColor: C.apagado },
});
