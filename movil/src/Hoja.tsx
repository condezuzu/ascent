import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { T } from '@nucleo/textos';
import { C, conTema } from './colores';
import { useTema } from './useTema';
import FondoOctogonal from './FondoOctogonal';

/**
 * UNA HOJA QUE SUBE DESDE ABAJO, con el fondo oscurecido que la cierra.
 *
 * Es `Modal` de React Native y no una pantalla apilada: el selector de
 * ejercicios y la lista de lo hecho son preguntas sobre lo que está en
 * pantalla, no lugares a los que se va. Por eso tampoco hace falta un router
 * todavía (ver `Pestanas`).
 *
 * Con el teclado arriba la hoja sube: los pesos de la lista se escriben ahí.
 */
export default function Hoja({ visible, alCerrar, children }: { visible: boolean; alCerrar: () => void; children: ReactNode }) {
  useTema();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={alCerrar}>
      <KeyboardAvoidingView style={estilos.todo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={estilos.fondo} onPress={alCerrar} accessibilityLabel={T.general.cerrar} />
        {/* Para el barrido: con las cinco pestañas montadas a la vez, un texto
            suelto puede encontrarse en una pantalla que no está. Esto le da a
            la sonda un lugar concreto donde buscar lo que la hoja pregunta. */}
        <View style={estilos.hoja} testID="hoja">
          <FondoOctogonal relleno={C.hoja} borde={C.linea} corte={14} soloArriba />
          <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
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
}));
