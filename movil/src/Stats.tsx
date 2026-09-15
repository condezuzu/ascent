import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from './supabase';
import { aISO, deISO, fechaLinda, hoyISO, restarDias } from '@nucleo/fechas';
import { deKilos, pesoCorto, type Unidad } from '@nucleo/peso';
import { claveDeEtiqueta } from '@nucleo/carga';
import { umbralValido } from '@nucleo/estancamiento';
import {
  gruposAnotados,
  gruposDejados,
  maximosPorEjercicio,
  semanaParaLeer,
  sesionesConFecha,
  volumenPorSemana,
  type Catalogo,
  type SesionConBloques,
} from '@nucleo/volumen';
import type { Log } from '@nucleo/tipos';
import { T } from '@nucleo/textos';

const SEMANAS = 8;
const MAXIMOS_A_LA_VISTA = 6;

type Datos = {
  racha: number;
  mejor: number;
  unidad: Unidad;
  umbral: number;
  logs: Log[];
  sesiones: SesionConBloques[];
  catalogo: Catalogo;
};

/**
 * STATS EN NATIVO: los números de siempre y qué venís haciendo.
 *
 * LAS CUENTAS NO ESTÁN ACÁ. El volumen por semana, el máximo de cada ejercicio
 * y dónde no estás entrenando salen de `nucleo/volumen.ts`, los mismos que usa
 * la web: esta pantalla pide las filas y dibuja. Si un número difiriera entre
 * el teléfono y la computadora, sería por el dibujo, nunca por la cuenta.
 *
 * LO QUE TODAVÍA NO ESTÁ, y entra con su propia pantalla: el calendario con el
 * resumen de cada día (y ahí, revisar los pesos de antes de los modos), el
 * mapa del año, el peso corporal, la fuerza y las sesiones. Mientras tanto
 * esos se miran en la web; nada de acá los reemplaza a medias.
 */
