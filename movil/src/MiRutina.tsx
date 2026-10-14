import { useCallback, useEffect, useState } from 'react';
import { eventos, EJERCICIOS_CAMBIO } from '@compartido/eventos';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Ejercicio } from '@nucleo/tipos';
import {
  ORDEN_SEMANA,
  agregarEjercicio,
  cambiarCantidad,
  copiarDia,
  hayAlgo,
  hayQuePreguntarAlCopiar,
  marcarDescanso,
  nombreNuevo,
  quitarEjercicio,
  semanaVacia,
  subirEjercicio,
  type DiaDeSemana,
  type Rutina,
} from '@nucleo/rutinas';
import { T } from '@nucleo/textos';
import { miId } from '@compartido/quienSoy';
import {
  activarRutina,
  borrarRutina,
  cargarMisRutinas,
  cargarRutinaParaVer,
  guardarRutina,
  hayRutinasGuardadas,
  type CatalogoDeRutina,
} from '@compartido/rutinas';
import { supabase } from './supabase';
import RutinaPlegada from './RutinaPlegada';
import SelectorEjercicio from './SelectorEjercicio';
import { C } from './colores';

/**
 * TU RUTINA, EN STATS (14/10). Se mira, se edita, se copia y se pega antes de ir
 * al gimnasio: la rutina deja de armarse solo entrenando.
 *
 * Varias rutinas guardadas y una activa. Con la base anterior a la 75 se ve la
 * deducida del historial, sin editar.
 *
 * CADA CAMBIO SE GUARDA EN EL ACTO y, si la base no contesta, se vuelve atrás y
 * se dice: es una pantalla para planificar, no para el subsuelo.
 */
