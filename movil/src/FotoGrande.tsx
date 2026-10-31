import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { T } from '@nucleo/textos';
import { C, conTema } from './colores';
import { useTema } from './useTema';

/**
 * LA FOTO DE PERFIL, GRANDE (8/10/2026).
 *
 * Un toque en cualquier lado la cierra: es mirar y salir, no un visor. La foto
 * de perfil es pública desde siempre (bucket `avatares`), así que acá no hay
 * permiso que pedir ni firma que venza.
 */
export default function FotoGrande({ url, onCerrar, alCambiar }: { url: string | null; onCerrar: () => void; alCambiar?: () => void }) {
  useTema();
  return (
    <Modal visible={!!url} transparent animationType="fade" onRequestClose={onCerrar} statusBarTranslucent>
      <Pressable testID="foto-grande" style={estilos.fondo} onPress={onCerrar} accessibilityRole="button" accessibilityLabel={T.social.cerrarFoto}>
        {url ? <Image source={{ uri: url }} style={estilos.foto} resizeMode="contain" /> : null}
        {alCambiar ? (
          <View style={estilos.botones}>
            <Pressable
              testID="foto-grande-cambiar"
              style={estilos.solido}
              onPress={() => {
                onCerrar();
                // El selector del sistema no abre mientras la hoja todavía se está yendo.
                setTimeout(alCambiar, 350);
              }}
            >
              <Text style={estilos.solidoTexto}>{T.yo.cambiarFotoCorto}</Text>
            </Pressable>
            <Pressable style={estilos.borde} onPress={onCerrar}>
              <Text style={estilos.bordeTexto}>{T.social.cerrarFoto}</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={estilos.cerrar}>{T.social.cerrarFoto}</Text>
        )}
      </Pressable>
    </Modal>
  );
}

const estilos = conTema(() => StyleSheet.create({
  fondo: { flex: 1, backgroundColor: C.veloFoto, alignItems: 'center', justifyContent: 'center' },
  foto: { width: '100%', height: '78%' },
  cerrar: { color: C.sub, fontSize: 15, marginTop: 18 },
  botones: { flexDirection: 'row', gap: 12, marginTop: 18 },
  solido: { backgroundColor: C.tinta, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 22 },
  solidoTexto: { color: C.fondo, fontSize: 15, fontWeight: '600' },
  borde: { borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineaFuerte, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 22 },
  bordeTexto: { color: C.tinta, fontSize: 15 },
}));
