import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { nombreDeGrupo } from '@nucleo/ejercicios';
import { ActivityIndicator, ScrollView, StyleSheet, View, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from './supabase';
import { quienSoy } from '@compartido/quienSoy';
import { aISO, deISO, fechaCorta, fechaLinda, hoyISO } from '@nucleo/fechas';
import { deKilos, pesoCorto, type Unidad } from '@nucleo/peso';
import { claveDeEtiqueta } from '@nucleo/carga';
import { progresoPorEjercicio } from '@nucleo/progreso';
import { umbralValido } from '@nucleo/estancamiento';
import {
  SERIES_POR_SEMANA,
  TOPE_DE_PISTA,
  comoVaElMusculo,
  fechasPorRevisar,
  filasPorMusculo,
  porcionDePista,
  maximosDelCatalogo,
  semanaParaLeer,
  sesionesConFecha,
  type EjercicioDelCatalogo,
  type MarcaParaMaximo,
  type SesionConBloques,
} from '@nucleo/volumen';
import type { Log } from '@nucleo/tipos';
import { T } from '@nucleo/textos';
import { cuerpoDe } from '@nucleo/rangos';
import { diasFaltados, type SemanaDeRutina } from '@nucleo/faltados';
import type { ConfigDescanso } from '@nucleo/reglas';
import Tocable from './Tocable';
import { disponible } from '@nucleo/esquema';
import { versionDelEsquema } from '@compartido/esquema';
import StatsGeneral, { LineaDeVidas, type PesoAnotado, type Vidas } from './StatsGeneral';
import FondoEspacial from './FondoEspacial';
import Estancamiento from './Estancamiento';
import CalendarioDias from './CalendarioDias';
import KilosPorSemana from './KilosPorSemana';
import { useRecargarAlVolver } from './irAPestana';
import MiRutina from './MiRutina';
import { precargarRutina } from '@compartido/rutinaPrecargada';
import { eventos } from '@compartido/eventos';
import { ABRIR_ENTRENAMIENTO, seAcabaDePedir } from './abrirEntrenamiento';
import { paletaDe } from '@nucleo/paletas';
import { useArriba } from './zonaSegura';
import { C, conTema, conAlfa } from './colores';
import { useTema } from './useTema';
import { Text } from './Texto';
import { L } from './fuentes';
import { R, Seccion } from './roles';
import { LLEGA, MS, sinMovimiento } from './movimiento';
import CifrasDelAno from './CifrasDelAno';
import Entra from './Entra';
import PuertaDeMoss, { MossAsomando, TIRON_PARA_ENTRAR } from './PuertaDeMoss';
import { YA_SE_ABRIO_EL_DIA_MS } from './RutinaPlegada';
import Surgir from './Surgir';
import Relleno from './Relleno';
import LineaChiquita from './LineaChiquita';
import { dejarProgreso } from './progresoPrecargado';

const SEMANAS = 8;

type Datos = {
  racha: number;
  mejor: number;
  unidad: Unidad;
  umbral: number;
  logs: Log[];
  sesiones: SesionConBloques[];
  ejercicios: EjercicioDelCatalogo[];
  marcas: MarcaParaMaximo[];
  rango: number;
  planeta: string | null;
  // `pesajes` y no `pesos`: acá `pesos` ya son los kilos de cada serie, y
  // el peso corporal con el mismo nombre se confunde —se confundió un test—.
  pesajes: PesoAnotado[];
  vidas: Vidas | null;
  /** Los días faltados desde el alta (28/10); null sin la migración 97. */
  faltados: number | null;
  sexo: string | null;
};

/**
 * STATS EN NATIVO: los números de siempre y qué venís haciendo.
 *
 * LAS CUENTAS NO ESTÁN ACÁ. El volumen por semana, el máximo de cada ejercicio
 * y dónde no estás entrenando salen de `nucleo/volumen.ts`, los mismos que usa
 * la web: esta pantalla pide las filas y dibuja. Si un número difiriera entre
 * el teléfono y la computadora, sería por el dibujo, nunca por la cuenta.
 *
 * LAS DOS PESTAÑAS ESTÁN ENTERAS desde el 18/9: General (`StatsGeneral`, con
 * la fuerza y el aviso de estancamiento) y Entrenamiento, con el calendario y
 * el resumen de cada día (`CalendarioDias`, `HojaDelDia`). Lo que se pide para
 * cada sección vive en `compartido/`, igual que en la web.
 *
 * LO QUE NO ESTÁ: el aviso de "hay pesos de antes de los modos para revisar"
 * arriba del volumen. Los días igual llevan su marca en el calendario, y la
 * revisión se hace adentro de cada día, como en la web.
 */
export default function Stats({ alSalir }: { alSalir: () => void }) {
  useTema();
  const router = useRouter();
  const arriba = useArriba(64);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState('');
  const [pestana, setPestana] = useState<'general' | 'entrenamiento'>(() => (seAcabaDePedir() ? 'entrenamiento' : 'general'));
  const [anchoSelector, setAnchoSelector] = useState(0);
  const [anoAbierto, setAnoAbierto] = useState(false);
  // MOSS, ARRIBA (2/11, a pedido). Cuánto se tiró para abajo desde el tope: es lo negativo del desplazamiento.
  const [enMoss, setEnMoss] = useState(false);
  const tironAlSoltar = useRef(0);
  const desplazado = useRef(new Animated.Value(0)).current;
  const tiron = useRef(Animated.multiply(desplazado, -1)).current;
  // Al cambiar General y Entrenamiento, lo nuevo llega de su lado.
  const cambio = useRef(new Animated.Value(1)).current;
  const lado = useRef(1);
  const pestanaAntes = useRef(pestana);
  useEffect(() => {
    if (pestanaAntes.current === pestana) return;
    lado.current = pestana === 'general' ? -1 : 1;
    pestanaAntes.current = pestana;
    void sinMovimiento().then((quieto) => {
      if (quieto) return;
      cambio.setValue(0);
      Animated.timing(cambio, { toValue: 1, duration: 420, easing: LLEGA, useNativeDriver: true }).start();
    });
  }, [pestana, cambio]);
  const pulgar = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!anchoSelector) return;
    const destino = pestana === 'general' ? 0 : (anchoSelector + HUECO_SELECTOR) / 2;
    void sinMovimiento().then((quieto) => {
      Animated.timing(pulgar, { toValue: destino, duration: quieto ? 0 : MS.pulgar, easing: LLEGA, useNativeDriver: true }).start();
    });
  }, [pestana, anchoSelector, pulgar]);
  // La fila "Hoy" de Inicio trae acá, a la rutina (16/10).
  useEffect(() => eventos.escuchar(ABRIR_ENTRENAMIENTO, () => {
    seAcabaDePedir();
    setPestana('entrenamiento');
  }), []);
  // Mientras se arrastra un ejercicio de la rutina, la pantalla no se mueve.
  const [arrastrando, setArrastrando] = useState(false);
  const [tocada, setTocada] = useState<number | null>(null);
  // Los grupos de máximos tocados a mano; el resto, abierto si tiene algo.
  const [plegados, setPlegados] = useState<Record<string, boolean>>({});
  // Y los grupos a los que se les pidio ver tambien los que no tienen peso.
  const [vacios, setVacios] = useState<Record<string, boolean>>({});

  const cargar = useCallback(async () => {
    setError('');
    const yo = await quienSoy(supabase);
    if (yo.estado === 'sin') return alSalir();
    if (yo.estado === 'no-se') return setError(T.inicio.noCargo);
    const uid = yo.uid;
    // «Tu rutina» junto con lo demás (21/10): así Entrenamiento no la espera al abrirse.
    void precargarRutina(supabase);
    const [{ data: perfil }, { data: logs }, { data: ses }, { data: cat }, { data: prs }, { data: ws }, vid] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('logs').select('*').eq('user_id', uid).order('fecha'),
      supabase.from('sesiones').select('id, bloques, logs(fecha)').eq('user_id', uid),
      supabase.from('ejercicios').select('*'),
      // Solo las mías: la RLS también deja leer las de los amigos.
      supabase.from('prs').select('ejercicio, peso, reps, fecha').eq('user_id', uid),
      supabase.from('weights').select('fecha, valor').eq('user_id', uid).order('fecha'),
      supabase.rpc('mis_impulsos'),
    ]);
    // Aparte, y solo con la 97: antes la tabla no existe y pedirla es un 404 en cada visita.
    const { data: sem, error: eSem } = disponible('diasFaltados', await versionDelEsquema(supabase))
      ? await supabase.from('rutina_semanas').select('desde, entrena').eq('user_id', uid)
      : { data: null, error: true };
    // Sin rutina guardada, lo que tocaba lo dicen los días de descanso de Ajustes. Y se cuenta
    // desde el alta de la cuenta, que el perfil no guarda: la sesión sí (`yo.alta`).
    const { data: desc } = await supabase.from('descansos').select('desde, dias').eq('user_id', uid);
    const alta = yo.alta;
    // DICE QUE NO SE PUDO TRAER, no "no se guardó" (25/9). Usaba
    // `T.general.noSePudo`, que es el texto de una ESCRITURA que falla: sin red,
    // Stats decía "No se guardó. Prueba de nuevo." cuando no se estaba
    // guardando nada. Lo vio el barrido, en la captura de "sin red".
    if (!perfil) return setError(T.inicio.noCargo);
    setDatos({
      racha: perfil.racha_actual ?? 0,
      mejor: perfil.mejor_racha ?? 0,
      unidad: perfil.unidad_peso === 'lb' ? 'lb' : 'kg',
      umbral: umbralValido(perfil.umbral_estancamiento),
      logs: (logs ?? []) as Log[],
      sesiones: sesionesConFecha(ses),
      ejercicios: (cat ?? []) as EjercicioDelCatalogo[],
      marcas: (prs ?? []) as MarcaParaMaximo[],
      // El rango y el planeta del fondo, los dos de la racha: ver `cuerpoDe`.
      ...cuerpoDe(perfil.racha_actual),
      pesajes: (ws ?? []).map((w) => ({ fecha: w.fecha as string, valor: Number(w.valor) })),
      // Igual que la web: si las vidas no llegan, la línea no se muestra.
      vidas:
        !vid.error && vid.data
          ? {
              quedan: Number(vid.data.quedan),
              total: Number(vid.data.total),
              tope: Number(vid.data.tope ?? vid.data.total),
              vuelve: (vid.data.vuelve as string | null) ?? null,
              falta: vid.data.falta_para_ganar === null ? null : Number(vid.data.falta_para_ganar),
            }
          : null,
      sexo: (perfil.sexo as string | null) ?? null,
      faltados:
        eSem || !sem || !alta
          ? null
          : diasFaltados(sem as SemanaDeRutina[], (desc ?? []) as ConfigDescanso[], new Set((logs ?? []).map((l) => l.fecha as string)), aISO(new Date(alta)), hoyISO()),
    });
  }, [alSalir]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Y de nuevo al volver a esta pestaña: ahora se queda montada.
  useRecargarAlVolver('stats', cargar);

  // LOS TRES `useMemo` VAN ARRIBA DE LOS DOS `return` DE ABAJO, y el orden no
  // es cosmetico: es la diferencia entre que Stats ande y que se caiga.
  //
  // Mientras los datos no llegaron, el componente salia por `if (!datos)` y
  // estos hooks no se llamaban; cuando llegaban, si. Dos cantidades distintas
  // de hooks en dos renders es "Rendered more hooks than during the previous
  // render", y la pestana Entrenamiento se caia entera.
  //
  // Lo rompio la tanda que metio estas cuentas en `useMemo` para que no se
  // recalcularan en cada toque: como llamadas comunes estaban bien donde
  // estaban, como hooks no. Paso igual en la web (`SeccionVolumen`), y aca lo
  // encontro `test:real`, que es lo unico que abre la pantalla de verdad.
  const hoy = hoyISO();
  const catalogo = useMemo(
    () => new Map((datos?.ejercicios ?? []).map((e) => [e.id, { nombre: e.nombre, grupo: e.grupo }])),
    [datos?.ejercicios]
  );
  const volumen = useMemo(
    () =>
      filasPorMusculo(datos?.sesiones ?? [], catalogo, {
        hoy,
        semanas: SEMANAS,
        umbral: datos?.umbral ?? 6,
      }),
    [datos?.sesiones, catalogo, hoy, datos?.umbral]
  );
  // Los días con pesos anotados antes de los modos (migración 39): la marca
  // del calendario. Arriba de los `return`, como los otros: ver arriba.
  const porRevisar = useMemo(() => fechasPorRevisar(datos?.sesiones ?? []), [datos?.sesiones]);
  const maximos = useMemo(
    () => maximosDelCatalogo(datos?.sesiones ?? [], datos?.marcas ?? [], datos?.ejercicios ?? []),
    [datos?.sesiones, datos?.marcas, datos?.ejercicios]
  );
  const progresos = useMemo(() => progresoPorEjercicio(datos?.sesiones ?? [], datos?.marcas ?? []), [datos?.sesiones, datos?.marcas]);

  // El cartel, solo si no hay nada que mostrar: una recarga que falla no tapa
  // lo que ya estaba en pantalla.
  if (error && !datos) {
    return (
      <View style={estilos.centrado}>
        <Text style={estilos.error}>{error}</Text>
        <Tocable onPress={cargar}>
          <Text style={estilos.enlace}>{T.inicio.reintentar}</Text>
        </Tocable>
      </View>
    );
  }
  if (!datos) {
    return (
      <View style={estilos.centrado}>
        <ActivityIndicator color={C.sub} />
      </View>
    );
  }

  const { racha, mejor, unidad, logs, sesiones } = datos;
  const entrenados = logs.filter((l) => !l.es_descanso);
  const d = deISO(hoy);
  const esteMes = entrenados.filter((l) => l.fecha >= aISO(new Date(d.getFullYear(), d.getMonth(), 1))).length;
  // Cuántas veces fue este AÑO calendario (28/9): un amigo le preguntó y no lo
  // tenía. Los logs vienen completos (sin filtro de fecha), así que es exacto.
  const esteAno = entrenados.filter((l) => l.fecha >= aISO(new Date(d.getFullYear(), 0, 1))).length;

  // LOS TOPES YA NO SE USAN (25/9). Eran la escala de las barras, que se
  // estiraba con tu propio máximo: por eso una barra llena podía ser 4 series o
  // 40, y por eso "las barras no comunican nada". La pista tiene tope fijo y la
  // referencia adentro. `filasPorMusculo` los sigue devolviendo porque la web
  // los usa.
  const { filas, totales, hayAnotado } = volumen;
  const indice = semanaParaLeer(totales, tocada);
  // La última barra es la semana de hoy, que todavía no terminó.
  const enCurso = totales.length - 1;
  const leidaTotal = totales[indice];
  const kilosLindos = (kg: number) => Math.round(deKilos(kg, unidad)).toLocaleString(T.general.locale);
  const mayuscula = nombreDeGrupo;
  const pal = paletaDe(datos.rango, datos.planeta);

  return (
    <View style={estilos.raiz}>
      {/* El fondo de Stats en la web: tu cuerpo arriba a la derecha, velo 0,72. */}
      <FondoEspacial rango={datos.rango} planeta={datos.planeta} velo={0.72} />
    <Animated.ScrollView
      contentContainerStyle={[estilos.pantalla, { paddingTop: arriba }]}
      scrollEnabled={!arrastrando}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: desplazado } } }], { useNativeDriver: true })}
      onScrollEndDrag={(e) => {
        if (e.nativeEvent.contentOffset.y >= -TIRON_PARA_ENTRAR) return;
        tironAlSoltar.current = -e.nativeEvent.contentOffset.y;
        setEnMoss(true);
      }}
    >
      <PuertaDeMoss
        abierta={enMoss}
        desde={tironAlSoltar.current}
        alAbrir={() => {
          tironAlSoltar.current = 0;
          setEnMoss(true);
        }}
        alCerrar={() => setEnMoss(false)}
      />
      <Entra><Text style={estilos.titulo}>{T.stats.titulo}</Text></Entra>

      <Entra orden={1}>
      <View style={estilos.selector} onLayout={(e) => setAnchoSelector(e.nativeEvent.layout.width)}>
        {/* La selección viaja de una opción a la otra: se ve de dónde vino. */}
        {anchoSelector > 0 && (
          <Animated.View
            testID="stats-pulgar"
            pointerEvents="none"
            style={[estilos.pulgar, { width: (anchoSelector - HUECO_SELECTOR) / 2, transform: [{ translateX: pulgar }] }]}
          />
        )}
        {(['general', 'entrenamiento'] as const).map((p) => (
          <Tocable
            key={p}
            style={estilos.opcion}
            onPress={() => setPestana(p)}
            accessibilityRole="tab"
            accessibilityState={{ selected: pestana === p }}
          >
            <Text style={[estilos.opcionTexto, pestana === p && estilos.opcionTextoActivo]}>
              {p === 'general' ? T.stats.pestanaGeneral : T.stats.pestanaEntrenamiento}
            </Text>
          </Tocable>
        ))}
      </View>
      </Entra>

      <Animated.View style={{ opacity: cambio, transform: [{ translateX: cambio.interpolate({ inputRange: [0, 1], outputRange: [lado.current * 26, 0] }) }] }}>
      {/* EL AVISO DE ESTANCAMIENTO, si hay uno, arriba de los números: escondido
          abajo sería un aviso que no quiere ser leído. */}
      {pestana === 'general' && (
        <Estancamiento registradoHoy={entrenados.some((l) => l.fecha === hoy)} paleta={pal} />
      )}

      {/* UN NÚMERO POR PANTALLA (2/11, «Cifras»): los cuatro de la grilla, cada uno en su caja, pesaban
          todos igual. Se sacaron "Racha actual" (ya está en Inicio) y "Últimos 30 días" (no aportaba). */}
      {pestana === 'general' && (
        <Entra orden={2}>
          <CifrasDelAno
            fechas={entrenados.map((l) => l.fecha)}
            hoy={hoy}
            esteMes={esteMes}
            esteAno={esteAno}
            mejor={mejor}
            faltados={datos.faltados}
            anoAbierto={anoAbierto}
            alTocarMeses={() => setAnoAbierto((v) => !v)}
          />
        </Entra>
      )}

      {pestana === 'general' && datos.vidas && (
        <Entra orden={3}>
          <LineaDeVidas vidas={datos.vidas} racha={racha} />
        </Entra>
      )}

      {/* El resto de General, en el orden de la web: el año, las sesiones,
          el peso y la escalera. Ver `StatsGeneral.tsx`. */}
      {pestana === 'general' && (
        <StatsGeneral
          logs={logs}
          racha={racha}
          rango={datos.rango}
          planeta={datos.planeta}
          unidad={unidad}
          pesos={datos.pesajes}
          sexo={datos.sexo}
          alCambiar={cargar}
          calendario={<CalendarioDias paleta={pal} alCambiar={cargar} porRevisar={porRevisar} alRevisar={cargar} />}
          anoAbierto={anoAbierto}
        />
      )}

      {pestana === 'entrenamiento' && (
        <>
          {/* TU RUTINA, ARRIBA DE TODO, otra vez (16/10, a pedido): vuelve a Entrenamiento,
              donde estaba. En Inicio queda la fila de lo que toca hoy, que trae acá. */}
          <MiRutina visible={pestana === 'entrenamiento'} abrirHoy alArrastrar={setArrastrando} />
          {/* LO QUE SIGUE LLEGA DESPUÉS DE LA RUTINA (2/11): antes, el día que se abre lo empujaba a la vista. */}
          <Surgir demora={YA_SE_ABRIO_EL_DIA_MS}>
          {/* Una fila por músculo, una barra por semana, en series: la misma
              pantalla que la web, con las mismas funciones del núcleo. */}
          <Seccion>{T.volumen.titulo}</Seccion>
          {!hayAnotado ? (
            <Text style={estilos.nota}>{T.volumen.vacio}</Text>
          ) : (
            <>
              {/* LA SEMANA QUE SE ESTÁ LEYENDO. Las flechas reemplazan a las
                  ocho barras: eran ellas las que dejaban elegir semana, y eran
                  ellas las que no comunicaban nada. */}
              <View style={estilos.semana}>
                <Tocable
                  onPress={() => setTocada(Math.max(0, indice - 1))}
                  disabled={indice === 0}
                  hitSlop={10}
                  accessibilityLabel={T.volumen.semanaAnterior}
                >
                  <Text style={[estilos.flecha, indice === 0 && estilos.sinMaximo]}>‹</Text>
                </Tocable>
                <Text style={estilos.cuando}>
                  {T.volumen.conTotal(
                    indice === enCurso ? T.volumen.estaSemana : T.volumen.semanaDel(fechaLinda(leidaTotal.desde)),
                    T.volumen.soloSeries(leidaTotal.series)
                  )}
                </Text>
                <Tocable
                  onPress={() => setTocada(Math.min(enCurso, indice + 1))}
                  disabled={indice === enCurso}
                  hitSlop={10}
                  accessibilityLabel={T.volumen.semanaSiguiente}
                >
                  <Text style={[estilos.flecha, indice === enCurso && estilos.sinMaximo]}>›</Text>
                </Tocable>
              </View>

              {/* LA FRANJA SE LEE SOLA (propuesta B): 10 y 20 arriba de las barras, y prendida en la fila
                  que está adentro. VoiceOver sigue leyendo lo que antes eran dos notas. */}
              <View
                style={estilos.filaEscala}
                testID="escala-de-series"
                accessible
                accessibilityLabel={`${T.volumen.notaRango} ${T.volumen.notaRangoPorque}`}
              >
                <View style={estilos.rotulo} />
                <View style={estilos.escala}>
                  {[SERIES_POR_SEMANA.minimo, SERIES_POR_SEMANA.maximo].map((n) => (
                    <Text key={n} style={[estilos.marcaEscala, { left: `${(n / TOPE_DE_PISTA) * 100}%` }]}>{n}</Text>
                  ))}
                </View>
                <View style={estilos.valorFila} />
              </View>
              {filas.map((f) => {
                const hechas = f.semanas[indice].series;
                const como = comoVaElMusculo(hechas);
                return (
                  <View key={f.grupo} style={estilos.filaMusculo}>
                    <View style={estilos.rotulo}>
                      <Text style={[estilos.nombre, como === 'nada' && estilos.sinMaximo]}>{mayuscula(f.grupo)}</Text>
                      {f.dejado && (
                        <Text style={estilos.dejado}>{T.volumen.nadaDesde(fechaLinda(f.dejado.ultima))}</Text>
                      )}
                    </View>
                    {/* LA PISTA. El tope es FIJO (24) y ahí está la gracia: con
                        una escala que se estirara con la fila más alta, la
                        franja se movería de lugar en cada pantalla y volvería a
                        no significar nada. */}
                    <View style={estilos.pista}>
                      <View
                        testID={como === 'dentro' ? 'franja-viva' : 'franja'}
                        style={[
                          estilos.franja,
                          como === 'dentro' && estilos.franjaViva,
                          {
                            left: `${(SERIES_POR_SEMANA.minimo / TOPE_DE_PISTA) * 100}%`,
                            width: `${((SERIES_POR_SEMANA.maximo - SERIES_POR_SEMANA.minimo) / TOPE_DE_PISTA) * 100}%`,
                          },
                        ]}
                      />
                      <Relleno fraccion={porcionDePista(hechas)} style={[estilos.llenado, como === 'poco' && estilos.llenadoPoco, como === 'dentro' && estilos.llenadoDentro, como === 'mucho' && estilos.llenadoMucho]} />
                    </View>
                    <Text style={[estilos.valorFila, como === 'nada' && estilos.sinMaximo]}>
                      {hechas === 0 ? T.volumen.nada : String(hechas)}
                    </Text>
                  </View>
                );
              })}
              {/* EL PESO TOTAL POR SEMANA (15/10): uno solo, y elige la misma semana que las filas. */}
              <KilosPorSemana
                semanas={totales}
                elegida={indice}
                alElegir={setTocada}
                color={pal.principal}
                enUnidad={kilosLindos}
                unidad={unidad}
              />
            </>
          )}

          {/* Todo el catálogo, en el orden del selector; lo nunca hecho con guion. */}
          {maximos.length > 0 && (
            <>
              <Seccion>{T.volumen.maximos}</Seccion>
              <Text style={estilos.nota}>{T.volumen.maximosNota}</Text>
              {maximos.map((g) => {
                const clave = g.grupo ?? 'dots';
                const abierto = plegados[clave] ?? g.conPeso > 0;
                // LOS QUE NO TIENEN PESO NO SE LISTAN (25/9). "Los ejercicios
                // sin peso registrado no tienen que aparecer con peso. En la
                // web creo que ya estaba arreglado" — y estaba: allá se
                // esconden detrás de un toque desde el 22/9 y acá se habían
                // quedado sin portar. Con un ejercicio de pecho anotado de
                // doce, esto eran once guiones; por seis grupos, toda la
                // pantalla.
                //
                // SI NO HAY NINGUNO se muestran igual: un grupo abierto y
                // vacío del todo no dice nada, y "ver los otros 12" sobre la
                // nada es una puerta a un cuarto vacío.
                const conPeso = g.filas.filter((f) => f.maximo);
                const faltan = g.filas.length - conPeso.length;
                const conVacios = vacios[clave] ?? conPeso.length === 0;
                return (
                  <View key={clave}>
                    <Tocable
                      style={estilos.cabeza}
                      onPress={() => setPlegados((p) => ({ ...p, [clave]: !abierto }))}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: abierto }}
                    >
                      <Text style={estilos.cabezaTexto}>{g.grupo ? mayuscula(g.grupo) : T.marca.cuentanDots}</Text>
                      <Text style={estilos.cabezaCuenta}>
                        {T.volumen.conPesoDe(g.conPeso, g.filas.length)} {abierto ? '▾' : '›'}
                      </Text>
                    </Tocable>
                    {abierto &&
                      (conVacios ? g.filas : conPeso).map((f) => {
                        const progreso = progresos.get(f.ejercicio);
                        // LA LÍNEA CHIQUITA ES LO QUE DICE QUE SE TOCA. Las del guion no llevan a nada.
                        if (!f.maximo || !progreso) {
                          return (
                            <View key={f.ejercicio} style={[estilos.fila, estilos.filaDeGrupo]}>
                              <View style={estilos.filaNombre}>
                                <Text style={[estilos.nombre, estilos.sinMaximo]}>{f.nombre}</Text>
                              </View>
                              <Text style={[estilos.peso, estilos.sinMaximo]}>{T.volumen.nada}</Text>
                            </View>
                          );
                        }
                        const texto =
                          T.resumen.pesosDeSeries(pesoCorto(f.maximo.peso, unidad), unidad, claveDeEtiqueta(f.maximo.carga, f.ejercicio)) +
                          (f.maximo.reps ? T.volumen.conReps(f.maximo.reps) : '');
                        return (
                          <Tocable
                            key={f.ejercicio}
                            testID={`fila-maximo-${f.ejercicio}`}
                            style={[estilos.fila, estilos.filaDeGrupo]}
                            onPress={() => {
                              dejarProgreso({ ejercicio: f.ejercicio, nombre: f.nombre, progreso, unidad, rango: datos.rango, planeta: datos.planeta });
                              router.push(`/progreso/${f.ejercicio}`);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`${f.nombre}: ${texto}`}
                            accessibilityHint={T.progreso.abrir}
                          >
                            <View style={estilos.filaNombre}>
                              <Text style={estilos.nombre}>{f.nombre}</Text>
                              <Text style={estilos.fecha}>{fechaLinda(f.maximo.fecha)}</Text>
                            </View>
                            <LineaChiquita progreso={progreso} />
                            <Text style={[estilos.peso, estilos.pesoDeFila]}>{texto}</Text>
                          </Tocable>
                        );
                      })}
                    {abierto && faltan > 0 && conPeso.length > 0 && (
                      <Tocable
                        style={estilos.otros}
                        onPress={() => setVacios((p) => ({ ...p, [clave]: !conVacios }))}
                      >
                        <Text style={estilos.otrosTexto}>
                          {conVacios ? T.volumen.ocultarLosOtros : T.volumen.verLosOtros(faltan)}
                        </Text>
                      </Tocable>
                    )}
                  </View>
                );
              })}
            </>
          )}
          </Surgir>

        </>
      )}
      </Animated.View>
    </Animated.ScrollView>
    <MossAsomando tiron={tiron as unknown as Animated.Value} />
    </View>
  );
}

