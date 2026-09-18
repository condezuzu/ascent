import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from './supabase';
import { DIAS_SEMANA_LARGO, deISO, fechaLinda, hoyISO } from '@nucleo/fechas';
import { duracionLinda } from '@nucleo/sesiones';
import { deKilos, pesoCorto, type Unidad } from '@nucleo/peso';
import type { ResumenDelDia } from '@nucleo/resumenDia';
import { claveDeEtiqueta, gruposDePesos, type Carga } from '@nucleo/carga';
import { disponible } from '@nucleo/esquema';
import { T } from '@nucleo/textos';
import { useVersionDelEsquema } from '@compartido/esquema';
import { cargarDia, corregirDia, destinoActual, queHacer, revisarCarga, type Destino } from '@compartido/dia';
import EtiquetaDeCarga from './EtiquetaDeCarga';
import Hoja from './Hoja';
import { C } from './colores';

/**
 * UN DÍA, ABIERTO: qué hiciste, y corregirlo si está mal. La misma hoja que la
 * web (`src/components/HojaDelDia.tsx`): lo que se pide y lo que hace
 * corregir viven en `compartido/dia.ts`, y acá solo se dibuja.
 *
 * MIRAR NO CAMBIA NADA: tocar un día abre esto, y corregir es un paso aparte
 * con las tres opciones a la vista. Y CORREGIR PUEDE BORRAR UNA SESIÓN —las
 * sesiones cuelgan del día—, así que se pregunta antes.
 */
