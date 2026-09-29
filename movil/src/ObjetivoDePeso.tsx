import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CLAVE_OBJETIVO_PESO, leerObjetivo, llego, objetivoValido } from '@nucleo/pesoObjetivo';
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
  alCambiar,
}: {
  objetivo: number | null; // kg
  unidad: Unidad;
  pesoActual: number | null; // kg, el último peso anotado
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
      <Pressable onPress={() => { setValor(objLindo); setEditando(true); }} hitSlop={8} style={estilos.llegado}>
        <Text style={estilos.llegadoTexto}>{T.stats.objetivoLlegado} </Text>
        <Text style={estilos.llegadoNumero}>{objLindo} {unidad}</Text>
        <Text style={estilos.llegadoMarca}> ✓</Text>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={() => { setValor(objLindo); setEditando(true); }} hitSlop={8} style={estilos.pill}>
      <Text style={estilos.pillTexto}>{T.stats.objetivoEs(objLindo, unidad)}</Text>
    </Pressable>
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
});
