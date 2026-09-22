import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { aKilos, limites, type Unidad } from '@nucleo/peso';
import { T } from '@nucleo/textos';
import { supabase } from './supabase';
import { C } from './colores';

/**
 * EL CAMPO DEL PESO, suelto: el mismo que la web (`components/AnotarPeso.tsx`).
 *
 * VIVÍA ADENTRO DE `StatsGeneral` y salió de ahí el 22/9, cuando Inicio
 * también necesitó anotar el peso. Que la única puerta estuviera en Stats era
 * media función: el peso se anota a la mañana, y a la mañana se abre Inicio.
 *
 * EL PESO NO REGISTRA EL DÍA, y ese es el motivo de que tenga su propia
 * puerta: estuvo colgado de la hoja de registrar hasta el 27/8 y pesarse un
 * domingo contaba como día de gimnasio.
 *
 * LOS LÍMITES SALEN DEL NÚCLEO (`nucleo/peso.ts`), en la unidad que se está
 * escribiendo: escribir 80 en libras no es lo mismo que en kilos.
 */
export default function AnotarPeso({ unidad, alGuardar }: { unidad: Unidad; alGuardar: () => void }) {
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function guardar() {
    setError('');
    // La coma es lo que sale del teclado en español y `Number` no la entiende.
    const escrito = Number(valor.replace(',', '.'));
    const tope = limites(unidad);
    if (!valor || isNaN(escrito) || escrito < tope.min || escrito > tope.max) return setError(T.peso.noDa);
    setGuardando(true);
    const { error: err } = await supabase.rpc('anotar_peso', {
      p_valor: Math.round(aKilos(escrito, unidad) * 100) / 100,
    });
    setGuardando(false);
    if (err) return setError(T.general.noSePudo);
    setValor('');
    alGuardar();
  }

  return (
    <View>
      <View style={estilos.anotar}>
        <TextInput
          style={estilos.campo}
          keyboardType="decimal-pad"
          placeholder={T.peso.placeholder(unidad)}
          placeholderTextColor={C.apagado}
          value={valor}
          onChangeText={setValor}
        />
        <Pressable style={estilos.botonFantasma} onPress={guardar} disabled={guardando}>
          <Text style={estilos.textoBoton}>{guardando ? '…' : T.peso.anotar}</Text>
        </Pressable>
      </View>
      <Text style={estilos.nota}>{T.peso.privado}</Text>
      {!!error && <Text style={estilos.error}>{error}</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  anotar: { flexDirection: 'row', gap: 8, marginTop: 10 },
  campo: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: C.tinta,
    fontSize: 15,
  },
  botonFantasma: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  textoBoton: { color: C.tinta, fontSize: 14 },
  nota: { color: C.apagado, fontSize: 12, lineHeight: 17, marginTop: 6 },
  error: { color: C.error, fontSize: 13, marginTop: 6 },
});