export default function HojaDelDia({
  fecha,
  principal,
  alCambiar,
  alRevisar,
  alCerrar,
}: {
  fecha: string;
  /** El `--pal-principal` de la web: las barras de músculo. */
  principal: string;
  alCambiar: () => void;
  /** Se revisó el modo de un bloque viejo (migración 39). No es corregir el día. */
  alRevisar?: () => void;
  alCerrar: () => void;
}) {
  const [resumen, setResumen] = useState<ResumenDelDia | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [cuantasSesiones, setCuantasSesiones] = useState(0);
  const [porConfirmar, setPorConfirmar] = useState<Destino | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [unidad, setUnidad] = useState<Unidad>('kg');
  const versionEsquema = useVersionDelEsquema();
  const esFuturo = fecha > hoyISO();

  useEffect(() => {
    let vivo = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;
      const d = await cargarDia(supabase, uid, fecha, esFuturo);
      if (!vivo) return;
      setUnidad(d.unidad);
      setCuantasSesiones(d.cuantasSesiones);
      setResumen(d.resumen);
      setFoto(d.foto);
    })();
    return () => {
      vivo = false;
    };
  }, [fecha, esFuturo, version]);

  async function revisar(sesion: string, orden: number, carga: Carga) {
    setError('');
    const e = await revisarCarga(supabase, versionEsquema, sesion, orden, carga);
    if (e) return setError(e);
    setVersion((v) => v + 1);
    alRevisar?.();
  }

  const actual = destinoActual(resumen);

  async function corregir(destino: Destino, confirmado = false) {
    if (!resumen || ocupado) return;
    const paso = queHacer(destino, actual, cuantasSesiones, confirmado);
    if (paso === 'nada') return;
    if (paso === 'confirmar') return setPorConfirmar(destino);
    setPorConfirmar(null);
    setError('');
    setOcupado(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return setOcupado(false);
    const r = await corregirDia(supabase, uid, fecha, destino);
    if (r.error) setError(r.error);
    setOcupado(false);
    if (!r.cambio) return;
    setVersion((v) => v + 1);
    alCambiar();
  }

  const titulo = `${DIAS_SEMANA_LARGO[deISO(fecha).getDay()]} ${fechaLinda(fecha)}`;
  const maxSeries = resumen ? Math.max(1, ...resumen.volumen.map((x) => x.series)) : 1;

  return (
    <Hoja visible alCerrar={alCerrar}>
      <Text style={estilos.titulo}>{titulo}</Text>

      {/* Mientras carga, el lugar ya está: la hoja no crece de a saltos. */}
      {!resumen ? (
        <Text style={estilos.sub}>…</Text>
      ) : (
        <>
          <Text
            style={[
              estilos.estado,
              (resumen.estado === 'sin-registrar' || resumen.estado === 'futuro') && { color: C.apagado },
            ]}
          >
            {resumen.estado === 'entrenado'
              ? T.resumen.fuiste
              : resumen.estado === 'descanso'
                ? T.resumen.descanso
                : resumen.estado === 'futuro'
                  ? T.resumen.futuro
                  : T.resumen.sinRegistrar}
            {/* Duración y series en la misma línea que el estado: es lo que se
                busca primero, y en dos renglones se lee como dos datos. */}
            {resumen.duracionSegundos !== null && (
              <Text style={estilos.sub}> · {duracionLinda(resumen.duracionSegundos)}</Text>
            )}
            {resumen.series > 0 && <Text style={estilos.sub}> · {T.resumen.series(resumen.series)}</Text>}
          </Text>

          {resumen.enCurso && <Text style={estilos.nota}>{T.resumen.enCurso}</Text>}

          {resumen.ejercicios.length > 0 && (
            <View style={estilos.bloque}>
              {resumen.ejercicios.map((e) => (
                <View style={estilos.fila} key={e.id}>
                  <View style={{ flex: 1 }}>
                    <Text style={estilos.nombre}>{e.nombre}</Text>
                    {/* Los pesos, uno por serie y agrupados por modo: "60" y
                        "30 por mancuerna" no pueden ir en la misma lista. */}
                    {e.pesos && (
                      <Text style={estilos.pesos}>
                        {gruposDePesos(e.pesos, e.cargas)
                          .map((g) =>
                            T.resumen.pesosDeSeries(
                              g.pesos.map((p) => (p === null ? T.sesion.sinPeso : pesoCorto(p, unidad))).join(', '),
                              unidad,
                              claveDeEtiqueta(g.carga, e.id)
                            )
                          )
                          .join(' · ')}
                      </Text>
                    )}
                  </View>
                  <Text style={estilos.cuantas}>{T.resumen.series(e.series)}</Text>
                </View>
              ))}
              {resumen.sinEjercicio > 0 && (
                <View style={estilos.fila}>
                  <Text style={[estilos.nombre, { flex: 1, color: C.apagado }]}>{T.resumen.sinEjercicio}</Text>
                  <Text style={estilos.cuantas}>{T.resumen.series(resumen.sinEjercicio)}</Text>
                </View>
              )}
            </View>
          )}

          {/* Por músculo, solo si hay más de uno o hay kilos: con uno solo y sin
              pesos, las series ya están dichas arriba. */}
          {(resumen.volumen.length > 1 || resumen.volumen.some((v) => v.kilos > 0)) && (
            <View style={estilos.bloque}>
              <Text style={estilos.rotulo}>{T.volumen.porMusculo}</Text>
              {resumen.volumen.map((v) => (
                <View style={estilos.filaMusculo} key={v.grupo}>
                  <Text style={[estilos.nombre, estilos.musculo]}>{v.grupo}</Text>
                  <View style={estilos.barra}>
                    <View
                      style={{
                        width: `${(v.series / maxSeries) * 100}%`,
                        height: '100%',
                        backgroundColor: principal,
                        borderTopRightRadius: 4,
                        borderBottomRightRadius: 4,
                      }}
                    />
                  </View>
                  <Text style={estilos.cuantas}>
                    {v.kilos > 0
                      ? T.volumen.kilosYSeries(Math.round(deKilos(v.kilos, unidad)).toLocaleString('es-UY'), unidad, v.series)
                      : T.volumen.soloSeries(v.series)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Los pesos de antes de los modos (migración 39): uno por bloque, se
              elige qué significaba el número, o "está bien así". */}
          {resumen.porRevisar.length > 0 && disponible('revisarCargas', versionEsquema) && (
            <View style={estilos.bloque}>
              <Text style={estilos.rotulo}>{T.volumen.revisarTitulo}</Text>
              <Text style={estilos.nota}>{T.volumen.revisarNota}</Text>
              {resumen.porRevisar.map((b) => (
                <View style={estilos.filaRevisar} key={`${b.sesion}:${b.orden}`}>
                  <View style={{ flexShrink: 1 }}>
                    <Text style={estilos.nombre}>{b.nombre}</Text>
                    <Text style={estilos.pesos}>
                      {b.pesos.map((p) => (p === null ? T.sesion.sinPeso : pesoCorto(p, unidad))).join(', ')} {unidad}
                    </Text>
                  </View>
                  <View style={estilos.acciones}>
                    <EtiquetaDeCarga carga={b.carga} ejercicio={b.ejercicio} alElegir={(c) => revisar(b.sesion, b.orden, c)} />
                    <Pressable hitSlop={8} onPress={() => revisar(b.sesion, b.orden, b.carga)}>
                      <Text style={estilos.botonTexto}>{T.volumen.estaBien}</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          {resumen.estado === 'entrenado' && cuantasSesiones === 0 && (
            <Text style={estilos.nota}>
              {resumen.origen === 'ubicacion'
                ? T.resumen.porUbicacion
                : resumen.origen === 'salud'
                  ? T.resumen.porSalud
                  : T.resumen.sinSesion}
            </Text>
          )}

          {foto && <Image source={{ uri: foto }} style={estilos.foto} resizeMode="cover" accessibilityIgnoresInvertColors />}

          {resumen.estado !== 'futuro' && (
            <View style={{ marginTop: 8 }}>
              <Text style={estilos.rotulo}>{T.resumen.corregir}</Text>
              <View style={estilos.selector}>
                {(['fui', 'descanso', 'nada'] as Destino[]).map((d) => (
                  <Pressable
                    key={d}
                    disabled={ocupado}
                    onPress={() => corregir(d)}
                    style={[estilos.opcion, actual === d && estilos.opcionActiva]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: actual === d }}
                  >
                    <Text style={[estilos.opcionTexto, actual === d && estilos.opcionTextoActivo]}>
                      {d === 'fui' ? T.resumen.marcarFui : d === 'descanso' ? T.resumen.marcarDescanso : T.resumen.marcarNada}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {porConfirmar && (
                <View style={estilos.confirmar}>
                  <Text style={estilos.sub}>{T.resumen.borraSesion}</Text>
                  <Pressable hitSlop={8} onPress={() => corregir(porConfirmar, true)}>
                    <Text style={[estilos.botonTexto, { color: C.error }]}>{T.resumen.siCambiar}</Text>
                  </Pressable>
                  <Pressable hitSlop={8} onPress={() => setPorConfirmar(null)}>
                    <Text style={estilos.botonTexto}>{T.album.no}</Text>
                  </Pressable>
                </View>
              )}
              {!!error && <Text style={estilos.error}>{error}</Text>}
            </View>
          )}
        </>
      )}

      <Pressable hitSlop={8} onPress={alCerrar} style={{ marginTop: 18 }}>
        <Text style={estilos.botonTexto}>{T.general.cerrar}</Text>
      </Pressable>
    </Hoja>
  );
}

const estilos = StyleSheet.create({
  titulo: { color: C.tinta, fontSize: 20, marginBottom: 14 },
  estado: { color: C.tinta, fontSize: 15, marginBottom: 16 },
  sub: { color: C.sub, fontSize: 13 },
  nota: { color: C.apagado, fontSize: 12, lineHeight: 17, marginBottom: 12 },
  bloque: { marginBottom: 14 },
  rotulo: { color: C.apagado, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  nombre: { color: C.tinta, fontSize: 14 },
  pesos: { color: C.apagado, fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] },
  cuantas: { color: C.sub, fontSize: 13, fontVariant: ['tabular-nums'] },
  filaMusculo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  musculo: { width: 84, textTransform: 'capitalize' },
  barra: { flex: 1, height: 6 },
  filaRevisar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: C.linea,
  },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  foto: { width: '100%', aspectRatio: 1, maxHeight: 360, marginTop: 4, marginBottom: 18, borderRadius: 4 },
  selector: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  opcion: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
  },
  opcionActiva: { borderColor: C.sub },
  opcionTexto: { color: C.sub, fontSize: 14 },
  opcionTextoActivo: { color: C.tinta },
  confirmar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 8 },
  botonTexto: { color: C.claro, fontSize: 14 },
  error: { color: C.error, fontSize: 13 },
});
