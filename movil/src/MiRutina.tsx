import { useCallback, useEffect, useRef, useState } from 'react';
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
  moverEjercicio,
  type DiaDeSemana,
  type Rutina,
} from '@nucleo/rutinas';
import { T } from '@nucleo/textos';
import { nombreVisible } from '@nucleo/propios';
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
import FilasArrastrables from './FilasArrastrables';
import SelectorEjercicio from './SelectorEjercicio';
import { C } from './colores';
import GloboPrimeraVez from './GloboPrimeraVez';

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
export default function MiRutina({
  visible,
  alArrastrar,
  abrirHoy = false,
}: {
  visible: boolean;
  /** Para que la pantalla apague su scroll mientras se arrastra un ejercicio. */
  alArrastrar?: (si: boolean) => void;
  abrirHoy?: boolean;
}) {
  // Dónde está el nombre del entrenamiento, para que el globito de la rutina salga de él.
  const [nombreEn, setNombreEn] = useState({ x: 0, ancho: 0 });
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
  const [noCargo, setNoCargo] = useState(false);
  // El día con ejercicios que se va a pasar a descanso: se pregunta antes de sacarlos.
  const [preguntaDescanso, setPreguntaDescanso] = useState<number | null>(null);
  const [error, setError] = useState('');

  // EL CATÁLOGO, APARTE (cacería del 15/10): un ejercicio propio nuevo solo necesita
  // su nombre. Volver a traer las rutinas por eso pisaba lo que se acababa de tocar.
  const cargarCatalogo = useCallback(async () => {
    const { data: ejercicios } = await supabase.from('ejercicios').select('*');
    const filas = (ejercicios ?? []) as (Ejercicio & { mide?: string | null })[];
    setLista(filas);
    setCatalogo(new Map(filas.map((e) => [e.id, { nombre: e.nombre, grupo: e.grupo ?? null, mide: e.mide === 'tiempo' ? 'tiempo' : 'series' }])));
  }, []);
  // Cuántos cambios se hicieron: una lectura que salió antes de un toque no lo pisa al llegar.
  const ediciones = useRef(0);
  const creando = useRef(false);

  const cargar = useCallback(async () => {
    const [hay] = await Promise.all([hayRutinasGuardadas(supabase), cargarCatalogo()]);
    const yo = await miId(supabase);
    const n = ediciones.current;
    const [mias, vista] = await Promise.all([hay ? cargarMisRutinas(supabase) : Promise.resolve(null), yo ? cargarRutinaParaVer(supabase, yo, true) : Promise.resolve(null)]);
    if (mias && ediciones.current === n) {
      setRutinas(mias);
      setSel((s) => (s && mias.some((r) => r.id === s) ? s : (mias.find((r) => r.activa) ?? mias[0])?.id ?? null));
    }
    if (vista?.deducida) setDeducida(vista.dias);
    // RECIÉN AHORA (cacería del 15/10): antes de traer la lista se mostraba "Todavía no hay
    // rutina" con "Armar una de cero" a quien sí tenía, y sin señal quedaba así.
    setNoCargo(hay && !mias);
    setGuardadas(hay);
  }, [cargarCatalogo]);

  useEffect(() => {
    if (visible) void cargar();
  }, [visible, cargar]);
  // Un ejercicio propio recién agregado tiene que verse con su nombre.
  useEffect(() => eventos.escuchar(EJERCICIOS_CAMBIO, () => void cargarCatalogo()), [cargarCatalogo]);

  const actual = rutinas.find((r) => r.id === sel) ?? null;

  // EL NOMBRE SE GUARDA TAMBIÉN CON "LISTO" (cacería del 15/10): con el teclado abierto,
  // el campo se desmontaba sin su fin de edición y el nombre nuevo se perdía.
  // Con el id de SU rutina: tocar otra, o crear una, le ponía este nombre a esa (cacería del 15/10).
  const nombreTipeado = useRef<{ id: string; texto: string } | null>(null);
  function guardarNombre() {
    const t = nombreTipeado.current;
    nombreTipeado.current = null;
    const r = t ? rutinas.find((x) => x.id === t.id) : undefined;
    const n = t?.texto.trim();
    if (r && n && n !== r.nombre) void cambiar({ ...r, nombre: n });
  }
  // Y AL SALIR (vuelta 8): Volver o deslizar con el teclado abierto desmonta el campo sin
  // su fin de edición, y lo tipeado se perdía. La última versión, con las rutinas de ahora.
  const guardarAlSalir = useRef(guardarNombre);
  guardarAlSalir.current = guardarNombre;
  useEffect(() => () => guardarAlSalir.current(), []);

  /** Cambia la rutina en pantalla y la guarda; si no se guardó, vuelve atrás. */
  async function cambiar(nueva: Rutina) {
    ediciones.current++;
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
    // Un segundo toque con la base sin contestar creaba otra igual (vuelta 7 de la cacería).
    if (creando.current) return;
    creando.current = true;
    try {
      setError('');
      const nombre = nombreNuevo(rutinas.map((r) => r.nombre), T.rutina.nombreBase);
      const id = await guardarRutina(supabase, { id: null, nombre, dias });
      if (!id) return setError(T.general.noSePudo);
      await cargar();
      setSel(id);
      setEditando(true);
    } finally {
      creando.current = false;
    }
  }

  async function activar(id: string) {
    setError('');
    if (!(await activarRutina(supabase, id, rutinas.find((r) => r.id === id)?.dias))) return setError(T.general.noSePudo);
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
        {dia.ejercicios.length > 1 && <Text style={estilos.nota}>{T.rutina.arrastrarPista}</Text>}
        <FilasArrastrables
          testID={`rutina-filas-${d}`}
          filas={dia.ejercicios}
          llave={(e, i) => `${e.ejercicio}-${i}`}
          alto={ALTO_FILA}
          alMover={(desde, hasta) => con(moverEjercicio(actual.dias, d, desde, hasta))}
          alArrastrar={alArrastrar}
          dibujar={(e, i) => (
          <View style={estilos.filaEditable}>
            <Text style={estilos.ejercicio} numberOfLines={1}>
              {nombreVisible(e.ejercicio, catalogo.get(e.ejercicio)?.nombre)}
            </Text>
            <Pressable hitSlop={8} onPress={() => con(cambiarCantidad(actual.dias, d, i, -1))} accessibilityLabel="menos">
              <Text style={estilos.paso}>−</Text>
            </Pressable>
            <Text style={estilos.cantidad}>{e.minutos !== undefined ? T.rutina.minutos(e.minutos) : T.rutina.series(e.series)}</Text>
            <Pressable hitSlop={8} onPress={() => con(cambiarCantidad(actual.dias, d, i, 1))} accessibilityLabel="más">
              <Text style={estilos.paso}>+</Text>
            </Pressable>
            <Pressable hitSlop={8} onPress={() => con(quitarEjercicio(actual.dias, d, i))} accessibilityLabel="quitar">
              <Text style={estilos.quitar}>✕</Text>
            </Pressable>
          </View>
          )}
        />
        <View style={estilos.acciones}>
          {!dia.descanso && (
            <Pressable testID={`rutina-agregar-${d}`} style={estilos.chico} onPress={() => setEligiendoPara(d)}>
              <Text style={estilos.chicoTexto}>{T.rutina.agregarEjercicio}</Text>
            </Pressable>
          )}
          <Pressable
            testID={`rutina-descanso-${d}`}
            style={[estilos.chico, dia.descanso && estilos.chicoActivo]}
            onPress={() => (!dia.descanso && dia.ejercicios.length > 0 ? setPreguntaDescanso(d) : con(marcarDescanso(actual.dias, d, !dia.descanso)))}
          >
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
        {preguntaDescanso === d && (
          <View style={estilos.pregunta}>
            <Text style={estilos.nota}>{T.rutina.descansoPregunta(T.fechas.diasLargos[d])}</Text>
            <View style={estilos.acciones}>
              <Pressable
                testID={`rutina-descanso-si-${d}`}
                style={estilos.chico}
                onPress={() => {
                  setPreguntaDescanso(null);
                  con(marcarDescanso(actual.dias, d, true));
                }}
              >
                <Text style={estilos.chicoTexto}>{T.rutina.diaDeDescanso}</Text>
              </Pressable>
              <Pressable style={estilos.chico} onPress={() => setPreguntaDescanso(null)}>
                <Text style={estilos.chicoTexto}>{T.rutina.cancelar}</Text>
              </Pressable>
            </View>
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
  if (noCargo) {
    return (
      <View testID="mi-rutina">
        <Text style={estilos.seccion}>{T.rutina.titulo}</Text>
        <Text style={estilos.nota}>{T.inicio.noCargo}</Text>
        <Pressable testID="rutina-reintentar" style={estilos.chico} onPress={() => void cargar()}>
          <Text style={estilos.chicoTexto}>{T.inicio.reintentar}</Text>
        </Pressable>
      </View>
    );
  }

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
                if (editando) guardarNombre();
                setSel(r.id);
                setEditando(false);
              }}
            >
              {/* LA ACTIVA LLEVA UN PUNTO ADELANTE (15/10): el " ·" pegado atrás del nombre se leía como un error. */}
              {r.activa && <View testID="rutina-activa-punto" style={estilos.puntoActiva} />}
              <Text style={[estilos.chipTexto, r.id === sel && estilos.chipTextoElegido]}>{r.nombre}</Text>
            </Pressable>
          ))}
          {rutinas.length < 10 && (
            <Pressable
              testID="rutina-nueva"
              style={estilos.chip}
              onPress={() => {
                if (editando) guardarNombre();
                void crear(semanaVacia());
              }}
            >
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
                onLayout={(e) => setNombreEn({ x: e.nativeEvent.layout.x, ancho: e.nativeEvent.layout.width })}
                defaultValue={actual.nombre}
                maxLength={40}
                onChangeText={(texto) => (nombreTipeado.current = { id: actual.id, texto })}
                onEndEditing={guardarNombre}
              />
            ) : (
              <Text style={estilos.estado}>{actual.activa ? T.rutina.activa : ''}</Text>
            )}
            {!actual.activa && !editando && (
              <Pressable testID="rutina-usar" style={estilos.chico} onPress={() => void activar(actual.id)}>
                <Text style={estilos.chicoTexto}>{T.rutina.usarEsta}</Text>
              </Pressable>
            )}
            <Pressable
              testID="rutina-editar"
              style={estilos.chico}
              onPress={() => {
                if (editando) guardarNombre();
                setEditando(!editando);
              }}
            >
              <Text style={estilos.chicoTexto}>{editando ? T.rutina.listo : T.rutina.editar}</Text>
            </Pressable>
          </View>
          {/* EL GLOBITO DE LA RUTINA (15/10), saliendo del nombre del entrenamiento
              ("Entrenamiento 1" por defecto), la primera vez que se edita. */}
          {editando && nombreEn.ancho > 0 && (
            <GloboPrimeraVez cual="rutina" colaX={nombreEn.x + nombreEn.ancho * 0.75} alinear="centro" vistoAlMostrar>
              {T.globos.rutina}
            </GloboPrimeraVez>
          )}
          <RutinaPlegada
            dias={actual.dias}
            catalogo={catalogo}
            abajoDelDia={editando ? editorDelDia : undefined}
            abiertoAlEmpezar={abrirHoy ? new Date().getDay() : undefined}
            testID="rutina-guardada"
          />
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
          <RutinaPlegada dias={deducida} catalogo={catalogo} soloConAlgo abiertoAlEmpezar={abrirHoy ? new Date().getDay() : undefined} testID="rutina-deducida" />
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
        alElegir={(id, mide) => {
          const d = eligiendoPara;
          setEligiendoPara(null);
          if (!id || d === null || !actual) return;
          // El catálogo primero; uno recién creado todavía no está y trae cómo se mide.
          void cambiar({ ...actual, dias: agregarEjercicio(actual.dias, d, id, (catalogo.get(id)?.mide ?? mide) === 'tiempo') });
        }}
        alCerrar={() => setEligiendoPara(null)}
      />
    </View>
  );
}

// Todas las filas del editor miden lo mismo: así el arrastre sabe sobre cuál está el dedo.
const ALTO_FILA = 44;

const estilos = StyleSheet.create({
  seccion: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginTop: 34, marginBottom: 10 },
  nota: { color: C.apagado, fontSize: 12, lineHeight: 17, marginBottom: 8 },
  error: { color: C.error, fontSize: 13, marginTop: 8 },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineaFuerte, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  puntoActiva: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.claro },
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
  filaEditable: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  ejercicio: { flex: 1, color: C.sub, fontSize: 14 },
  cantidad: { color: C.tinta, fontSize: 13, minWidth: 58, textAlign: 'center', fontVariant: ['tabular-nums'] },
  paso: { color: C.tinta, fontSize: 18, width: 20, textAlign: 'center' },
  quitar: { color: C.apagado, fontSize: 14, width: 20, textAlign: 'center' },
  pregunta: { marginTop: 8 },
  borrar: { color: C.apagado, fontSize: 13, marginTop: 10 },
});
