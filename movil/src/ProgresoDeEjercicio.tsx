import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { claveDeEtiqueta } from '@nucleo/carga';
import { fechaLinda, hoyISO } from '@nucleo/fechas';
import { pesoCorto, type Unidad } from '@nucleo/peso';
import {
  cambioDeProgreso,
  progresoPorEjercicio,
  rangosDeProgreso,
  trazarProgreso,
  ventanaDeProgreso,
} from '@nucleo/progreso';
import { cuerpoDe } from '@nucleo/rangos';
import { T } from '@nucleo/textos';
import { sesionesConFecha, type MarcaParaMaximo } from '@nucleo/volumen';
import { quienSoy } from '@compartido/quienSoy';
import { C, conAlfa, conTema, luz } from './colores';
import { useTema } from './useTema';
import { CifraJunta, Text } from './Texto';
import { L } from './fuentes';
import FondoEspacial from './FondoEspacial';
import { MS, sinMovimiento } from './movimiento';
import { EjeDeTiempo, PuntoConAro, PuntoElegido, TrazoQueSeDibuja, leerConVoiceOver, useAparicion, useLectura } from './PiezasDeGrafico';
import { tomarProgreso, type DatosDeProgreso } from './progresoPrecargado';
import { supabase } from './supabase';
import Tocable from './Tocable';
import { volverOInicio } from './volver';
import { useArriba } from './zonaSegura';

/**
 * EL PROGRESO DE UN EJERCICIO (propuesta 13 de la galería, aprobada el 1/11): una línea con el
 * peso máximo de cada sesión. Se entra tocando una fila de los máximos, en Stats → Entrenamiento.
 * Las cuentas y sus porqués están en `nucleo/progreso.ts`.
 */

const ETIQUETA_DE_RANGO = (d: number | null) => (d === 30 ? T.stats.pesoMes : d === 90 ? T.stats.pesoTresMeses : T.stats.pesoTodo);

