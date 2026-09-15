import { Pressable, StyleSheet, Text, View } from 'react-native';
import { pesoCorto, type Unidad } from '@nucleo/peso';
import { REPETICIONES_PARA_MARCA } from '@nucleo/marcaSugerida';
import { T } from '@nucleo/textos';
import { usarSugerenciasDeMarca } from '@compartido/marcaSugerida';
import { C } from './colores';

/**
 * "¿LO GUARDO COMO MARCA?", en el resumen nativo. Qué se propone lo decide
 * `nucleo/marcaSugerida.ts` y lo busca y guarda `compartido/`: igual que la web.
 */
export default function SugerenciasDeMarca({ bloques, unidad }: { bloques: unknown; unidad: Unidad }) {
  const { lista, guardar, descartar } = usarSugerenciasDeMarca(bloques);
  if (lista.length === 0) return null;
  return (
    <View style={estilos.todo} onStartShouldSetResponder={() => true}>
      {lista.map((s) => (
        <View key={s.ejercicio} style={estilos.una}>
          <Text style={estilos.texto}>
            {(s.antes === null ? T.marcaSugerida.primera : T.marcaSugerida.masQueTuMarca)(pesoCorto(s.peso, unidad), unidad, s.nombre)}
          </Text>
          {s.estado === 'guardada' || s.estado === 'fallo' ? (
            <Text style={estilos.hecho}>{s.estado === 'guardada' ? T.marcaSugerida.guardada : T.marcaSugerida.fallo}</Text>
          ) : (
            <>
              <Text style={estilos.cuantas}>{T.marcaSugerida.cuantas}</Text>
              <View style={estilos.reps}>
                {REPETICIONES_PARA_MARCA.map((r) => (
                  <Pressable key={r} style={estilos.rep} disabled={s.estado === 'guardando'} onPress={() => guardar(s, r)}>
                    <Text style={estilos.repTexto}>{r}</Text>
                  </Pressable>
                ))}
                <Pressable style={[estilos.rep, estilos.no]} onPress={() => descartar(s)}>
                  <Text style={estilos.noTexto}>{T.marcaSugerida.no}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  todo: { marginTop: 22, gap: 18 },
  una: {},
  texto: { color: C.tinta, fontSize: 15, lineHeight: 21, marginBottom: 8 },
  hecho: { color: C.sub, fontSize: 13 },
  cuantas: { color: C.apagado, fontSize: 12, marginBottom: 6 },
  reps: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rep: {
    minWidth: 40,
    minHeight: 40,
    borderWidth: 1,
    borderColor: C.linea,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  repTexto: { color: C.tinta, fontSize: 14, fontVariant: ['tabular-nums'] },
  no: { paddingHorizontal: 14 },
  noTexto: { color: C.sub, fontSize: 14 },
});