const HUECO_SELECTOR = 8;

const estilos = conTema(() => StyleSheet.create({
  // Transparente: el fondo lo dibuja `FondoRaiz`.
  raiz: { flex: 1 },
  pantalla: { flexGrow: 1, padding: 24, paddingTop: 64, paddingBottom: 40 },
  centrado: { flex: 1, backgroundColor: C.fondo, alignItems: 'center', justifyContent: 'center', gap: 16 },
  titulo: { ...R.etiqueta, marginBottom: 20  },

  selector: { flexDirection: 'row', gap: HUECO_SELECTOR, marginBottom: 20 },
  pulgar: { position: 'absolute', left: 0, top: 0, bottom: 0, borderWidth: 1, borderColor: C.claro, backgroundColor: C.fondoMeta, borderRadius: 999 },
  opcion: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.linea,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  opcionTexto: { color: C.apagado, fontSize: 14 },
  opcionTextoActivo: { color: C.claro },

  nota: { ...R.nota, marginBottom: 6  },

  cuando: { color: C.sub, fontSize: 12, textAlign: 'right', marginBottom: 8 },
  filaMusculo: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 10 },
  rotulo: { width: 90 },
  dejado: { color: C.apagado, fontSize: 11, marginTop: 1 },
  // LA SEMANA QUE SE LEE, con las flechas a los costados. Reemplazan a las ocho
  // barras: eran ellas las que dejaban elegir semana, y eran ellas las que no
  // comunicaban nada.
  semana: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginBottom: 14 },
  flecha: { color: C.sub, fontSize: 22, paddingHorizontal: 2 },
  // LA PISTA: fondo, franja de referencia, y el llenado encima.
  pista: { flex: 1, height: 12, borderRadius: 999, backgroundColor: C.barraPista, overflow: 'hidden' },
  // La franja NO es un borde: es un bloque más claro, para que se lea como una
  // zona y no como dos líneas sueltas.
  franja: { position: 'absolute', top: 0, bottom: 0, backgroundColor: C.barraFranja },
  franjaViva: { backgroundColor: conAlfa(C.claro, 0.22) },
  filaEscala: { flexDirection: 'row', gap: 10, height: 16, marginBottom: 4 },
  escala: { flex: 1 },
  marcaEscala: { position: 'absolute', width: 24, marginLeft: -12, textAlign: 'center', color: C.apagado, fontSize: 10.5, fontFamily: L.dato },
  llenado: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999 },
  // POR DEBAJO, APAGADO; DENTRO, EL COLOR DE LA APP; POR ENCIMA, un tono más
  // caliente. Nada de rojo: pasarse no es un error.
  llenadoPoco: { backgroundColor: C.barraPoco },
  llenadoDentro: { backgroundColor: C.barraDentro },
  llenadoMucho: { backgroundColor: C.claro },
  valorFila: { width: 58, color: C.tinta, fontSize: 14, textAlign: 'right', fontFamily: L.dato },

  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.linea,
    gap: 12,
  },
  filaNombre: { flex: 1 },
  nombre: { color: C.tinta, fontSize: 15 },
  fecha: { color: C.apagado, fontSize: 12, marginTop: 2, fontFamily: L.dato },
  peso: { color: C.sub, fontSize: 13, fontFamily: L.dato },
  pesoDeFila: { maxWidth: 118, textAlign: 'right' },
  filaDeGrupo: { paddingLeft: 12 },
  otros: { paddingLeft: 12, paddingVertical: 10 },
  otrosTexto: { color: C.sub, fontSize: 13 },
  sinMaximo: { color: C.apagado },
  cabeza: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.lineaFuerte,
  },
  cabezaTexto: { color: C.tinta, fontSize: 14 },
  cabezaCuenta: { color: C.apagado, fontSize: 12, fontFamily: L.dato },

  error: { color: C.error, fontSize: 13, textAlign: 'center' },
  enlace: { color: C.sub, fontSize: 13 },
}));
