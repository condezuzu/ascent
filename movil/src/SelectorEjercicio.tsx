import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Ejercicio } from '@nucleo/tipos';
import { ORDEN_ZONAS, gruposDeZona, zonaDeGrupo, type Zona } from '@nucleo/ejercicios';
import { T } from '@nucleo/textos';
import Hoja from './Hoja';
import { nuevaEnCadaApertura } from './hojaNueva';
import { C } from './colores';
import { supabase } from './supabase';
import { leerRecordados, recordadosAlDia, type Recordados } from '@compartido/pesosRecordados';
import { leerPerfilCache } from '@compartido/cache';
import { claveDeEtiqueta } from '@nucleo/carga';
import { pesoLindo } from '@nucleo/fuerza';

/**
 * ELEGIR ENTRE CIEN EJERCICIOS, NAVEGANDO. El mismo árbol que la web
 * (`nucleo/ejercicios.ts`): los tres del DOTS arriba, después zona y músculo,
 * y ahí la lista corta. Una zona con un solo músculo no pregunta dos veces.
 */
/**
 * UN RENGLÓN DE LA LISTA. AFUERA DEL SELECTOR, y no es prolijidad (4/10):
 * definido adentro era un componente NUEVO en cada dibujado, así que React
 * desmontaba y volvía a montar todos los renglones cada vez. Con una sesión
 * corriendo la pantalla se redibuja una vez por segundo: un toque que empezaba
 * en un renglón y terminaba en su reemplazo se perdía. Lo cazó la batería, que
 * no podía tocar "Press de banca" durante un minuto.
 */
function Fila({ texto, extra, elegido, onPress }: { texto: string; extra?: string; elegido?: boolean; onPress: () => void }) {
  return (
    <Pressable style={estilos.fila} onPress={onPress} accessibilityRole="button">
      <Text style={[estilos.filaTexto, elegido && estilos.elegido]} numberOfLines={1}>{texto}</Text>
      {extra !== undefined && <Text style={estilos.extra}>{extra}</Text>}
    </Pressable>
  );
}

