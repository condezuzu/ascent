import { Image, Modal, Pressable, StyleSheet, Text } from 'react-native';
import { T } from '@nucleo/textos';
import { C } from './colores';

/**
 * LA FOTO DE PERFIL, GRANDE (8/10/2026).
 *
 * Un toque en cualquier lado la cierra: es mirar y salir, no un visor. La foto
 * de perfil es pública desde siempre (bucket `avatares`), así que acá no hay
 * permiso que pedir ni firma que venza.
 */
export default function FotoGrande({ url, onCerrar }: { url: string | null; onCerrar: () => void }) {
  return (
    <Modal visible={!!url} transparent animationType="fade" onRequestClose={onCerrar} statusBarTranslucent>
      <Pressable testID="foto-grande" style={estilos.fondo} onPress={onCerrar} accessibilityRole="button" accessibilityLabel={T.social.cerrarFoto}>
        {url ? <Image source={{ uri: url }} style={estilos.foto} resizeMode="contain" /> : null}
        <Text style={estilos.cerrar}>{T.social.cerrarFoto}</Text>
      </Pressable>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  foto: { width: '100%', height: '78%' },
  cerrar: { color: C.sub, fontSize: 15, marginTop: 18 },
});
