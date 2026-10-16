import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Ejercicio } from '@nucleo/tipos';
import { GRUPOS_PROPIOS, ORDEN_ZONAS, buscarEjercicios, gruposDeZona, nombreDeGrupo, sinAcentos, zonaDeGrupo, type Zona } from '@nucleo/ejercicios';
import { disponible } from '@nucleo/esquema';
import { useVersionDelEsquema } from '@compartido/esquema';
import { crearEjercicio } from '@compartido/ejerciciosPropios';
import { yaEsta } from '@nucleo/yaEsta';
import { T } from '@nucleo/textos';
import Hoja from './Hoja';
import { nuevaEnCadaApertura } from './hojaNueva';
import { C } from './colores';
import { supabase } from './supabase';
import { leerRecordados, recordadosAlDia, type Recordados } from '@compartido/pesosRecordados';
import { leerPerfilCache } from '@compartido/cache';
import { claveDeEtiqueta } from '@nucleo/carga';
import { pesoEnLaLista } from '@nucleo/peso';
import GloboPrimeraVez from './GloboPrimeraVez';

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
  /** `mide` viaja solo con uno recién creado: el catálogo de quien abrió esto todavía no lo tiene. */
  alElegir: (id: string | null, mide?: 'series' | 'tiempo') => void;
  alCerrar: () => void;
}) {
  const actual = ejercicios.find((e) => e.id === valor) ?? null;
  const [zona, setZona] = useState<Zona | null>(null);
  const [grupo, setGrupo] = useState<string | null>(null);
  // LA LUPA Y EL "+" (14/10): buscar por nombre, ver los parecidos, y agregar el que no está.
  const [busqueda, setBusqueda] = useState('');
  const [creando, setCreando] = useState<{ nombre: string; grupo: string | null } | null>(null);
  const [creandoError, setCreandoError] = useState('');
  // Si la hoja sigue abierta cuando contesta `crearEjercicio` (ver `crear`).
  const abierta = useRef(visible);
  abierta.current = visible;
  useEffect(
    () => () => {
      abierta.current = false;
    },
    []
  );
  const conPropios = disponible('ejerciciosPropios', useVersionDelEsquema());

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
          Object.entries(r.maximos).map(([id, m]) => [id, T.resumen.pesoEnLista(pesoEnLaLista(m.peso, unidad), claveDeEtiqueta(m.carga, id))])
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

  function elegir(id: string | null, mide?: 'series' | 'tiempo') {
    setBusqueda('');
    setCreando(null);
    alElegir(id, mide);
    alCerrar();
  }

  // ¿YA ESTÁ? (15/10): el que significa lo mismo aunque se llame distinto. Se avisa
  // y se ofrece; si igual se quiere crear, "Crear igual".
  const parecido = creando && creando.nombre.trim().length >= 2 ? yaEsta(creando.nombre, ejercicios) : null;

  async function crear() {
    if (!creando?.grupo || creando.nombre.trim().length < 2) return;
    setCreandoError('');
    const id = await crearEjercicio(supabase, creando.nombre.trim(), creando.grupo);
    // Con la hoja ya cerrada no se elige nada (vuelta 8): el alElegir viejo guardaba la
    // rutina como estaba al tocar Crear y borraba lo editado después. El propio queda creado.
    if (!abierta.current) return;
    if (!id) return setCreandoError(T.general.noSePudo);
    // La misma regla que la base (crear_ejercicio): el cardio se mide en minutos.
    elegir(id, creando.grupo === 'cardio' ? 'tiempo' : 'series');
  }

  const hallados = buscarEjercicios(ejercicios, busqueda, 12, (g) => T.ejercicios.grupos[g] ?? g);
  // Con uno que ya se llama así, no se ofrece crear otro igual.
  const hayIgual = hallados.coinciden.some((e) => sinAcentos(e.nombre) === sinAcentos(busqueda));

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

  const titulo = grupo ? nombreDeGrupo(grupo) : zona ? T.ejercicios[zona] : T.sesion.queEstasHaciendo;


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

      {!zona && !creando && (
        <View style={estilos.buscador}>
          <Text style={estilos.lupa}>⌕</Text>
          <TextInput
            testID="buscar-ejercicio"
            style={estilos.buscar}
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder={T.ejercicios.buscar}
            placeholderTextColor={C.apagado}
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
      )}
      {/* EL GLOBITO DE LA PRIMERA VEZ, saliendo del buscador (15/10): acá es donde se
          trabaron tres personas. Se da por visto apenas aparece: se va con la hoja. */}
      {visible && !zona && !creando && (
        <GloboPrimeraVez cual="elegir" colaX={68} subir={6} vistoAlMostrar cerrarCuando={busqueda.length > 0}>
          {T.globos.elegir}
        </GloboPrimeraVez>
      )}

      {creando && (
        <View testID="crear-ejercicio">
          <View style={estilos.buscador}>
          <TextInput
            style={estilos.buscar}
            value={creando.nombre}
            onChangeText={(nombre) => setCreando({ ...creando, nombre })}
            placeholder={T.ejercicios.nombreDelPropio}
            placeholderTextColor={C.apagado}
            maxLength={40}
          />
          </View>
          <Text style={estilos.rotulo}>{T.ejercicios.queMusculo}</Text>
          <View style={estilos.chips}>
            {GRUPOS_PROPIOS.map((g) => (
              <Pressable key={g} style={[estilos.chip, creando.grupo === g && estilos.chipElegido]} onPress={() => setCreando({ ...creando, grupo: g })}>
                <Text style={[estilos.chipTexto, creando.grupo === g && estilos.elegido]}>{T.ejercicios.grupos[g] ?? g}</Text>
              </Pressable>
            ))}
          </View>
          {creando.grupo === 'cardio' && <Text style={estilos.nota}>{T.ejercicios.seMideEnMinutos}</Text>}
          {!!creandoError && <Text style={estilos.nota}>{creandoError}</Text>}
          {parecido && (
            <View testID="ya-esta">
              <Text style={estilos.yaEsta}>{T.ejercicios.yaEsta(parecido.nombre)}</Text>
              <Pressable testID="ya-esta-usar" style={estilos.crear} onPress={() => elegir(parecido.id)}>
                <Text style={estilos.crearTexto}>{T.ejercicios.usarEse}</Text>
              </Pressable>
            </View>
          )}
          <Pressable
            testID="crear-ejercicio-listo"
            style={[parecido ? estilos.crearIgual : estilos.crear, (!creando.grupo || creando.nombre.trim().length < 2) && estilos.apagado]}
            onPress={() => void crear()}
            disabled={!creando.grupo || creando.nombre.trim().length < 2}
          >
            <Text style={parecido ? estilos.crearIgualTexto : estilos.crearTexto}>{parecido ? T.ejercicios.crearIgual : T.ejercicios.crear}</Text>
          </Pressable>
        </View>
      )}

      {!zona && !creando && busqueda.trim() !== '' && (
        <>
          {hallados.coinciden.map((e) => (
            <Fila key={e.id} texto={e.nombre} extra={ultimos[e.id]} elegido={e.id === valor} onPress={() => elegir(e.id)} />
          ))}
          {hallados.coinciden.length === 0 && <Text style={estilos.nota}>{T.ejercicios.nadaConEseNombre}</Text>}
          {/* Antes de los parecidos y no al final: debajo de doce quedaba fuera de la pantalla. */}
          {conPropios && !hayIgual && <Fila texto={T.ejercicios.agregarPropio(busqueda.trim())} onPress={() => setCreando({ nombre: busqueda.trim(), grupo: null })} />}
          {hallados.parecidos.length > 0 && <Text style={estilos.rotulo}>{T.ejercicios.parecidos}</Text>}
          {hallados.parecidos.map((e) => (
            <Fila key={e.id} texto={e.nombre} extra={ultimos[e.id]} elegido={e.id === valor} onPress={() => elegir(e.id)} />
          ))}
        </>
      )}

      {!zona && !creando && busqueda.trim() === '' && (
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
          {conPropios && <Fila texto={T.ejercicios.nuevoPropio} onPress={() => setCreando({ nombre: '', grupo: null })} />}
        </>
      )}

      {zona && !grupo &&
        gruposDeZona(zona, grupos).map((g) => (
          <Fila
            key={g}
            texto={nombreDeGrupo(g)}
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

      <Pressable
        style={estilos.cancelar}
        onPress={() => {
          setBusqueda('');
          setCreando(null);
          alCerrar();
        }}
      >
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
  buscador: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineaFuerte, borderRadius: 10, paddingHorizontal: 12, marginBottom: 8 },
  lupa: { color: C.sub, fontSize: 18 },
  buscar: { flex: 1, color: C.tinta, fontSize: 16, paddingVertical: 10 },
  nota: { color: C.apagado, fontSize: 13, marginVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 6 },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineaFuerte, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  chipElegido: { borderColor: C.tinta },
  chipTexto: { color: C.sub, fontSize: 14 },
  crear: { alignSelf: 'flex-start', borderWidth: StyleSheet.hairlineWidth, borderColor: C.tinta, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18, marginTop: 12 },
  crearTexto: { color: C.tinta, fontSize: 15 },
  yaEsta: { color: C.tinta, fontSize: 14, marginTop: 14 },
  crearIgual: { alignSelf: 'flex-start', paddingVertical: 10, marginTop: 6 },
  crearIgualTexto: { color: C.sub, fontSize: 14 },
  apagado: { opacity: 0.4 },
  cancelarTexto: { color: C.sub, fontSize: 14 },
});
