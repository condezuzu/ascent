import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
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
 *
 * EL VISUAL, MENOS PLANO (item 5.5). Era cuatro textos en fila y se leía como
 * una tabla de depuración. Ahora cada fila tiene JERARQUÍA —la fecha en voz
 * baja, el peso grande, y al lado el cambio contra la marca anterior, que es lo
 * único que este número hace: mostrar la tendencia— y las acciones son botones
 * con ícono (lápiz y tacho), del mismo trazo que el resto de la app, en vez de
 * dos enlaces de texto. La fecha, el peso, corregir y borrar siguen todos.
 */
const CUANTOS = 6;

function IconoLapiz() {
  return (
    <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={C.sub} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 20l4-1L18.5 8.5l-3-3L5 16z" />
      <Path d="M14.5 6.5l3 3" />
    </Svg>
  );
}

function IconoTacho() {
  return (
    <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={C.apagado} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 7h16" />
      <Path d="M9 7V5h6v2" />
      <Path d="M6.5 7l1 12.5h9L17.5 7" />
    </Svg>
  );
}

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

  // De más nuevo a más viejo, y el cambio de cada uno contra el de ABAJO (el
  // anterior en el tiempo). El delta se calcula sobre la lista entera antes de
  // recortar: así la marca más vieja que se muestra igual sabe contra qué
  // compararse. En kilos internos; se convierte a la unidad al mostrarlo.
  const orden = [...pesos].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const conDelta = orden.map((p, i) => ({
    ...p,
    delta: i < orden.length - 1 ? p.valor - orden[i + 1].valor : null,
  }));

  return (
    <View style={estilos.lista}>
      <Text style={estilos.rotulo}>{T.peso.anotados}</Text>
      {conDelta.slice(0, CUANTOS).map((p) => {
        const editando = corrigiendo === p.fecha;
        const preguntando = borrando === p.fecha;
        // El delta en la unidad de la persona, redondeado a un decimal. Se
        // esconde si es 0,0: "sin cambio" no es una flecha, es nada.
        const dLindo = p.delta === null ? null : deKilos(p.valor, unidad) - deKilos(p.valor - p.delta, unidad);
        const dRedondo = dLindo === null ? 0 : Math.round(dLindo * 10) / 10;
        return (
          <View style={[estilos.fila, (editando || preguntando) && estilos.filaActiva]} key={p.fecha}>
            <Text style={estilos.cuando}>{fechaCorta(p.fecha)}</Text>

            {editando ? (
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
                <Pressable onPress={() => guardar(p.fecha)} hitSlop={8} style={estilos.textoBoton}>
                  <Text style={estilos.accion}>{T.general.guardar}</Text>
                </Pressable>
                <Pressable onPress={() => setCorrigiendo(null)} hitSlop={8} style={estilos.textoBoton}>
                  <Text style={estilos.apagada}>{T.general.cancelar}</Text>
                </Pressable>
              </>
            ) : preguntando ? (
              <>
                <Text style={estilos.pregunta}>{T.peso.borrarSeguro}</Text>
                <Pressable onPress={() => borrar(p.fecha)} hitSlop={8} style={estilos.textoBoton}>
                  <Text style={estilos.peligro}>{T.peso.borrarSi}</Text>
                </Pressable>
                <Pressable onPress={() => setBorrando(null)} hitSlop={8} style={estilos.textoBoton}>
                  <Text style={estilos.apagada}>{T.general.cancelar}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={estilos.dato}>
                  <Text style={estilos.valor}>
                    {conComa(deKilos(p.valor, unidad).toFixed(1))}
                    <Text style={estilos.unidad}> {unidad}</Text>
                  </Text>
                  {dRedondo !== 0 && (
                    <Text style={[estilos.delta, dRedondo > 0 ? estilos.sube : estilos.baja]}>
                      {dRedondo > 0 ? '▲' : '▼'} {conComa(Math.abs(dRedondo).toFixed(1))}
                    </Text>
                  )}
                </View>
                <Pressable
                  hitSlop={8}
                  style={({ pressed }) => [estilos.iconoBoton, pressed && estilos.iconoHundido]}
                  accessibilityRole="button"
                  accessibilityLabel={T.peso.corregir}
                  onPress={() => {
                    setBorrando(null);
                    setCorrigiendo(p.fecha);
                    setValor(conComa(deKilos(p.valor, unidad).toFixed(1)));
                  }}
                >
                  <IconoLapiz />
                </Pressable>
                <Pressable
                  hitSlop={8}
                  style={({ pressed }) => [estilos.iconoBoton, pressed && estilos.iconoHundido]}
                  accessibilityRole="button"
                  accessibilityLabel={T.peso.borrar}
                  onPress={() => {
                    setCorrigiendo(null);
                    setBorrando(p.fecha);
                  }}
                >
                  <IconoTacho />
                </Pressable>
              </>
            )}
          </View>
        );
      })}
      {error !== '' && <Text style={estilos.error}>{error}</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { marginTop: 16 },
  rotulo: { color: C.apagado, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.linea,
  },
  // Cuando se corrige o se pregunta por el borrado, la fila se despega apenas
  // del resto para que se vea qué renglón está en juego.
  filaActiva: { backgroundColor: C.hoja, borderRadius: 10, paddingHorizontal: 10, marginHorizontal: -10 },
  cuando: { color: C.apagado, fontSize: 12, minWidth: 58, fontVariant: ['tabular-nums'] },
  // El bloque del dato: el peso manda, el cambio va al lado en voz baja.
  dato: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  valor: { color: C.tinta, fontSize: 17, fontWeight: '400', fontVariant: ['tabular-nums'] },
  unidad: { color: C.apagado, fontSize: 12, fontWeight: '400' },
  delta: { fontSize: 11, fontVariant: ['tabular-nums'] },
  // Subir de peso no es "malo" ni bajar "bueno": son grises con una pizca de
  // tono, no un semáforo. La tendencia se lee, no se juzga.
  sube: { color: '#c58f7a' },
  baja: { color: '#7aa6c5' },
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
  iconoBoton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.linea,
  },
  iconoHundido: { transform: [{ scale: 0.92 }], borderColor: C.lineaFuerte, backgroundColor: C.hoja },
  textoBoton: { paddingVertical: 2 },
  accion: { color: C.sub, fontSize: 13 },
  apagada: { color: C.apagado, fontSize: 13 },
  peligro: { color: C.error, fontSize: 13 },
  error: { color: C.error, fontSize: 13, marginTop: 8 },
});
