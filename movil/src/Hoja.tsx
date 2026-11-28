import { useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, Animated, useWindowDimensions } from 'react-native';
import { T } from '@nucleo/textos';
import { C, conTema } from './colores';
import { useTema } from './useTema';
import FondoOctogonal from './FondoOctogonal';
import { MS, useQueSube } from './movimiento';

/**
 * UNA HOJA QUE SUBE DESDE ABAJO, con el fondo oscurecido que la cierra.
 *
 * Es `Modal` de React Native y no una pantalla apilada: el selector de
 * ejercicios y la lista de lo hecho son preguntas sobre lo que está en
 * pantalla, no lugares a los que se va. Por eso tampoco hace falta un router
 * todavía (ver `Pestanas`).
 *
 * Con el teclado arriba la hoja sube: los pesos de la lista se escriben ahí.
 *
 * `pie`: lo que queda fijo abajo, fuera de lo que se desplaza (el «Listo» de la lista de hoy, 27/11, a pedido: con la
 * lista larga había que bajar hasta el final para cerrarla).
 * `alMedio`: dónde está, dentro de lo que se desplaza, lo que tiene que abrir en el medio.
 */
export default function Hoja({
  visible,
  alCerrar,
  children,
  desplazable = true,
  pie,
  alMedio,
}: {
  visible: boolean;
  alCerrar: () => void;
  children: ReactNode;
  desplazable?: boolean;
  pie?: ReactNode;
  alMedio?: { y: number; alto: number } | null;
}) {
  useTema();
  const { montada, avance } = useQueSube(visible);
  const { height: alto } = useWindowDimensions();
  const lienzo = useRef<ScrollView>(null);
  const [altoVisible, setAltoVisible] = useState(0);
  // Se acomoda mientras la hoja llega —lo de adentro termina de armarse en ese rato—; después no se mueve sola, que
  // ya la tiene el dedo.
  const nacio = useRef(Date.now()).current;
  const y = alMedio ? alMedio.y + alMedio.alto / 2 : null;
  useEffect(() => {
    if (y === null || altoVisible <= 0 || Date.now() - nacio > MS.hojaEntra + 300) return;
    lienzo.current?.scrollTo({ y: Math.max(0, y - altoVisible / 2), animated: false });
  }, [y, altoVisible, nacio]);
  return (
    <Modal visible={montada} transparent animationType="none" onRequestClose={alCerrar}>
      <KeyboardAvoidingView style={estilos.todo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* El velo no sube con la hoja: se aclara en su lugar, antes de que ella llegue. */}
        <Animated.View style={[estilos.fondo, { opacity: avance.interpolate({ inputRange: [0, 0.65, 1], outputRange: [0, 1, 1] }) }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={alCerrar} accessibilityLabel={T.general.cerrar} />
        </Animated.View>
        {/* Para el barrido: con las cinco pestañas montadas a la vez, un texto
            suelto puede encontrarse en una pantalla que no está. Esto le da a
            la sonda un lugar concreto donde buscar lo que la hoja pregunta. */}
        <Animated.View style={[estilos.hoja, { transform: [{ translateY: avance.interpolate({ inputRange: [0, 1], outputRange: [alto, 0] }) }] }]} testID="hoja">
          <FondoOctogonal relleno={C.hoja} borde={C.linea} corte={14} soloArriba />
          <ScrollView
            ref={lienzo}
            onLayout={(e) => setAltoVisible(e.nativeEvent.layout.height)}
            contentContainerStyle={[estilos.contenido, !!pie && estilos.contenidoConPie]}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={desplazable}
          >
            {children}
          </ScrollView>
          {!!pie && <View style={estilos.pie}>{pie}</View>}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const estilos = conTema(() => StyleSheet.create({
  todo: { flex: 1, justifyContent: 'flex-end' },
  fondo: { ...StyleSheet.absoluteFillObject, backgroundColor: C.veloHoja },
  hoja: {
    maxHeight: '86%',
  },
  contenido: { padding: 22, paddingBottom: 40 },
  contenidoConPie: { paddingBottom: 18 },
  // La línea de arriba dice que lo de la lista sigue por debajo.
  pie: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 40, borderTopWidth: 1, borderTopColor: C.linea },
}));