export default function MiRutina({ visible }: { visible: boolean }) {
  const [guardadas, setGuardadas] = useState<boolean | null>(null);
  const [rutinas, setRutinas] = useState<Rutina[]>([]);
  const [deducida, setDeducida] = useState<DiaDeSemana[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [catalogo, setCatalogo] = useState<CatalogoDeRutina>(new Map());
  const [lista, setLista] = useState<Ejercicio[]>([]);
  const [eligiendoPara, setEligiendoPara] = useState<number | null>(null);
  const [copiandoDesde, setCopiandoDesde] = useState<number | null>(null);
  const [preguntaCopia, setPreguntaCopia] = useState<{ desde: number; hasta: number } | null>(null);
  const [preguntaBorrar, setPreguntaBorrar] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    const [hay, { data: ejercicios }] = await Promise.all([hayRutinasGuardadas(supabase), supabase.from('ejercicios').select('*')]);
    const filas = (ejercicios ?? []) as (Ejercicio & { mide?: string | null })[];
    setLista(filas);
    setCatalogo(new Map(filas.map((e) => [e.id, { nombre: e.nombre, grupo: e.grupo ?? null, mide: e.mide === 'tiempo' ? 'tiempo' : 'series' }])));
    setGuardadas(hay);
    const yo = await miId(supabase);
    const [mias, vista] = await Promise.all([hay ? cargarMisRutinas(supabase) : Promise.resolve(null), yo ? cargarRutinaParaVer(supabase, yo, true) : Promise.resolve(null)]);
    if (mias) {
      setRutinas(mias);
      setSel((s) => (s && mias.some((r) => r.id === s) ? s : (mias.find((r) => r.activa) ?? mias[0])?.id ?? null));
    }
    if (vista?.deducida) setDeducida(vista.dias);
  }, []);

  useEffect(() => {
    if (visible) void cargar();
  }, [visible, cargar]);
  // Un ejercicio propio recién agregado tiene que verse con su nombre.
  useEffect(() => eventos.escuchar(EJERCICIOS_CAMBIO, () => void cargar()), [cargar]);

  const actual = rutinas.find((r) => r.id === sel) ?? null;

  /** Cambia la rutina en pantalla y la guarda; si no se guardó, vuelve atrás. */
  async function cambiar(nueva: Rutina) {
    const antes = rutinas;
    setRutinas((rs) => rs.map((r) => (r.id === nueva.id ? nueva : r)));
    setError('');
    const id = await guardarRutina(supabase, nueva);
    if (!id) {
      setRutinas(antes);
      setError(T.general.noSePudo);
    }
  }

  async function crear(dias: DiaDeSemana[]) {
    setError('');
    const nombre = nombreNuevo(rutinas.map((r) => r.nombre), T.rutina.nombreBase);
    const id = await guardarRutina(supabase, { id: null, nombre, dias });
    if (!id) return setError(T.general.noSePudo);
    await cargar();
    setSel(id);
    setEditando(true);
  }

  async function activar(id: string) {
    setError('');
    if (!(await activarRutina(supabase, id))) return setError(T.general.noSePudo);
    setRutinas((rs) => rs.map((r) => ({ ...r, activa: r.id === id })));
    void cargarMisRutinas(supabase);
  }

  async function borrar(id: string) {
    setPreguntaBorrar(false);
    setError('');
    if (!(await borrarRutina(supabase, id))) return setError(T.general.noSePudo);
    setEditando(false);
    setSel(null);
    await cargar();
  }

  function copiar(desde: number, hasta: number, modo: 'reemplazar' | 'agregar') {
    if (!actual) return;
    setPreguntaCopia(null);
    setCopiandoDesde(null);
    void cambiar({ ...actual, dias: copiarDia(actual.dias, desde, hasta, modo) });
  }

  // Lo que va adentro de un día abierto mientras se edita.
  function editorDelDia(d: number) {
    if (!actual) return null;
    const dia = actual.dias[d];
    const con = (dias: DiaDeSemana[]) => void cambiar({ ...actual, dias });
    return (
      <View style={estilos.editor}>
        {dia.ejercicios.map((e, i) => (
          <View key={`${e.ejercicio}-${i}`} style={estilos.filaEditable}>
            <Text style={estilos.ejercicio} numberOfLines={1}>
              {catalogo.get(e.ejercicio)?.nombre ?? e.ejercicio}
            </Text>
            <Pressable hitSlop={8} onPress={() => con(cambiarCantidad(actual.dias, d, i, -1))} accessibilityLabel="menos">
              <Text style={estilos.paso}>−</Text>
            </Pressable>
            <Text style={estilos.cantidad}>{e.minutos !== undefined ? T.rutina.minutos(e.minutos) : T.rutina.series(e.series)}</Text>
            <Pressable hitSlop={8} onPress={() => con(cambiarCantidad(actual.dias, d, i, 1))} accessibilityLabel="más">
              <Text style={estilos.paso}>+</Text>
            </Pressable>
            <Pressable hitSlop={8} onPress={() => con(subirEjercicio(actual.dias, d, i))} disabled={i === 0} accessibilityLabel="subir">
              <Text style={[estilos.paso, i === 0 && estilos.apagado]}>↑</Text>
            </Pressable>
            <Pressable hitSlop={8} onPress={() => con(quitarEjercicio(actual.dias, d, i))} accessibilityLabel="quitar">
              <Text style={estilos.quitar}>✕</Text>
            </Pressable>
          </View>
        ))}
        <View style={estilos.acciones}>
          {!dia.descanso && (
            <Pressable testID={`rutina-agregar-${d}`} style={estilos.chico} onPress={() => setEligiendoPara(d)}>
              <Text style={estilos.chicoTexto}>{T.rutina.agregarEjercicio}</Text>
            </Pressable>
          )}
          <Pressable style={[estilos.chico, dia.descanso && estilos.chicoActivo]} onPress={() => con(marcarDescanso(actual.dias, d, !dia.descanso))}>
            <Text style={estilos.chicoTexto}>{T.rutina.diaDeDescanso}</Text>
          </Pressable>
          {(dia.ejercicios.length > 0 || dia.descanso) && (
            <Pressable style={[estilos.chico, copiandoDesde === d && estilos.chicoActivo]} onPress={() => setCopiandoDesde(copiandoDesde === d ? null : d)}>
              <Text style={estilos.chicoTexto}>{T.rutina.copiarA}</Text>
            </Pressable>
          )}
        </View>
        {copiandoDesde === d && (
          <View style={estilos.acciones}>
            {ORDEN_SEMANA.filter((h) => h !== d).map((h) => (
              <Pressable
                key={h}
                testID={`rutina-copiar-a-${h}`}
                style={estilos.chico}
                onPress={() => (hayQuePreguntarAlCopiar(actual.dias, h) ? setPreguntaCopia({ desde: d, hasta: h }) : copiar(d, h, 'reemplazar'))}
              >
                <Text style={estilos.chicoTexto}>{T.fechas.diasLargos[h].slice(0, 3)}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {preguntaCopia?.desde === d && (
          <View style={estilos.pregunta}>
            <Text style={estilos.nota}>{T.rutina.yaTieneEjercicios(T.fechas.diasLargos[preguntaCopia.hasta])}</Text>
            <View style={estilos.acciones}>
              <Pressable style={estilos.chico} onPress={() => copiar(preguntaCopia.desde, preguntaCopia.hasta, 'reemplazar')}>
                <Text style={estilos.chicoTexto}>{T.rutina.reemplazar}</Text>
              </Pressable>
              <Pressable style={estilos.chico} onPress={() => copiar(preguntaCopia.desde, preguntaCopia.hasta, 'agregar')}>
                <Text style={estilos.chicoTexto}>{T.rutina.agregarAlFinal}</Text>
              </Pressable>
              <Pressable style={estilos.chico} onPress={() => setPreguntaCopia(null)}>
                <Text style={estilos.chicoTexto}>{T.rutina.cancelar}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    );
  }

  if (guardadas === null) return null;

  return (
    <View testID="mi-rutina">
      <Text style={estilos.seccion}>{T.rutina.titulo}</Text>

      {guardadas && rutinas.length > 0 && (
        <View style={estilos.acciones}>
          {rutinas.map((r) => (
            <Pressable
              key={r.id}
              testID="rutina-elegir"
              style={[estilos.chip, r.id === sel && estilos.chipElegido]}
              onPress={() => {
                setSel(r.id);
                setEditando(false);
              }}
            >
              <Text style={[estilos.chipTexto, r.id === sel && estilos.chipTextoElegido]}>
                {r.nombre}
                {r.activa ? ' ·' : ''}
              </Text>
            </Pressable>
          ))}
          {rutinas.length < 10 && (
            <Pressable testID="rutina-nueva" style={estilos.chip} onPress={() => void crear(semanaVacia())}>
              <Text style={estilos.chipTexto}>{T.rutina.nueva}</Text>
            </Pressable>
          )}
        </View>
      )}

      {actual ? (
        <>
          <View style={estilos.barra}>
            {editando ? (
              <TextInput
                style={estilos.nombre}
                defaultValue={actual.nombre}
                maxLength={40}
                onEndEditing={(ev) => {
                  const n = ev.nativeEvent.text.trim();
                  if (n && n !== actual.nombre) void cambiar({ ...actual, nombre: n });
                }}
              />
            ) : (
              <Text style={estilos.estado}>{actual.activa ? T.rutina.activa : ''}</Text>
            )}
            {!actual.activa && !editando && (
              <Pressable testID="rutina-usar" style={estilos.chico} onPress={() => void activar(actual.id)}>
                <Text style={estilos.chicoTexto}>{T.rutina.usarEsta}</Text>
              </Pressable>
            )}
            <Pressable testID="rutina-editar" style={estilos.chico} onPress={() => setEditando(!editando)}>
              <Text style={estilos.chicoTexto}>{editando ? T.rutina.listo : T.rutina.editar}</Text>
            </Pressable>
          </View>
          <RutinaPlegada dias={actual.dias} catalogo={catalogo} abajoDelDia={editando ? editorDelDia : undefined} testID="rutina-guardada" />
          {editando && (
            <View style={estilos.pregunta}>
              {preguntaBorrar ? (
                <>
                  <Text style={estilos.nota}>{T.rutina.borrarPregunta(actual.nombre)}</Text>
                  <View style={estilos.acciones}>
                    <Pressable style={estilos.chico} onPress={() => void borrar(actual.id)}>
                      <Text style={[estilos.chicoTexto, { color: C.error }]}>{T.rutina.borrar}</Text>
                    </Pressable>
                    <Pressable style={estilos.chico} onPress={() => setPreguntaBorrar(false)}>
                      <Text style={estilos.chicoTexto}>{T.rutina.cancelar}</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Pressable onPress={() => setPreguntaBorrar(true)}>
                  <Text style={estilos.borrar}>{T.rutina.borrar}</Text>
                </Pressable>
              )}
            </View>
          )}
        </>
      ) : deducida && hayAlgo(deducida) ? (
        <>
          <Text style={estilos.nota}>{T.rutina.deducida}</Text>
          <RutinaPlegada dias={deducida} catalogo={catalogo} soloConAlgo testID="rutina-deducida" />
          {guardadas && (
            <View style={estilos.acciones}>
              <Pressable testID="rutina-guardar-deducida" style={estilos.chico} onPress={() => void crear(deducida)}>
                <Text style={estilos.chicoTexto}>{T.rutina.guardarDeducida}</Text>
              </Pressable>
              <Pressable style={estilos.chico} onPress={() => void crear(semanaVacia())}>
                <Text style={estilos.chicoTexto}>{T.rutina.armarNueva}</Text>
              </Pressable>
            </View>
          )}
        </>
      ) : (
        <>
          <Text style={estilos.nota}>{T.rutina.vacia}</Text>
          {guardadas && (
            <View style={estilos.acciones}>
              <Pressable testID="rutina-armar" style={estilos.chico} onPress={() => void crear(semanaVacia())}>
                <Text style={estilos.chicoTexto}>{T.rutina.armarNueva}</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
      {!!error && <Text style={estilos.error}>{error}</Text>}

      <SelectorEjercicio
        visible={eligiendoPara !== null}
        ejercicios={lista}
        valor={null}
        alElegir={(id) => {
          const d = eligiendoPara;
          setEligiendoPara(null);
          if (!id || d === null || !actual) return;
          void cambiar({ ...actual, dias: agregarEjercicio(actual.dias, d, id, catalogo.get(id)?.mide === 'tiempo') });
        }}
        alCerrar={() => setEligiendoPara(null)}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginTop: 34, marginBottom: 10 },
  nota: { color: C.apagado, fontSize: 12, lineHeight: 17, marginBottom: 8 },
  error: { color: C.error, fontSize: 13, marginTop: 8 },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 6 },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineaFuerte, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  chipElegido: { borderColor: C.tinta },
  chipTexto: { color: C.sub, fontSize: 13 },
  chipTextoElegido: { color: C.tinta },
  barra: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 4 },
  estado: { flex: 1, color: C.apagado, fontSize: 12 },
  nombre: { flex: 1, color: C.tinta, fontSize: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineaFuerte, paddingVertical: 4 },
  chico: { borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineaFuerte, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  chicoActivo: { borderColor: C.tinta },
  chicoTexto: { color: C.tinta, fontSize: 13 },
  editor: { paddingBottom: 12 },
  filaEditable: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  ejercicio: { flex: 1, color: C.sub, fontSize: 14 },
  cantidad: { color: C.tinta, fontSize: 13, minWidth: 58, textAlign: 'center', fontVariant: ['tabular-nums'] },
  paso: { color: C.tinta, fontSize: 18, width: 20, textAlign: 'center' },
  apagado: { color: C.apagado },
  quitar: { color: C.apagado, fontSize: 14, width: 20, textAlign: 'center' },
  pregunta: { marginTop: 8 },
  borrar: { color: C.apagado, fontSize: 13, marginTop: 10 },
});
