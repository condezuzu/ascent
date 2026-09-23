import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from './supabase';
import { aISO, deISO, fechaCorta, fechaLinda, hoyISO, restarDias } from '@nucleo/fechas';
import { deKilos, pesoCorto, type Unidad } from '@nucleo/peso';
import { claveDeEtiqueta } from '@nucleo/carga';
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
import { planetaDeDia } from '@nucleo/rangos';
import StatsGeneral, { LineaDeVidas, type PesoAnotado, type Vidas } from './StatsGeneral';
import FondoEspacial from './FondoEspacial';
import Estancamiento from './Estancamiento';
import CalendarioDias from './CalendarioDias';
import { useRecargarAlVolver } from './irAPestana';
import { paletaDe } from '@nucleo/paletas';

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
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState('');
  const [pestana, setPestana] = useState<'general' | 'entrenamiento'>('general');
  const [tocada, setTocada] = useState<number | null>(null);
  // Los grupos de máximos tocados a mano; el resto, abierto si tiene algo.
  const [plegados, setPlegados] = useState<Record<string, boolean>>({});
  // Y los grupos a los que se les pidio ver tambien los que no tienen peso.
  const [vacios, setVacios] = useState<Record<string, boolean>>({});

  const cargar = useCallback(async () => {
    setError('');
    const { data: sesion } = await supabase.auth.getSession();
    const uid = sesion.session?.user?.id;
    if (!uid) return alSalir();
    const [{ data: perfil }, { data: logs }, { data: ses }, { data: cat }, { data: prs }, { data: ws }, vid] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('logs').select('*').eq('user_id', uid).order('fecha'),
      supabase.from('sesiones').select('id, bloques, logs(fecha)').eq('user_id', uid),
      supabase.from('ejercicios').select('*'),
      // Solo las mías: la RLS también deja leer las de los amigos.
      supabase.from('prs').select('ejercicio, peso, fecha').eq('user_id', uid),
      supabase.from('weights').select('fecha, valor').eq('user_id', uid).order('fecha'),
      supabase.rpc('mis_impulsos'),
    ]);
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
      rango: perfil.rango_actual ?? 1,
      planeta: planetaDeDia(perfil.racha_actual ?? 0),
      pesajes: (ws ?? []).map((w) => ({ fecha: w.fecha as string, valor: Number(w.valor) })),
      // Igual que la web: si las vidas no llegan, la línea no se muestra.
      vidas:
        !vid.error && vid.data
          ? {
              quedan: Number(vid.data.quedan),
              total: Number(vid.data.total),
              vuelve: (vid.data.vuelve as string | null) ?? null,
              falta: vid.data.falta_para_ganar === null ? null : Number(vid.data.falta_para_ganar),
            }
          : null,
      sexo: (perfil.sexo as string | null) ?? null,
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

  if (error) {
    return (
      <View style={estilos.centrado}>
        <Text style={estilos.error}>{error}</Text>
        <Pressable onPress={cargar}>
          <Text style={estilos.enlace}>{T.inicio.reintentar}</Text>
        </Pressable>
      </View>
    );
  }
  if (!datos) {
    return (
      <View style={estilos.centrado}>
        <ActivityIndicator color="#8a93a8" />
      </View>
    );
  }

  const { racha, mejor, unidad, logs, sesiones } = datos;
  const entrenados = logs.filter((l) => !l.es_descanso);
  // Las mismas dos cuentas que la web: los últimos 30 días contando hoy, y el
  // mes calendario.
  const en30 = entrenados.filter((l) => l.fecha >= restarDias(hoy, 29)).length;
  const d = deISO(hoy);
  const esteMes = entrenados.filter((l) => l.fecha >= aISO(new Date(d.getFullYear(), d.getMonth(), 1))).length;

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
  const mayuscula = (g: string) => g.charAt(0).toUpperCase() + g.slice(1);
  const pal = paletaDe(datos.rango, datos.planeta);

  return (
    <View style={estilos.raiz}>
      {/* El fondo de Stats en la web: tu cuerpo arriba a la derecha, velo 0,72. */}
      <FondoEspacial rango={datos.rango} planeta={datos.planeta} velo={0.72} />
    <ScrollView contentContainerStyle={estilos.pantalla}>
      <Text style={estilos.titulo}>{T.stats.titulo}</Text>

      <View style={estilos.selector}>
        {(['general', 'entrenamiento'] as const).map((p) => (
          <Pressable
            key={p}
            style={[estilos.opcion, pestana === p && estilos.opcionActiva]}
            onPress={() => setPestana(p)}
            accessibilityRole="tab"
            accessibilityState={{ selected: pestana === p }}
          >
            <Text style={[estilos.opcionTexto, pestana === p && estilos.opcionTextoActivo]}>
              {p === 'general' ? T.stats.pestanaGeneral : T.stats.pestanaEntrenamiento}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* EL AVISO DE ESTANCAMIENTO, si hay uno, arriba de los números: escondido
          abajo sería un aviso que no quiere ser leído. */}
      {pestana === 'general' && (
        <Estancamiento registradoHoy={entrenados.some((l) => l.fecha === hoy)} paleta={pal} />
      )}

      {pestana === 'general' && datos.vidas && <LineaDeVidas vidas={datos.vidas} />}

      {pestana === 'general' && (
        <View style={estilos.grilla}>
          {[
            [String(racha), T.stats.rachaActual],
            [String(mejor), T.stats.mejorRacha],
            [`${en30}/30`, T.stats.ultimos30],
            [String(esteMes), T.stats.esteMes],
          ].map(([v, e]) => (
            <View key={e} style={estilos.celda}>
              <Text style={estilos.valor}>{v}</Text>
              <Text style={estilos.etiqueta}>{e}</Text>
            </View>
          ))}
        </View>
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
        />
      )}

      {pestana === 'entrenamiento' && (
        <>
          {/* Una fila por músculo, una barra por semana, en series: la misma
              pantalla que la web, con las mismas funciones del núcleo. */}
          <Text style={estilos.seccion}>{T.volumen.titulo}</Text>
          {!hayAnotado ? (
            <Text style={estilos.nota}>{T.volumen.vacio}</Text>
          ) : (
            <>
              {/* LA SEMANA QUE SE ESTÁ LEYENDO. Las flechas reemplazan a las
                  ocho barras: eran ellas las que dejaban elegir semana, y eran
                  ellas las que no comunicaban nada. */}
              <View style={estilos.semana}>
                <Pressable
                  onPress={() => setTocada(Math.max(0, indice - 1))}
                  disabled={indice === 0}
                  hitSlop={10}
                  accessibilityLabel={T.volumen.semanaAnterior}
                >
                  <Text style={[estilos.flecha, indice === 0 && estilos.sinMaximo]}>‹</Text>
                </Pressable>
                <Text style={estilos.cuando}>
                  {T.volumen.conTotal(
                    indice === enCurso ? T.volumen.estaSemana : T.volumen.semanaDel(fechaLinda(leidaTotal.desde)),
                    T.volumen.soloSeries(leidaTotal.series)
                  )}
                </Text>
                <Pressable
                  onPress={() => setTocada(Math.min(enCurso, indice + 1))}
                  disabled={indice === enCurso}
                  hitSlop={10}
                  accessibilityLabel={T.volumen.semanaSiguiente}
                >
                  <Text style={[estilos.flecha, indice === enCurso && estilos.sinMaximo]}>›</Text>
                </Pressable>
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
                        style={[
                          estilos.franja,
                          {
                            left: `${(SERIES_POR_SEMANA.minimo / TOPE_DE_PISTA) * 100}%`,
                            width: `${((SERIES_POR_SEMANA.maximo - SERIES_POR_SEMANA.minimo) / TOPE_DE_PISTA) * 100}%`,
                          },
                        ]}
                      />
                      <View
                        style={[
                          estilos.llenado,
                          como === 'poco' && estilos.llenadoPoco,
                          como === 'dentro' && estilos.llenadoDentro,
                          como === 'mucho' && estilos.llenadoMucho,
                          { width: `${porcionDePista(hechas) * 100}%` },
                        ]}
                      />
                    </View>
                    <Text style={[estilos.valorFila, como === 'nada' && estilos.sinMaximo]}>
                      {hechas === 0 ? T.volumen.nada : String(hechas)}
                    </Text>
                  </View>
                );
              })}
              <Text style={estilos.nota}>{T.volumen.notaRango}</Text>
              <Text style={estilos.nota}>{T.volumen.notaRangoPorque}</Text>
            </>
          )}

          {/* Todo el catálogo, en el orden del selector; lo nunca hecho con guion. */}
          {maximos.length > 0 && (
            <>
              <Text style={estilos.seccion}>{T.volumen.maximos}</Text>
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
                    <Pressable
                      style={estilos.cabeza}
                      onPress={() => setPlegados((p) => ({ ...p, [clave]: !abierto }))}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: abierto }}
                    >
                      <Text style={estilos.cabezaTexto}>{g.grupo ? mayuscula(g.grupo) : T.marca.cuentanDots}</Text>
                      <Text style={estilos.cabezaCuenta}>
                        {T.volumen.conPesoDe(g.conPeso, g.filas.length)} {abierto ? '▾' : '›'}
                      </Text>
                    </Pressable>
                    {abierto &&
                      (conVacios ? g.filas : conPeso).map((f) => (
                        <View key={f.ejercicio} style={[estilos.fila, estilos.filaDeGrupo]}>
                          <View style={estilos.filaNombre}>
                            <Text style={[estilos.nombre, !f.maximo && estilos.sinMaximo]}>{f.nombre}</Text>
                            {f.maximo && <Text style={estilos.fecha}>{fechaLinda(f.maximo.fecha)}</Text>}
                          </View>
                          <Text style={[estilos.peso, !f.maximo && estilos.sinMaximo]}>
                            {f.maximo
                              ? T.resumen.pesosDeSeries(
                                  pesoCorto(f.maximo.peso, unidad),
                                  unidad,
                                  claveDeEtiqueta(f.maximo.carga, f.ejercicio)
                                )
                              : T.volumen.nada}
                          </Text>
                        </View>
                      ))}
                    {abierto && faltan > 0 && conPeso.length > 0 && (
                      <Pressable
                        style={estilos.otros}
                        onPress={() => setVacios((p) => ({ ...p, [clave]: !conVacios }))}
                      >
                        <Text style={estilos.otrosTexto}>
                          {conVacios ? T.volumen.ocultarLosOtros : T.volumen.verLosOtros(faltan)}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </>
          )}

          {/* El calendario, abajo del volumen: primero qué venís haciendo,
              después cada día. */}
          <Text style={estilos.seccion}>{T.calendario.titulo}</Text>
          <CalendarioDias paleta={pal} alCambiar={cargar} porRevisar={porRevisar} alRevisar={cargar} />
        </>
      )}
    </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  // Transparente: el fondo lo dibuja `FondoRaiz`.
  raiz: { flex: 1 },
  pantalla: { flexGrow: 1, padding: 24, paddingTop: 64, paddingBottom: 40 },
  centrado: { flex: 1, backgroundColor: '#05060a', alignItems: 'center', justifyContent: 'center', gap: 16 },
  titulo: { color: '#8a93a8', fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 20 },

  selector: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  opcion: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1d2230',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  opcionActiva: { borderColor: '#8a93a8' },
  opcionTexto: { color: '#4a5163', fontSize: 14 },
  opcionTextoActivo: { color: '#e8ecf6' },

  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  celda: { width: '47%', paddingVertical: 14 },
  valor: { color: '#c4c2ba', fontSize: 34, fontWeight: '300' },
  etiqueta: { color: '#4a5163', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 },

  seccion: {
    color: '#8a93a8',
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 12,
  },
  nota: { color: '#4a5163', fontSize: 12, lineHeight: 17, marginBottom: 6 },

  cuando: { color: '#8a93a8', fontSize: 12, textAlign: 'right', marginBottom: 8 },
  filaMusculo: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 10 },
  rotulo: { width: 90 },
  dejado: { color: '#4a5163', fontSize: 11, marginTop: 1 },
  // LA SEMANA QUE SE LEE, con las flechas a los costados. Reemplazan a las ocho
  // barras: eran ellas las que dejaban elegir semana, y eran ellas las que no
  // comunicaban nada.
  semana: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginBottom: 14 },
  flecha: { color: '#8a93a8', fontSize: 22, paddingHorizontal: 2 },
  // LA PISTA: fondo, franja de referencia, y el llenado encima.
  pista: { flex: 1, height: 12, borderRadius: 6, backgroundColor: '#161b26', overflow: 'hidden' },
  // La franja NO es un borde: es un bloque más claro, para que se lea como una
  // zona y no como dos líneas sueltas.
  franja: { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#232b3b' },
  llenado: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6 },
  // POR DEBAJO, APAGADO; DENTRO, EL COLOR DE LA APP; POR ENCIMA, un tono más
  // caliente. Nada de rojo: pasarse no es un error.
  llenadoPoco: { backgroundColor: '#4a5163' },
  llenadoDentro: { backgroundColor: '#7e8ca8' },
  llenadoMucho: { backgroundColor: '#c4c2ba' },
  valorFila: { width: 58, color: '#e8ecf6', fontSize: 14, textAlign: 'right' },

  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1d2230',
    gap: 12,
  },
  filaNombre: { flex: 1 },
  nombre: { color: '#e8ecf6', fontSize: 15 },
  fecha: { color: '#4a5163', fontSize: 12, marginTop: 2 },
  peso: { color: '#8a93a8', fontSize: 13 },
  filaDeGrupo: { paddingLeft: 12 },
  otros: { paddingLeft: 12, paddingVertical: 10 },
  otrosTexto: { color: '#8a93a8', fontSize: 13 },
  sinMaximo: { color: '#4a5163' },
  cabeza: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a3040',
  },
  cabezaTexto: { color: '#e8ecf6', fontSize: 14 },
  cabezaCuenta: { color: '#4a5163', fontSize: 12 },

  error: { color: '#e8705f', fontSize: 13, textAlign: 'center' },
  enlace: { color: '#8a93a8', fontSize: 13 },
});