function SelectorEjercicio({
  visible,
  ejercicios,
  valor,
  alElegir,
  alCerrar,
}: {
  visible: boolean;
  ejercicios: Ejercicio[];
  valor: string | null;
  alElegir: (id: string | null) => void;
  alCerrar: () => void;
}) {
  const actual = ejercicios.find((e) => e.id === valor) ?? null;
  const [zona, setZona] = useState<Zona | null>(null);
  const [grupo, setGrupo] = useState<string | null>(null);

  // LO MÁS PESADO DE LA ÚLTIMA VEZ, al lado de cada nombre (10/10). Primero lo
  // que el teléfono ya tiene guardado —aparece en el acto, también sin señal— y
  // después lo de la base, por si se entrenó en otro aparato.
  const [ultimos, setUltimos] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!visible) return;
    let vivo = true;
    const poner = async (r: Recordados) => {
      const unidad = (await leerPerfilCache())?.unidad_peso ?? 'kg';
      if (!vivo) return;
      setUltimos(
        Object.fromEntries(
          Object.entries(r.maximos).map(([id, m]) => [id, T.resumen.pesoEnLista(pesoLindo(m.peso, unidad), claveDeEtiqueta(m.carga, id))])
        )
      );
    };
    void leerRecordados().then(poner).then(() => recordadosAlDia(supabase)).then(poner).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [visible]);

  // Abre donde está lo que ya tenías: pasar de press inclinado a declinado no
  // obliga a bajar todo el árbol.
  useEffect(() => {
    if (!visible) return;
    setZona(actual && !actual.cuenta_dots ? zonaDeGrupo(actual.grupo) : null);
    setGrupo(actual && !actual.cuenta_dots ? actual.grupo : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const grupos = [...new Set(ejercicios.map((e) => e.grupo))];
  const delDots = ejercicios.filter((e) => e.cuenta_dots);

  function elegir(id: string | null) {
    alElegir(id);
    alCerrar();
  }

  function abrirZona(z: Zona) {
    const suyos = gruposDeZona(z, grupos);
    setZona(z);
    setGrupo(suyos.length === 1 ? suyos[0] : null);
  }

  function volver() {
    if (grupo && zona && gruposDeZona(zona, grupos).length > 1) setGrupo(null);
    else {
      setZona(null);
      setGrupo(null);
    }
  }

  const titulo = grupo ? grupo.charAt(0).toUpperCase() + grupo.slice(1) : zona ? T.ejercicios[zona] : T.sesion.queEstasHaciendo;


  return (
    <Hoja visible={visible} alCerrar={alCerrar}>
      <View style={estilos.cabecera}>
        {zona && (
          <Pressable onPress={volver} style={estilos.volver} accessibilityLabel={T.general.volver}>
            <Text style={estilos.volverTexto}>←</Text>
          </Pressable>
        )}
        <Text style={estilos.titulo}>{titulo}</Text>
      </View>

      {!zona && (
        <>
          <Fila texto={T.sesion.sinEjercicio} onPress={() => elegir(null)} />
          <Text style={estilos.rotulo}>{T.marca.cuentanDots}</Text>
          {delDots.map((e) => (
            <Fila key={e.id} texto={e.nombre} extra={ultimos[e.id]} elegido={e.id === valor} onPress={() => elegir(e.id)} />
          ))}
          <View style={estilos.separa} />
          {ORDEN_ZONAS.filter((z) => gruposDeZona(z, grupos).length > 0).map((z) => (
            <Fila key={z} texto={T.ejercicios[z]} extra="›" onPress={() => abrirZona(z)} />
          ))}
        </>
      )}

      {zona && !grupo &&
        gruposDeZona(zona, grupos).map((g) => (
          <Fila
            key={g}
            texto={g.charAt(0).toUpperCase() + g.slice(1)}
            extra={String(ejercicios.filter((e) => e.grupo === g).length)}
            onPress={() => setGrupo(g)}
          />
        ))}

      {/* Los del DOTS aparecen ARRIBA (arriba de todo) Y TAMBIÉN acá, dentro de
          su grupo: press de banca en pecho, sentadilla en piernas, peso muerto
          en espalda. Su `orden` bajo (10/20/30) los deja primeros del grupo.
          Antes se filtraban con `!e.cuenta_dots` y faltaban donde uno los busca. */}
      {grupo &&
        ejercicios
          .filter((e) => e.grupo === grupo)
          .map((e) => <Fila key={e.id} texto={e.nombre} extra={ultimos[e.id]} elegido={e.id === valor} onPress={() => elegir(e.id)} />)}

      <Pressable style={estilos.cancelar} onPress={alCerrar}>
        <Text style={estilos.cancelarTexto}>{T.general.cancelar}</Text>
      </Pressable>
    </Hoja>
  );
}

export default nuevaEnCadaApertura(SelectorEjercicio, (p) => p.visible);

const estilos = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  volver: { minWidth: 36, minHeight: 36, justifyContent: 'center' },
  volverTexto: { color: C.sub, fontSize: 20 },
  titulo: { color: C.tinta, fontSize: 20, fontWeight: '500' },
  rotulo: { color: C.apagado, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginTop: 14, marginBottom: 2 },
  separa: { height: 14 },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.linea,
  },
  // `flexShrink`: con el peso al lado, un nombre largo se corta él y no empuja el número afuera.
  filaTexto: { color: C.sub, fontSize: 16, flexShrink: 1, paddingRight: 12 },
  elegido: { color: C.tinta, fontWeight: '600' },
  // Más claro que el nombre: el peso es lo que se viene a leer (10/10).
  extra: { color: C.tinta, fontSize: 15, fontVariant: ['tabular-nums'] },
  cancelar: { paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  cancelarTexto: { color: C.sub, fontSize: 14 },
});
