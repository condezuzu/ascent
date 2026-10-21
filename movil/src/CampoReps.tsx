import { StyleSheet, Text, TextInput, View } from 'react-native';
import { T } from '@nucleo/textos';
import { C } from './colores';

/**
 * LAS REPETICIONES DE LA PRÓXIMA SERIE (21/10): la caja de `CampoPeso`, sin los botones.
 *
 * A diferencia del peso, avisa a cada tecla: el + que viene después las anota y el cuadradito
 * vuelve a quedar vacío, así que no hay un número "a medio escribir" que se quede pegado.
 * La pista en gris son las de la última vez; no se anotan si no se escriben.
 */
export default function CampoReps({
  reps,
  pista,
  alCambiar,
}: {
  reps: number | undefined;
  pista: number | null | undefined;
  alCambiar: (n: number | null) => void;
}) {
  return (
    <View style={estilos.caja}>
      <TextInput
        testID="campo-reps"
        style={estilos.input}
        value={reps !== undefined ? String(reps) : ''}
        onChangeText={(v) => {
          const cifras = v.replace(/\D/g, '').slice(0, 3);
          alCambiar(cifras ? Number(cifras) : null);
        }}
        keyboardType="number-pad"
        returnKeyType="done"
        placeholder={pista ? String(pista) : ''}
        placeholderTextColor={C.apagado}
        accessibilityLabel={T.sesion.repsDeLaSerie}
        selectTextOnFocus
      />
      <Text style={estilos.unidad}>{T.sesion.reps}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.lineaFuerte,
    paddingVertical: 2,
  },
  // Ancho fijo, por lo mismo que el peso: en web un campo sin ancho ocupa la fila entera.
  input: { color: C.tinta, fontSize: 22, width: 44, textAlign: 'right', fontVariant: ['tabular-nums'], padding: 0 },
  unidad: { color: C.apagado, fontSize: 12 },
});
