import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, conAlfa } from './colores';

/**
 * UNA ELECCIÓN ENTRE POCAS, EN UNA SOLA PIEZA (15/10/2026). Ajustes eran pastillas
 * sueltas, todas iguales, una al lado de la otra: se leían como botones
 * repetidos y no como "una de estas". Unidas, se ve de un vistazo que es una
 * sola pregunta y cuál está elegida.
 */
export default function Segmentado<V>({
  opciones,
  valor,
  alElegir,
}: {
  opciones: readonly { valor: V; texto: string; testID?: string }[];
  valor: V;
  alElegir: (v: V) => void;
}) {
  return (
    <View style={estilos.caja} accessibilityRole="radiogroup">
      {opciones.map((o, i) => {
        const elegida = o.valor === valor;
        return (
          <Pressable
            key={String(o.valor)}
            testID={o.testID}
            onPress={() => alElegir(o.valor)}
            style={[estilos.parte, i > 0 && estilos.separada, elegida && estilos.elegida]}
            accessibilityRole="radio"
            accessibilityState={{ selected: elegida }}
          >
            <Text style={[estilos.texto, elegida && estilos.textoElegido]} numberOfLines={1}>
              {o.texto}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 12,
    overflow: 'hidden',
  },
  parte: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, paddingHorizontal: 6 },
  separada: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: C.lineaFuerte },
  elegida: { backgroundColor: conAlfa(C.claro, 0.14) },
  texto: { color: C.apagado, fontSize: 14 },
  textoElegido: { color: C.tinta, fontWeight: '600' },
});
