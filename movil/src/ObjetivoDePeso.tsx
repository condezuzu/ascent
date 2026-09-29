import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CLAVE_OBJETIVO_PESO, leerObjetivo, llego, objetivoValido, rumboDelPaso } from '@nucleo/pesoObjetivo';
import { aKilos, conComa, deKilos, type Unidad } from '@nucleo/peso';
import { T } from '@nucleo/textos';
import { plataforma } from '@plataforma';
import { C } from './colores';

/**
 * EL OBJETIVO DE PESO: un número al que se quiere llegar. Va arriba de la lista
 * de peso en Stats. De él sale el color de cada cambio (acercarse / alejarse) y
 * el momento lindo de haber llegado. Ver `nucleo/pesoObjetivo.ts`.
 *
 * SIN OBJETIVO no se pinta nada; con objetivo y ESTANDO en él, se dice —"llegar"
 * deja de tener sentido y el número se muestra encendido, no como un paso más—.
 * Vive en el aparato, como la meta de pasos: no hace falta migración.
 */
export default function ObjetivoDePeso({
  objetivo,
  unidad,
  pesoActual,
  recientes = [],
  alCambiar,
}: {
  objetivo: number | null; // kg
  unidad: Unidad;
  pesoActual: number | null; // kg, el último peso anotado
  /** Los últimos pesos (kg), del más viejo al más nuevo: para el mini-trend. */
  recientes?: { fecha: string; valor: number }[];
  alCambiar: (kg: number | null) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');
  const [error, setError] = useState('');

  async function guardar() {
    const escrito = Number(valor.replace(',', '.'));
    const enKilos = aKilos(escrito, unidad);
    if (!valor || isNaN(escrito) || !objetivoValido(enKilos)) return setError(T.stats.objetivoFuera);
    setError('');
    const kg = Math.round(enKilos * 100) / 100;
    setEditando(false);
    alCambiar(kg);
    await plataforma.almacenamiento.guardar(CLAVE_OBJETIVO_PESO, String(kg)).catch(() => {});
  }

  async function borrar() {
    setEditando(false);
    alCambiar(null);
    await plataforma.almacenamiento.guardar(CLAVE_OBJETIVO_PESO, '').catch(() => {});
  }

  if (editando) {
    return (
      <View style={estilos.editor}>
        <TextInput
          style={estilos.campo}
          keyboardType="decimal-pad"
          autoFocus
          value={valor}
          onChangeText={setValor}
          placeholder={T.stats.objetivoPlaceholder(unidad)}
          placeholderTextColor={C.apagado}
          onSubmitEditing={guardar}
        />
        <Pressable onPress={guardar} hitSlop={8} style={estilos.accionBtn}>
          <Text style={estilos.accion}>{T.general.guardar}</Text>
        </Pressable>
        <Pressable onPress={() => setEditando(false)} hitSlop={8} style={estilos.accionBtn}>
          <Text style={estilos.apagada}>{T.general.cancelar}</Text>
        </Pressable>
        {objetivo !== null && (
          <Pressable onPress={borrar} hitSlop={8} style={estilos.accionBtn}>
            <Text style={estilos.apagada}>{T.stats.objetivoQuitar}</Text>
          </Pressable>
        )}
        {error !== '' && <Text style={estilos.error}>{error}</Text>}
      </View>
    );
  }

  // Sin objetivo: una invitación tenue.
  if (objetivo === null) {
    return (
      <Pressable onPress={() => { setValor(''); setEditando(true); }} hitSlop={8} style={estilos.pill}>
        <Text style={estilos.pillTexto}>{T.stats.objetivoPoner}</Text>
      </Pressable>
    );
  }

  const enObjetivo = pesoActual !== null && llego(pesoActual, objetivo);
  const objLindo = conComa(deKilos(objetivo, unidad).toFixed(1));

  // EN EL OBJETIVO: el momento lindo. No es un dato más — el número va encendido
  // y se dice que llegaste. "Acercarse" ya no aplica.
  if (enObjetivo) {
    return (
      <View>
        <Pressable onPress={() => { setValor(objLindo); setEditando(true); }} hitSlop={8} style={estilos.llegado}>
          <Text style={estilos.llegadoTexto}>{T.stats.objetivoLlegado} </Text>
          <Text style={estilos.llegadoNumero}>{objLindo} {unidad}</Text>
          <Text style={estilos.llegadoMarca}> ✓</Text>
        </Pressable>
        <MiniTendencia recientes={recientes} unidad={unidad} objetivo={objetivo} />
      </View>
    );
  }

  return (
    <View>
      <Pressable onPress={() => { setValor(objLindo); setEditando(true); }} hitSlop={8} style={estilos.pill}>
        <Text style={estilos.pillTexto}>{T.stats.objetivoEs(objLindo, unidad)}</Text>
      </Pressable>
      <MiniTendencia recientes={recientes} unidad={unidad} objetivo={objetivo} />
    </View>
  );
}

/**
 * LOS ÚLTIMOS REGISTROS, JUNTO AL OBJETIVO (5.2): tres a cinco pesos en una
 * línea, del más viejo al más nuevo, con una flecha entre cada par pintada según
 * el objetivo (acercarse / alejarse) — la tendencia de un vistazo, sin bajar a la
 * lista. Reusa `rumboDelPaso`, la misma regla de color que la lista.
 */
function MiniTendencia({ recientes, unidad, objetivo }: { recientes: { fecha: string; valor: number }[]; unidad: Unidad; objetivo: number | null }) {
  const ultimos = [...recientes].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-5);
  if (ultimos.length < 2) return null; // con uno no hay tendencia que mostrar
  return (
    <View style={estilos.trend} accessibilityLabel={T.stats.objetivoUltimos}>
      {ultimos.map((p, i) => {
        const previo = i > 0 ? ultimos[i - 1].valor : null;
        const rumbo = previo === null ? null : rumboDelPaso(p.valor, previo, objetivo);
        const subio = previo !== null && p.valor > previo;
        const color =
          rumbo === 'acerca' ? estilos.tBien
          : rumbo === 'aleja' ? estilos.tLejos
          : rumbo === 'llegado' ? estilos.tObj
          : estilos.tNeutro;
        const ultimo = i === ultimos.length - 1;
        return (
          <View key={p.fecha} style={estilos.trendItem}>
            {previo !== null && p.valor !== previo && (
              <Text style={[estilos.trendFlecha, color]}>{subio ? '▲' : '▼'}</Text>
            )}
            <Text style={[estilos.trendValor, ultimo && estilos.trendUltimo]}>
              {conComa(deKilos(p.valor, unidad).toFixed(1))}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  pill: { alignSelf: 'flex-start', marginTop: 12, marginBottom: 2 },
  pillTexto: { color: C.sub, fontSize: 13 },
  llegado: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 12, marginBottom: 2 },
  llegadoTexto: { color: C.sub, fontSize: 13 },
  llegadoNumero: { color: C.claro, fontSize: 15, fontVariant: ['tabular-nums'] },
  llegadoMarca: { color: C.claro, fontSize: 14 },
  editor: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  campo: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    color: C.tinta,
    fontSize: 15,
    minWidth: 96,
    fontVariant: ['tabular-nums'],
  },
  accionBtn: { paddingVertical: 2 },
  accion: { color: C.sub, fontSize: 13 },
  apagada: { color: C.apagado, fontSize: 13 },
  error: { color: C.error, fontSize: 12, width: '100%' },
  // El mini-trend de los últimos registros, debajo del objetivo.
  trend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  trendItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  trendFlecha: { fontSize: 9 },
  trendValor: { color: C.apagado, fontSize: 12, fontVariant: ['tabular-nums'] },
  trendUltimo: { color: C.sub },
  tBien: { color: '#7fae86' },
  tLejos: { color: '#c58f7a' },
  tObj: { color: C.claro },
  tNeutro: { color: C.apagado },
});
