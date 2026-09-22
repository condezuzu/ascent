import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { borrarPeso, corregirPeso } from '@compartido/peso';
import { useVersionDelEsquema } from '@compartido/esquema';
import { disponible } from '@nucleo/esquema';
import { fechaCorta } from '@nucleo/fechas';
import { aKilos, conComa, deKilos, limites, type Unidad } from '@nucleo/peso';
import { T } from '@nucleo/textos';
import { supabase } from './supabase';
import { C } from './colores';

/**
 * LO QUE ANOTASTE, con forma de arreglarlo. La misma lista que la web
 * (`components/ListaDePesos.tsx`), con las mismas dos llamadas
 * (`compartido/peso.ts`).
 *
 * POR QUÉ APARECIÓ (22/9): el peso se podía anotar y nada más. Un 82,4 donde
 * iba 84,2 se quedaba para siempre torciendo la tendencia, que es lo único que
 * ese dato hace, y la tabla solo tiene lectura para el cliente — ni el dueño de
 * la cuenta podía arreglarlo. Salió de una sonda que fabricó un peso para una
 * captura y no pudo sacarlo.
 *
 * BORRAR PREGUNTA Y CORREGIR NO. Anotar solo escribe HOY, así que borrar el
 * peso de un día viejo no se deshace; corregir se escribe encima y se vuelve a
 * corregir cuantas veces haga falta.
 */
const CUANTOS = 6;

export default function ListaDePesos({
  pesos,
  unidad,
  alCambiar,
}: {
  /** Solo hace falta la fecha y el número: la fila se identifica por el día,
   * que es único por cuenta, y no por el id de la tabla. Así entra tanto lo que
   * lee la web como lo que lee la nativa, que traen columnas distintas. */
  pesos: { fecha: string; valor: number }[];
  unidad: Unidad;
  alCambiar: () => void;
}) {
  const version = useVersionDelEsquema();
  const [corrigiendo, setCorrigiendo] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [valor, setValor] = useState('');
  const [error, setError] = useState('');

  // Sin la migración 45 las funciones no existen: la lista no aparece, en vez
  // de aparecer con dos botones que darían error.
  if (!disponible('corregirPeso', version) || pesos.length === 0) return null;

  async function guardar(fecha: string) {
    setError('');
    const escrito = Number(valor.replace(',', '.'));
    const tope = limites(unidad);
    if (!valor || isNaN(escrito) || escrito < tope.min || escrito > tope.max) return setError(T.peso.noDa);
    const r = await corregirPeso(supabase, version, fecha, Math.round(aKilos(escrito, unidad) * 100) / 100);
    if (r === false) return setError(T.general.noSePudo);
    if (r === null) return setError(T.peso.noSeCorrigio);
    setCorrigiendo(null);
    setValor('');
    alCambiar();
  }

  async function borrar(fecha: string) {
    setError('');
    const r = await borrarPeso(supabase, version, fecha);
    if (!r) return setError(T.general.noSePudo);
    setBorrando(null);
    alCambiar();
  }

  return (
    <View style={estilos.lista}>
      <Text style={estilos.rotulo}>{T.peso.anotados}</Text>
      {[...pesos]
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .slice(0, CUANTOS)
        .map((p) => (
          <View style={estilos.fila} key={p.fecha}>
            <Text style={estilos.cuando}>{fechaCorta(p.fecha)}</Text>

            {corrigiendo === p.fecha ? (
              <>
                <TextInput
                  style={estilos.campo}
                  keyboardType="decimal-pad"
                  autoFocus
                  value={valor}
                  onChangeText={setValor}
                  placeholder={T.peso.placeholder(unidad)}
                  placeholderTextColor={C.apagado}
                />
                <Pressable onPress={() => guardar(p.fecha)} hitSlop={8}>
                  <Text style={estilos.accion}>{T.general.guardar}</Text>
                </Pressable>
                <Pressable onPress={() => setCorrigiendo(null)} hitSlop={8}>
                  <Text style={estilos.apagada}>{T.general.cancelar}</Text>
                </Pressable>
              </>
            ) : borrando === p.fecha ? (
              <>
                <Text style={estilos.pregunta}>{T.peso.borrarSeguro}</Text>
                <Pressable onPress={() => borrar(p.fecha)} hitSlop={8}>
                  <Text style={estilos.peligro}>{T.peso.borrarSi}</Text>
                </Pressable>
                <Pressable onPress={() => setBorrando(null)} hitSlop={8}>
                  <Text style={estilos.apagada}>{T.general.cancelar}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={estilos.valor}>
                  {conComa(deKilos(p.valor, unidad).toFixed(1))} {unidad}
                </Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setBorrando(null);
                    setCorrigiendo(p.fecha);
                    setValor(conComa(deKilos(p.valor, unidad).toFixed(1)));
                  }}
                >
                  <Text style={estilos.accion}>{T.peso.corregir}</Text>
                </Pressable>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setCorrigiendo(null);
                    setBorrando(p.fecha);
                  }}
                >
                  <Text style={estilos.apagada}>{T.peso.borrar}</Text>
                </Pressable>
              </>
            )}
          </View>
        ))}
      {error !== '' && <Text style={estilos.error}>{error}</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { marginTop: 16 },
  rotulo: { color: C.apagado, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.linea,
  },
  cuando: { color: C.apagado, fontSize: 13, minWidth: 62 },
  valor: { color: C.tinta, fontSize: 14, flex: 1, fontVariant: ['tabular-nums'] },
  pregunta: { color: C.sub, fontSize: 12, flex: 1, lineHeight: 16 },
  campo: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: C.tinta,
    fontSize: 14,
  },
  accion: { color: C.sub, fontSize: 13 },
  apagada: { color: C.apagado, fontSize: 13 },
  peligro: { color: C.error, fontSize: 13 },
  error: { color: C.error, fontSize: 13, marginTop: 8 },
});
