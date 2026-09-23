import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from './supabase';
import { aISO, deISO, fechaCorta, fechaLinda, hoyISO, restarDias } from '@nucleo/fechas';
import { deKilos, pesoCorto, type Unidad } from '@nucleo/peso';
import { claveDeEtiqueta } from '@nucleo/carga';
import { umbralValido } from '@nucleo/estancamiento';
import {
  fechasPorRevisar,
  filasPorMusculo,
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
  const [enSeries, setEnSeries] = useState(true);
  const [tocada, setTocada] = useState<number | null>(null);
  // Los grupos de máximos tocados a mano; el resto, abierto si tiene algo.
  const [plegados, setPlegados] = useState<Record<string, boolean>>({});

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
    if (!perfil) return setError(T.general.noSePudo);
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

  const { filas, totales, hayAnotado, topeSeries, topeKilos } = volumen;
  const hayKilos = topeKilos > 0;
  const series = enSeries || !hayKilos;
  const valor = (s: { series: number; kilos: number }) => (series ? s.series : s.kilos);
  const tope = series ? topeSeries : topeKilos;
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
      <FondoEspacial rango={datos.rango} planeta={datos.planeta} soloEstrellas velo={0.72} />
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
              {hayKilos && (
                <View style={estilos.selector}>
                  {([true, false] as const).map((s) => (
                    <Pressable
                      key={String(s)}
                      style={[estilos.opcion, series === s && estilos.opcionActiva]}
                      onPress={() => setEnSeries(s)}
                    >
                      <Text style={[estilos.opcionTexto, series === s && estilos.opcionTextoActivo]}>
                        {s ? T.volumen.enSeries : T.volumen.enKilos}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <Text style={estilos.cuando}>
                {T.volumen.conTotal(
                  indice === enCurso ? T.volumen.estaSemana : T.volumen.semanaDel(fechaLinda(leidaTotal.desde)),
                  series ? T.volumen.soloSeries(leidaTotal.series) : `${kilosLindos(leidaTotal.kilos)} ${unidad}`
                )}
              </Text>
              {filas.map((f) => {
                const leida = f.semanas[indice];
                return (
                  <View key={f.grupo} style={estilos.filaMusculo}>
                    <View style={estilos.rotulo}>
                      <Text style={[estilos.nombre, f.vacia && estilos.sinMaximo]}>{mayuscula(f.grupo)}</Text>
                      {f.dejado && (
                        <Text style={estilos.dejado}>{T.volumen.nadaDesde(fechaLinda(f.dejado.ultima))}</Text>
                      )}
                    </View>
                    <View style={estilos.barras}>
                      {f.semanas.map((s, i) => (
                        <Pressable key={s.desde} style={estilos.barra} onPress={() => setTocada(i)}>
                          <View
                            style={[
                              estilos.relleno,
                              i === indice && estilos.rellenoLeido,
                              // Sin nada no hay contorno: sería un punteado suelto sobre la base.
                              i === enCurso && valor(s) > 0 && (i === indice ? estilos.enCursoLeido : estilos.enCurso),
                              { height: `${tope > 0 ? (valor(s) / tope) * 100 : 0}%` },
                            ]}
                          />
                        </Pressable>
                      ))}
                    </View>
                    <Text style={[estilos.valorFila, f.vacia && estilos.sinMaximo]}>
                      {leida.series === 0 ? T.volumen.nada : series ? String(leida.series) : `${kilosLindos(leida.kilos)} ${unidad}`}
                    </Text>
                  </View>
                );
              })}
              {/* El eje: la primera semana y la de hoy. */}
              <View style={estilos.eje} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <View style={estilos.rotulo} />
                <View style={estilos.ejeFechas}>
                  <Text style={estilos.ejeTexto}>{fechaCorta(totales[0].desde)}</Text>
                  <Text style={estilos.ejeTexto}>{T.volumen.esta}</Text>
                </View>
                <View style={estilos.ejeHueco} />
              </View>
              <Text style={estilos.nota}>{series ? T.volumen.notaSeries : T.volumen.notaKilos}</Text>
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
                      g.filas.map((f) => (
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
  barras: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
    height: 34,
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#1d2230',
  },
  barra: { flex: 1, height: '100%', justifyContent: 'flex-end', paddingHorizontal: 1 },
  relleno: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: '#3d4556' },
  rellenoLeido: { backgroundColor: '#7e8ca8' },
  // La semana de hoy no terminó: contorno punteado, para que no parezca una caída.
  enCurso: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', borderColor: '#5a647a' },
  enCursoLeido: { backgroundColor: 'rgba(126,140,168,0.3)', borderWidth: 1, borderStyle: 'dashed', borderColor: '#7e8ca8' },
  eje: { flexDirection: 'row', gap: 10, marginTop: -4, marginBottom: 10 },
  ejeFechas: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  ejeTexto: { color: '#4a5163', fontSize: 11 },
  ejeHueco: { width: 58 },
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