/** El número viaja desde la primera sesión hasta la última, de a medio kilo. */
function useCifraQueViaja(desde: number, hasta: number, clave: unknown) {
  const [valor, setValor] = useState(desde);
  useEffect(() => {
    let vivo = true;
    let cuadro = 0;
    void sinMovimiento().then((quieto) => {
      if (!vivo) return;
      if (quieto || desde === hasta) return setValor(hasta);
      const inicio = Date.now();
      const paso = () => {
        if (!vivo) return;
        const t = Math.min(1, (Date.now() - inicio) / MS.trazo);
        setValor(t < 1 ? Math.round((desde + (hasta - desde) * (1 - (1 - t) ** 3)) * 2) / 2 : hasta);
        if (t < 1) cuadro = requestAnimationFrame(paso);
      };
      cuadro = requestAnimationFrame(paso);
    });
    return () => {
      vivo = false;
      cancelAnimationFrame(cuadro);
    };
    // Solo al abrir o al cambiar de rango: lo que se toca después no cuenta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  return valor;
}

export default function ProgresoDeEjercicio({ ejercicio }: { ejercicio: string }) {
  useTema();
  const router = useRouter();
  const arriba = useArriba(16);
  const [datos, setDatos] = useState<DatosDeProgreso | null>(() => tomarProgreso(ejercicio));
  const [noCargo, setNoCargo] = useState(false);

  const cargar = useCallback(async () => {
    setNoCargo(false);
    const yo = await quienSoy(supabase);
    if (yo.estado === 'sin') return volverOInicio(router);
    if (yo.estado === 'no-se') return setNoCargo(true);
    const [{ data: perfil }, { data: ses }, { data: prs }, { data: fila }] = await Promise.all([
      supabase.from('profiles').select('racha_actual, unidad_peso').eq('id', yo.uid).single(),
      supabase.from('sesiones').select('id, bloques, logs(fecha)').eq('user_id', yo.uid),
      supabase.from('prs').select('ejercicio, peso, reps, fecha').eq('user_id', yo.uid).eq('ejercicio', ejercicio),
      supabase.from('ejercicios').select('nombre').eq('id', ejercicio).maybeSingle(),
    ]);
    if (!perfil || !fila) return setNoCargo(true);
    const progreso = progresoPorEjercicio(sesionesConFecha(ses), (prs ?? []) as MarcaParaMaximo[]).get(ejercicio) ?? { sesiones: [], marcas: [] };
    setDatos({
      ejercicio,
      nombre: fila.nombre as string,
      progreso,
      unidad: perfil.unidad_peso === 'lb' ? 'lb' : 'kg',
      ...cuerpoDe(perfil.racha_actual),
    });
  }, [ejercicio, router]);

  useEffect(() => {
    if (!datos) void cargar();
  }, [datos, cargar]);

  const volver = (
    <Tocable onPress={() => volverOInicio(router)} hitSlop={10} style={estilos.volverCaja}>
      <Text style={estilos.volver}>{T.general.volver}</Text>
    </Tocable>
  );

  if (!datos) {
    return (
      <View style={[estilos.raiz, estilos.contenido, { paddingTop: arriba }]}>
        {volver}
        {noCargo ? (
          <Tocable onPress={cargar} style={estilos.reintentar}>
            <Text style={estilos.nota}>{T.inicio.noCargo}</Text>
            <Text style={estilos.enlace}>{T.inicio.reintentar}</Text>
          </Tocable>
        ) : (
          <ActivityIndicator color={C.sub} style={estilos.reintentar} />
        )}
      </View>
    );
  }

  return (
    <View style={estilos.raiz}>
      <FondoEspacial rango={datos.rango} planeta={datos.planeta} esquina="arriba-derecha" velo={0.74} />
      <ScrollView contentContainerStyle={[estilos.contenido, { paddingTop: arriba }]}>
        {volver}
        <Lectura datos={datos} />
      </ScrollView>
    </View>
  );
}

function Lectura({ datos }: { datos: DatosDeProgreso }) {
  useTema();
  const { ejercicio, progreso, unidad } = datos;
  const { height } = useWindowDimensions();
  const hoy = hoyISO();
  const [rango, setRango] = useState<number | null>(null);
  const [elegido, setElegido] = useState<number | null>(null);
  const [ancho, setAncho] = useState(0);
  // Lo de arriba y lo de abajo ocupan unos 390 px, y el gráfico se queda con el resto.
  const alto = Math.max(220, Math.min(480, height - 390));

  const enVentana = useMemo(() => ventanaDeProgreso(progreso, rango, hoy), [progreso, rango, hoy]);
  const trazo = useMemo(() => (ancho > 0 ? trazarProgreso(enVentana, ancho, alto) : null), [enVentana, ancho, alto]);
  const rangos = useMemo(() => rangosDeProgreso(progreso, hoy), [progreso, hoy]);
  const xs = useMemo(() => trazo?.puntos.map((p) => p.x) ?? [], [trazo]);
  const lectura = useLectura(xs, elegido, setElegido);

  const sesiones = enVentana.sesiones;
  const ultimo = sesiones.length ? sesiones[sesiones.length - 1] : enVentana.marcas[enVentana.marcas.length - 1];
  const clave = `${ejercicio}-${rango}`;
  const viajando = useCifraQueViaja(sesiones.length > 1 ? sesiones[0].peso : (ultimo?.peso ?? 0), ultimo?.peso ?? 0, clave);
  const nombre = <Text testID="progreso-nombre" style={estilos.titulo}>{datos.nombre}</Text>;
  if (!ultimo) {
    return (
      <>
        {nombre}
        <Text style={estilos.nota}>{T.volumen.nada}</Text>
      </>
    );
  }

  const punto = elegido !== null && trazo ? trazo.puntos[elegido] : null;
  const leido = punto ?? ultimo;
  const cifra = pesoCorto(punto ? punto.peso : viajando, unidad);
  const etiqueta = T.resumen.pesosDeSeries('', unidad, claveDeEtiqueta(leido.carga, ejercicio)).trim();
  const cuando = `${leido.reps ? `${T.progreso.reps(leido.reps)} · ` : ''}${fechaLinda(leido.fecha)}`;

  let cambio = '';
  if (punto) cambio = punto.tipo === 'marca' ? T.progreso.marca : '';
  else if (sesiones.length > 1) {
    const d = cambioDeProgreso(sesiones[0], sesiones[sesiones.length - 1]);
    // Con signo, siempre: sin él, «2,5» no dice si subiste o bajaste.
    cambio = T.progreso.cambio(sesiones.length, `${d >= 0 ? '+' : '−'}${pesoCorto(Math.abs(d), unidad)}`, unidad);
  } else cambio = sesiones.length === 1 ? T.progreso.sesiones(1) : T.progreso.marca;

  return (
    // Tocar afuera suelta lo elegido. Solo cuando hay algo elegido: si no, este toque es del scroll.
    <View style={estilos.lectura} onStartShouldSetResponder={() => elegido !== null} onResponderRelease={() => setElegido(null)}>
      {nombre}
      <View style={estilos.numero}>
        <Text testID="progreso-cifra" style={estilos.cifra}>
          <CifraJunta texto={cifra} apretar={-11} />
        </Text>
        <Text testID="progreso-unidad" style={estilos.unidad}>{etiqueta}</Text>
      </View>
      <View style={estilos.pie}>
        <Text testID="progreso-cuando" style={estilos.cuando}>{cuando}</Text>
        <Text testID="progreso-cambio" style={estilos.cambio}>{cambio}</Text>
      </View>

      <View
        testID="progreso-lienzo"
        style={[estilos.lienzo, { height: alto }]}
        onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
        {...lectura}
        accessible
        accessibilityLabel={T.progreso.grafico(datos.nombre)}
        accessibilityHint={T.progreso.leer}
        accessibilityValue={{ text: `${cuando}: ${cifra} ${etiqueta}` }}
        {...leerConVoiceOver(xs.length, elegido, setElegido)}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {trazo && <Dibujo trazo={trazo} ancho={ancho} alto={alto} clave={clave} unidad={unidad} />}
          {punto && <PuntoElegido x={punto.x} y={punto.y} alto={trazo?.base ?? alto} ancho={ancho} color={C.claro} hueco={punto.tipo === 'marca'} />}
        </View>
      </View>
      <View style={estilos.ejeSube}>
        <EjeDeTiempo marcas={trazo?.tiempo ?? []} />
      </View>

      {rangos.length > 0 && (
        <View style={estilos.rangos}>
          {rangos.map((d) => {
            const activo = d === rango;
            return (
              <Tocable
                key={String(d)}
                testID={`progreso-rango-${d ?? 'todo'}`}
                hitSlop={8}
                onPress={() => {
                  setRango(d);
                  setElegido(null);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: activo }}
              >
                <Text style={[estilos.rango, activo && estilos.rangoActivo]}>{ETIQUETA_DE_RANGO(d)}</Text>
              </Tocable>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** Todo menos lo elegido: arrastrar el dedo no vuelve a dibujar esto. */
function Dibujo({ trazo, ancho, alto, clave, unidad }: { trazo: NonNullable<ReturnType<typeof trazarProgreso>>; ancho: number; alto: number; clave: string; unidad: Unidad }) {
  useTema();
  const aparece = useAparicion(clave);
  const entranPuntos = aparece.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 0, 1] });
  const { sesiones, marcas, record, primero, base } = trazo;
  const ultima = sesiones[sesiones.length - 1];
  const hayLinea = sesiones.length > 1;
  const anclar = (x: number) =>
    x > ancho - 34 ? { left: x - 60, textAlign: 'right' as const } : x < 22 ? { left: x, textAlign: 'left' as const } : { left: x - 30, textAlign: 'center' as const };
  return (
    <>
      <Svg width={ancho} height={alto} style={StyleSheet.absoluteFill}>
        <Line x1={0} y1={base} x2={ancho} y2={base} stroke={C.lineaFuerte} strokeWidth={1} />
        {hayLinea && record && <Line x1={0} y1={record.y} x2={ancho} y2={record.y} stroke={C.lineaFuerte} strokeWidth={1} strokeDasharray="3 4" />}
        {trazo.fantasma !== '' && <Path d={trazo.fantasma} fill="none" stroke={C.lineaFuerte} strokeWidth={1.2} strokeDasharray="4 5" />}
      </Svg>
      {hayLinea && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: aparece }]}>
          <Svg width={ancho} height={alto}>
            <Defs>
              <LinearGradient id="progreso-relleno" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={C.claro} stopOpacity={0.18} />
                <Stop offset="1" stopColor={C.claro} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={trazo.area} fill="url(#progreso-relleno)" />
          </Svg>
        </Animated.View>
      )}
      {hayLinea && (
        <View testID="progreso-linea" style={StyleSheet.absoluteFill}>
          <Svg width={ancho} height={alto}>
            <TrazoQueSeDibuja key={clave} d={trazo.linea} color={C.claro} largo={trazo.largo} />
          </Svg>
        </View>
      )}
      <Animated.View testID="progreso-puntos" style={[StyleSheet.absoluteFill, { opacity: hayLinea ? entranPuntos : 1 }]}>
        <Svg width={ancho} height={alto}>
          {hayLinea && sesiones.slice(0, -1).map((s) => <Circle key={s.fecha} cx={s.x} cy={s.y} r={1.8} fill={C.claro} opacity={0.6} />)}
          {hayLinea && record?.tipo === 'sesion' && <Circle cx={record.x} cy={record.y} r={6.5} fill="none" stroke={C.claro} strokeWidth={1} opacity={0.5} />}
        </Svg>
        {hayLinea && record?.tipo === 'sesion' && <View style={[estilos.brillo, { left: record.x, top: record.y }, luz(C.claro, 0.9, 5)]} />}
        {ultima && <PuntoConAro testID="progreso-ultima" x={ultima.x} y={ultima.y} color={C.claro} aro={conAlfa(C.fondo, 0.65)} />}
        {marcas.map((m) => (
          <View key={m.fecha} testID="progreso-marca" style={[estilos.hueco, { left: m.x, top: m.y }]} />
        ))}
        {record && (
          <Text testID="progreso-record" style={[estilos.rotulo, estilos.rotuloRecord, anclar(record.x), { top: record.y - 24 }]}>
            {pesoCorto(record.peso, unidad)}
          </Text>
        )}
        {primero && <Text testID="progreso-primero" style={[estilos.rotulo, anclar(primero.x), { top: primero.y + 7 }]}>{pesoCorto(primero.peso, unidad)}</Text>}
      </Animated.View>
    </>
  );
}

const estilos = conTema(() => StyleSheet.create({
  // Transparente: detrás está el motor.
  raiz: { flex: 1 },
  contenido: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  lectura: { flexGrow: 1 },
  volverCaja: { alignSelf: 'flex-start' },
  volver: { color: C.sub, fontSize: 15, paddingVertical: 6 },
  reintentar: { marginTop: 40, gap: 8 },
  nota: { color: C.apagado, fontSize: 13 },
  enlace: { color: C.sub, fontSize: 13 },
  titulo: { color: C.tinta, fontSize: 26, fontWeight: '300', lineHeight: 31, marginTop: 10, marginBottom: 18 },
  cifra: { color: C.claro, fontSize: 46, fontWeight: '300', fontFamily: L.dato, letterSpacing: -1.4, lineHeight: 54, textShadowColor: conAlfa(C.claro, 0.26), textShadowRadius: 17, textShadowOffset: { width: 0, height: 0 } },
  numero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6 },
  unidad: { color: C.sub, fontSize: 14 },
  pie: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', columnGap: 12, rowGap: 4, marginTop: 4, minHeight: 18 },
  cuando: { color: C.sub, fontSize: 12, fontFamily: L.dato },
  cambio: { color: C.apagado, fontSize: 11, letterSpacing: 0.4, fontFamily: L.dato },
  lienzo: { marginTop: 16 },
  // Los rótulos del tiempo caen en el margen de abajo del dibujo, no debajo de él.
  ejeSube: { marginTop: -26 },
  rangos: { flexDirection: 'row', gap: 14, marginTop: 16 },
  rango: { color: C.apagado, fontSize: 12, paddingVertical: 4 },
  rangoActivo: { color: C.claro, borderBottomWidth: 1, borderColor: conAlfa(C.claro, 0.45) },
  brillo: { position: 'absolute', width: 6, height: 6, marginLeft: -3, marginTop: -3, borderRadius: 3, backgroundColor: C.claro },
  hueco: { position: 'absolute', width: 10, height: 10, marginLeft: -5, marginTop: -5, borderRadius: 5, borderWidth: 1.4, borderColor: C.claro, backgroundColor: C.fondo },
  rotulo: { position: 'absolute', width: 60, color: C.apagado, fontSize: 10.5, fontFamily: L.dato },
  rotuloRecord: { color: C.claro, fontSize: 11.5 },
}));