export default function Stats({ alSalir }: { alSalir: () => void }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState('');
  const [pestana, setPestana] = useState<'general' | 'entrenamiento'>('general');
  const [grupo, setGrupo] = useState<string | null>(null);
  const [enSeries, setEnSeries] = useState(false);
  const [tocada, setTocada] = useState<number | null>(null);
  const [todos, setTodos] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    const { data: sesion } = await supabase.auth.getSession();
    const uid = sesion.session?.user?.id;
    if (!uid) return alSalir();
    const [{ data: perfil }, { data: logs }, { data: ses }, { data: cat }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('logs').select('*').eq('user_id', uid).order('fecha'),
      supabase.from('sesiones').select('id, bloques, logs(fecha)').eq('user_id', uid),
      supabase.from('ejercicios').select('id, nombre, grupo'),
    ]);
    if (!perfil) return setError(T.general.noSePudo);
    setDatos({
      racha: perfil.racha_actual ?? 0,
      mejor: perfil.mejor_racha ?? 0,
      unidad: perfil.unidad_peso === 'lb' ? 'lb' : 'kg',
      umbral: umbralValido(perfil.umbral_estancamiento),
      logs: (logs ?? []) as Log[],
      sesiones: sesionesConFecha(ses),
      catalogo: new Map((cat ?? []).map((e) => [e.id as string, { nombre: e.nombre as string, grupo: e.grupo as string }])),
    });
  }, [alSalir]);

  useEffect(() => {
    cargar();
  }, [cargar]);

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

  const { racha, mejor, unidad, umbral, logs, sesiones, catalogo } = datos;
  const hoy = hoyISO();
  const entrenados = logs.filter((l) => !l.es_descanso);
  // Las mismas dos cuentas que la web: los últimos 30 días contando hoy, y el
  // mes calendario.
  const en30 = entrenados.filter((l) => l.fecha >= restarDias(hoy, 29)).length;
  const d = deISO(hoy);
  const esteMes = entrenados.filter((l) => l.fecha >= aISO(new Date(d.getFullYear(), d.getMonth(), 1))).length;

  const semanas = volumenPorSemana(sesiones, catalogo, { hoy, semanas: SEMANAS, grupo });
  const hayKilos = semanas.some((s) => s.kilos > 0);
  const series = enSeries || !hayKilos;
  const valor = (s: (typeof semanas)[number]) => (series ? s.series : s.kilos);
  const tope = Math.max(...semanas.map(valor), 0);
  const grupos = gruposAnotados(sesiones, catalogo);
  const indice = semanaParaLeer(semanas, tocada);
  const leida = semanas[indice];
  const maximos = maximosPorEjercicio(sesiones, catalogo);
  const dejados = gruposDejados(sesiones, catalogo, { hoy, semanas: umbral });
  const kilosLindos = (kg: number) => Math.round(deKilos(kg, unidad)).toLocaleString(T.general.locale);
  const mayuscula = (g: string) => g.charAt(0).toUpperCase() + g.slice(1);

  return (
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

      {pestana === 'entrenamiento' && (
        <>
          <Text style={estilos.seccion}>{T.volumen.semanas}</Text>
          {grupos.length === 0 ? (
            <Text style={estilos.nota}>{T.volumen.vacio}</Text>
          ) : (
            <>
              <View style={estilos.filtros}>
                {[null, ...grupos].map((g) => (
                  <Pressable
                    key={g ?? 'todo'}
                    style={[estilos.pastilla, grupo === g && estilos.pastillaPrendida]}
                    onPress={() => setGrupo(g)}
                  >
                    <Text style={[estilos.pastillaTexto, grupo === g && estilos.opcionTextoActivo]}>
                      {g === null ? T.volumen.todo : mayuscula(g)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Barras de alto proporcional, las vacías en su lugar. */}
              <View style={estilos.barras}>
                {semanas.map((s, i) => (
                  <Pressable key={s.desde} style={estilos.barra} onPress={() => setTocada(i)}>
                    <View
                      style={[
                        estilos.relleno,
                        i === indice && estilos.rellenoLeido,
                        { height: `${tope > 0 ? (valor(s) / tope) * 100 : 0}%` },
                      ]}
                    />
                  </Pressable>
                ))}
              </View>

              <View style={estilos.lectura}>
                <Text style={estilos.cuando}>{T.volumen.semanaDel(fechaLinda(leida.desde))}</Text>
                <Text style={estilos.cuanto}>
                  {leida.series === 0
                    ? T.volumen.semanaVacia
                    : series
                      ? T.volumen.soloSeries(leida.series)
                      : T.volumen.kilosYSeries(kilosLindos(leida.kilos), unidad, leida.series)}
                </Text>
              </View>

              {hayKilos && (
                <View style={estilos.selector}>
                  {([false, true] as const).map((s) => (
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
              <Text style={estilos.nota}>{T.volumen.nota}</Text>
            </>
          )}

          {dejados.length > 0 && (
            <>
              <Text style={estilos.seccion}>{T.volumen.dejados}</Text>
              {dejados.map((x) => (
                <Text key={x.grupo} style={estilos.dejado}>
                  {T.volumen.dejado(x.grupo, x.semanas, fechaLinda(x.ultima))}
                </Text>
              ))}
            </>
          )}

          {maximos.length > 0 && (
            <>
              <Text style={estilos.seccion}>{T.volumen.maximos}</Text>
              {(todos ? maximos : maximos.slice(0, MAXIMOS_A_LA_VISTA)).map((m) => (
                <View key={m.ejercicio} style={estilos.fila}>
                  <View style={estilos.filaNombre}>
                    <Text style={estilos.nombre}>{m.nombre}</Text>
                    <Text style={estilos.fecha}>{fechaLinda(m.fecha)}</Text>
                  </View>
                  <Text style={estilos.peso}>
                    {T.resumen.pesosDeSeries(pesoCorto(m.peso, unidad), unidad, claveDeEtiqueta(m.carga, m.ejercicio))}
                  </Text>
                </View>
              ))}
              {maximos.length > MAXIMOS_A_LA_VISTA && (
                <Pressable onPress={() => setTodos((x) => !x)} style={estilos.verTodos}>
                  <Text style={estilos.enlace}>
                    {todos ? T.volumen.verMenos : T.volumen.verTodos(maximos.length)}
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flexGrow: 1, backgroundColor: '#05060a', padding: 24, paddingTop: 64, paddingBottom: 40 },
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

  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  pastilla: { borderWidth: 1, borderColor: '#1d2230', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  pastillaPrendida: { borderColor: '#8a93a8' },
  pastillaTexto: { color: '#4a5163', fontSize: 12 },

  barras: { flexDirection: 'row', gap: 6, height: 120, alignItems: 'flex-end' },
  barra: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#1d2230',
  },
  relleno: { width: '100%', borderTopLeftRadius: 2, borderTopRightRadius: 2, backgroundColor: '#3d4556' },
  rellenoLeido: { backgroundColor: '#7e8ca8' },

  lectura: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6, marginVertical: 12 },
  cuando: { color: '#8a93a8', fontSize: 13 },
  cuanto: { color: '#e8ecf6', fontSize: 13 },

  dejado: { color: '#8a93a8', fontSize: 14, lineHeight: 20, marginBottom: 6 },

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
  verTodos: { paddingVertical: 12, alignItems: 'center' },

  error: { color: '#e8705f', fontSize: 13, textAlign: 'center' },
  enlace: { color: '#8a93a8', fontSize: 13 },
});
