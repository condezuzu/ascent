import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Semana } from '@nucleo/volumen';
import { T } from '@nucleo/textos';
import { C, conAlfa } from './colores';

const ALTO = 72;

/**
 * EL PESO TOTAL POR SEMANA (15/10/2026): uno solo, no uno por ejercicio. Una
 * barra por semana, con la escala de la semana más pesada; la elegida se pinta
 * entera y su número va arriba. Tocar una barra elige esa semana también para
 * las filas de músculos de arriba: es la misma pregunta mirada de otro lado.
 */
export default function KilosPorSemana({
  semanas,
  elegida,
  alElegir,
  color,
  enUnidad,
  unidad,
}: {
  semanas: Semana[];
  elegida: number;
  alElegir: (i: number) => void;
  color: string;
  /** Kilos → texto en la unidad de la persona. */
  enUnidad: (kg: number) => string;
  unidad: string;
}) {
  const tope = Math.max(1, ...semanas.map((s) => s.kilos));
  const leida = semanas[elegida];
  return (
    <View testID="kilos-por-semana" style={estilos.caja}>
      <Text style={estilos.rotulo}>{T.volumen.kilosPorSemana}</Text>
      <Text style={estilos.numero}>
        {leida ? enUnidad(leida.kilos) : '—'} <Text style={estilos.unidad}>{unidad}</Text>
      </Text>
      <View style={estilos.barras}>
        {semanas.map((s, i) => (
          <Pressable
            key={s.desde}
            style={estilos.columna}
            onPress={() => alElegir(i)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={`${T.volumen.semanaDel(s.desde)}: ${enUnidad(s.kilos)} ${unidad}`}
          >
            <View
              style={[
                estilos.barra,
                { height: Math.max(2, (s.kilos / tope) * ALTO), backgroundColor: i === elegida ? color : conAlfa(color, 0.35) },
              ]}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: { marginTop: 18 },
  rotulo: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  numero: { color: C.tinta, fontSize: 22, fontVariant: ['tabular-nums'], marginTop: 6, marginBottom: 10 },
  unidad: { color: C.sub, fontSize: 13 },
  barras: { flexDirection: 'row', alignItems: 'flex-end', height: ALTO, gap: 4 },
  columna: { flex: 1, height: ALTO, justifyContent: 'flex-end' },
  barra: { borderRadius: 3 },
});
