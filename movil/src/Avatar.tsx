import { Image, StyleSheet, Text, View } from 'react-native';
import { C } from './colores';

/**
 * La cara de alguien en una lista: su foto, o la inicial de su nombre.
 * El mismo criterio que `src/components/Avatar.tsx` de la web.
 */
export default function Avatar({ url, nombre, tam = 34 }: { url: string | null; nombre: string | null; tam?: number }) {
  const caja = { width: tam, height: tam, borderRadius: tam / 2 };
  return (
    <View style={[estilos.avatar, caja]}>
      {url ? (
        <Image source={{ uri: url }} style={caja} />
      ) : (
        <Text style={[estilos.inicial, { fontSize: tam * 0.42 }]}>{(nombre ?? '?').charAt(0).toUpperCase()}</Text>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  avatar: {
    backgroundColor: C.hoja,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inicial: { color: C.sub },
});
