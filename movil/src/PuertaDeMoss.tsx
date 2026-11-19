import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { plataforma } from '@plataforma';
import { useEnVuelo } from '@compartido/useEnVuelo';
import { estaVinculada, resultadoDelCodigo } from '@nucleo/vinculoConMoss';
import { supabase } from './supabase';
import SeccionMoss from './SeccionMoss';
import TutorialMoss from './TutorialMoss';
import { useSeccionMoss } from './useSeccionMoss';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { T } from '@nucleo/textos';
import { MOSS } from './coloresDeMoss';
import { taparElFondo } from './desenfoqueDelFondo';
import { cargarFuentesDeMoss, LETRAS_DE_MOSS } from './fuentes';
import { LLEGA, SE_VA, sinMovimiento } from './movimiento';
import { Text } from './Texto';
import Tocable from './Tocable';

/** Cuánto hay que tirar para abajo, desde el tope de Stats, para entrar. */
export const TIRON_PARA_ENTRAR = 96;
const ENTRA_MS = 720;
const SALE_MS = 420;

/** La estrella de cuatro puntas del ícono de Moss: puntas finas, la vertical un poco más larga. */
function caminoDeEstrella(r: number) {
  const h = r * 0.86;
  const a = r * 0.06;
  const b = r * 0.18;
  return `M0,${-r} C${a},${-b} ${b},${-a} ${h},0 C${b},${a} ${a},${b} 0,${r} C${-a},${b} ${-b},${a} ${-h},0 C${-b},${-a} ${-a},${-b} 0,${-r} Z`;
}

/**
 * EL LOGO DE MOSS (5/11, a pedido: «más parecido al ícono»): la estrella con el centro casi blanco y su brillo,
 * adentro de la órbita inclinada con sus dos puntos. Los degradados llevan id propio: hay dos logos a la vez.
 */
function LogoDeMoss({ tam }: { tam: number }) {
  const id = 'moss' + useId().replace(/:/g, '');
  const r = tam * 0.34;
  // El brillo se apaga antes del borde del dibujo: cortado por el borde se veía un cuadrado.
  const brillo = tam * 0.48;
  return (
    <Svg width={tam} height={tam} viewBox={`${-tam / 2} ${-tam / 2} ${tam} ${tam}`}>
      <Defs>
        <RadialGradient id={`${id}b`} cx={0} cy={0} r={brillo} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={MOSS.oroClaro} stopOpacity={0.55} />
          <Stop offset="0.45" stopColor={MOSS.oro} stopOpacity={0.14} />
          <Stop offset="1" stopColor={MOSS.oro} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`${id}o`} cx={0} cy={0} r={r} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={MOSS.oroCentro} />
          <Stop offset="0.35" stopColor={MOSS.oroClaro} />
          <Stop offset="1" stopColor={MOSS.oroHondo} />
        </RadialGradient>
      </Defs>
      <Circle r={brillo} fill={`url(#${id}b)`} />
      <G transform="rotate(-22)">
        <Ellipse rx={tam * 0.44} ry={tam * 0.14} fill="none" stroke={MOSS.oro} strokeOpacity={0.75} strokeWidth={Math.max(0.8, tam / 140)} />
        <Circle cx={-tam * 0.414} cy={-tam * 0.048} r={Math.max(1.2, tam * 0.022)} fill={MOSS.oroClaro} />
        <Circle cx={tam * 0.414} cy={tam * 0.048} r={Math.max(1.2, tam * 0.022)} fill={MOSS.oroClaro} />
      </G>
      <Path d={caminoDeEstrella(r)} fill={`url(#${id}o)`} />
    </Svg>
  );
}

// El cielo de atrás: puntos y algunos destellos, más tupido arriba. Sale de una semilla: siempre es el mismo.
function estrellasDelCielo(ancho: number, alto: number) {
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) - 1) / 2147483646;
  const puntos = Array.from({ length: 110 }, () => ({
    y: Math.pow(azar(), 1.5) * alto * 0.9,
    x: azar() * ancho,
    r: 0.35 + azar() * 0.85,
    oro: azar() < 0.25,
    op: 0.15 + azar() * 0.6,
  }));
  const destellos: [number, number, number, number][] = [[0.09, 0.08, 4.5, 0.8], [0.9, 0.065, 3.5, 0.7], [0.82, 0.2, 5, 0.55], [0.15, 0.25, 3, 0.6], [0.95, 0.36, 3.2, 0.5], [0.06, 0.5, 3.5, 0.45], [0.92, 0.66, 4, 0.35]];
  return { puntos, destellos: destellos.map(([x, y, r, op]) => ({ x: x * ancho, y: y * alto, r, op })) };
}

/**
 * EL CIELO DE MOSS (2/11, a pedido): lo que hay del otro lado de Stats. Desde el 18/11, en vez de «Pronto»,
 * «Vincula Ascent con Moss» (o «Vinculada con Moss»): `rotulo`. Con los colores y las letras de Moss (`src/tema.ts` de esa app), que no son los de Ascent: es
 * otro lugar, y tiene que notarse. El borde de abajo es un horizonte de oro, que es lo que se ve bajar.
 * Desde el 5/11 con su logo, estrellas y la aurora de su cielo.
 */
function CieloDeMoss({ avance, alto, rotulo = T.moss.vinculaTitulo, sinCentro = false }: { avance: Animated.Value | Animated.AnimatedInterpolation<number>; alto: number; rotulo?: string; /** Con los datos de Moss encima: solo el cielo. */ sinCentro?: boolean }) {
  const { width: ancho } = useWindowDimensions();
  const aparece = (avance as Animated.Value).interpolate({ inputRange: [0.25, 0.8], outputRange: [0, 1], extrapolate: 'clamp' });
  const cielo = useMemo(() => estrellasDelCielo(ancho, alto), [ancho, alto]);
  const id = 'aurora' + useId().replace(/:/g, '');
  return (
    <View style={[estilos.cielo, { height: alto }]}>
      <LinearGradient colors={[MOSS.noche0, MOSS.noche1, MOSS.noche2, MOSS.noche3]} locations={[0, 0.45, 0.82, 1]} style={StyleSheet.absoluteFill} />
      {/* El verde de Moss, abajo: un musgo que apenas se ve. */}
      <LinearGradient colors={['transparent', MOSS.musgoTenue]} locations={[0.68, 1]} style={StyleSheet.absoluteFill} />
      <Svg width={ancho} height={alto} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={MOSS.musgo} stopOpacity={0.3} />
            <Stop offset="1" stopColor={MOSS.musgo} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {/* La aurora: cortinas verdes que suben desde el musgo. */}
        {[[0.18, 70, 0.42], [0.5, 54, 0.3], [0.82, 76, 0.46]].map(([x, rx, ry]) => (
          <Ellipse key={x} cx={x * ancho} cy={alto} rx={rx} ry={ry * alto} fill={`url(#${id})`} />
        ))}
        {cielo.puntos.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.oro ? MOSS.oroClaro : MOSS.pergamino} opacity={p.op} />
        ))}
        {cielo.destellos.map((d, i) => (
          <Path key={'d' + i} d={caminoDeEstrella(d.r)} transform={`translate(${d.x} ${d.y})`} fill={MOSS.oroClaro} opacity={d.op} />
        ))}
      </Svg>
      {!sinCentro && (
        <Animated.View style={[estilos.centro, { opacity: aparece, transform: [{ translateY: aparece.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>
          <LogoDeMoss tam={190} />
          <Text style={estilos.nombre}>{T.moss.nombre}</Text>
          <Text testID="moss-rotulo" style={estilos.rotulo}>
            {rotulo}
          </Text>
        </Animated.View>
      )}
      {/* El horizonte que baja. */}
      <LinearGradient colors={['transparent', MOSS.oroBrillo]} style={estilos.brillo} />
      <View style={estilos.horizonte} />
    </View>
  );
}

/**
 * LA ENTRADA A MOSS, ARRIBA DE STATS (2/11, a pedido). Dos cosas la hacen obvia: la flecha que sube y
 * el renglón con las letras de Moss, y que al tirar para abajo su cielo ya asoma siguiendo al dedo. Pasado
 * `TIRON_PARA_ENTRAR` entra sola; tocarla también, y es lo que usa VoiceOver.
 *
 * `tiron` es cuánto se tiró, atado al desplazamiento de Stats por el motor nativo, sin pasar por JS.
 */
export default function PuertaDeMoss({ abierta, codigo = null, desde = 0, alAbrir, alCerrar }: { abierta: boolean; /** Llegó desde Moss con un código de un uso: «Vincular» lo canjea. */ codigo?: string | null; /** Cuánto se tiró antes de soltar: de ahí sigue bajando. */ desde?: number; alAbrir: () => void; alCerrar: () => void }) {
  const flecha = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    void cargarFuentesDeMoss();
    let vuelta: Animated.CompositeAnimation | null = null;
    let vivo = true;
    void sinMovimiento().then((quieto) => {
      if (!vivo || quieto) return;
      vuelta = Animated.loop(
        Animated.sequence([
          Animated.timing(flecha, { toValue: 1, duration: 900, easing: LLEGA, useNativeDriver: true, isInteraction: false }),
          Animated.timing(flecha, { toValue: 0, duration: 900, easing: SE_VA, useNativeDriver: true, isInteraction: false }),
          Animated.delay(1400),
        ]),
      );
      vuelta.start();
    });
    return () => {
      vivo = false;
      vuelta?.stop();
    };
  }, [flecha]);
  return (
    <>
      <Tocable testID="entrada-a-moss" style={estilos.entrada} onPress={alAbrir} accessibilityRole="button" accessibilityLabel={T.moss.nombre}>
        <Animated.View style={{ transform: [{ translateY: flecha.interpolate({ inputRange: [0, 1], outputRange: [2, -3] }) }] }}>
          <Svg width={18} height={10} viewBox="0 0 18 10">
            <Path d="M1 9l8-8 8 8" fill="none" stroke={MOSS.oro} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
        <LogoDeMoss tam={26} />
        <Text style={estilos.entradaNombre}>{T.moss.nombre}</Text>
      </Tocable>
      <PantallaDeMoss visible={abierta} codigo={codigo} desde={desde} alCerrar={alCerrar} />
    </>
  );
}

/** Lo que asoma al tirar: el mismo cielo, atado al dedo. No se toca. */
export function MossAsomando({ tiron }: { tiron: Animated.Value }) {
  const { height: alto } = useWindowDimensions();
  const avance = useMemo(() => tiron.interpolate({ inputRange: [0, alto], outputRange: [0, 1], extrapolate: 'clamp' }), [tiron, alto]);
  return (
    <Animated.View
      pointerEvents="none"
      testID="moss-asomando"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { transform: [{ translateY: tiron.interpolate({ inputRange: [0, alto], outputRange: [-alto, 0], extrapolate: 'clamp' }) }] }]}
    >
      <CieloDeMoss avance={avance} alto={alto} />
    </Animated.View>
  );
}

const TUTORIAL_VISTO = 'ascent:moss-tutorial-visto';

// moss://vincular abre Moss en su hoja de vincular con Ascent; si no está instalada, el teléfono no la
// abre y se va a la App Store.
const ABRIR_MOSS = 'moss://vincular';
const CONSEGUIR_MOSS = 'https://apps.apple.com/app/id6828034537';

/**
 * VINCULAR CON MOSS (18/11). Sin el llavero compartido —llega con una build— Ascent no tiene la sesión de
 * Moss, así que se vincula en Moss, con el correo de Ascent: el botón la abre, y al volver se pregunta de
 * nuevo. Vinculada, lo dice y ofrece desvincular, que borra el vínculo de las dos apps.
 *
 * DESDE MOSS es al revés: Moss crea un código de un uso y abre el enlace universal `/vincular/<código>`,
 * que solo puede abrir Ascent. «Vincular» lo canjea con la sesión de Ascent: sin contraseña, que las
 * cuentas de Moss hechas con Apple no tienen.
 */
function useVinculoConMoss(abierta: boolean) {
  // null mientras se pregunta: sin eso el botón salta de «Vincular» a «Desvincular».
  const [vinculada, setVinculada] = useState<boolean | null>(null);
  const [aviso, setAviso] = useState('');
  const mirar = useCallback(async () => {
    try {
      const { data, error } = await supabase.schema('moss').rpc('estado_del_vinculo');
      setVinculada((antes) => (error ? (antes ?? false) : estaVinculada(data)));
    } catch {
      setVinculada((antes) => antes ?? false);
    }
  }, []);
  useEffect(() => {
    if (!abierta) return;
    void mirar();
    return plataforma.ciclo.alCambiar((visible) => {
      if (visible) void mirar();
    });
  }, [abierta, mirar]);
  const vincular = useEnVuelo(async () => {
    setAviso('');
    await Linking.openURL(ABRIR_MOSS).catch(() => Linking.openURL(CONSEGUIR_MOSS).catch(() => undefined));
  });
  // El código sirve una vez: canjeado, «Desvincular» vuelve al botón de siempre y no a canjearlo de nuevo.
  const [canjeado, setCanjeado] = useState(false);
  const conCodigo = useEnVuelo(async (codigo: string) => {
    setAviso('');
    try {
      const { data, error } = await supabase.schema('moss').rpc('vincular_con_codigo', { p_codigo: codigo });
      const r = resultadoDelCodigo(error ? null : data);
      if (r.ok) {
        setCanjeado(true);
        return setVinculada(true);
      }
      setAviso(r.motivo === 'vencido' || r.motivo === 'usado' || r.motivo === 'no_existe' ? T.moss.codigoViejo : T.moss.noSeVinculo);
    } catch {
      setAviso(T.moss.noSeVinculo);
    }
  });
  const desvincular = useEnVuelo(async () => {
    setAviso('');
    try {
      const { error } = await supabase.schema('moss').rpc('desvincular');
      if (error) return setAviso(T.moss.sigueVinculada);
      setVinculada(false);
    } catch {
      setAviso(T.moss.sigueVinculada);
    }
  });
  return { vinculada, aviso, vincular, conCodigo, canjeado, desvincular };
}

function PantallaDeMoss({ visible, codigo, desde, alCerrar }: { visible: boolean; codigo: string | null; desde: number; alCerrar: () => void }) {
  const { height: alto } = useWindowDimensions();
  const vinculo = useVinculoConMoss(visible);
  const seccion = useSeccionMoss(visible && vinculo.vinculada === true);
  const conDatos = vinculo.vinculada === true && !!seccion.datos;
  // El tutorial sale solo la primera vez que se ve la sección vinculada; después, desde el «!».
  const [tutorial, setTutorial] = useState(false);
  useEffect(() => {
    if (!conDatos) return;
    void plataforma.almacenamiento.leer(TUTORIAL_VISTO).then((visto) => {
      if (!visto) setTutorial(true);
    });
  }, [conDatos]);
  const [montada, setMontada] = useState(visible);
  const avance = useRef(new Animated.Value(0)).current;
  const quien = useRef(Symbol('moss')).current;

  useEffect(() => {
    let vivo = true;
    if (visible) {
      setMontada(true);
      // Sigue desde donde lo dejó el dedo: arrancar de arriba de todo se vería como un salto.
      avance.setValue(Math.min(1, desde / alto));
    } else taparElFondo(quien, false);
    void sinMovimiento().then((quieto) => {
      if (!vivo) return;
      Animated.timing(avance, { toValue: visible ? 1 : 0, duration: quieto ? 0 : visible ? ENTRA_MS : SALE_MS, easing: visible ? LLEGA : SE_VA, useNativeDriver: true }).start(({ finished }) => {
        if (!finished || !vivo) return;
        // Tapado del todo, el motor no tiene por qué seguir dibujando.
        if (visible) taparElFondo(quien, true);
        else setMontada(false);
      });
    });
    return () => {
      vivo = false;
    };
    // Solo al abrir y cerrar: `desde` se lee en ese momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, avance, quien]);
  useEffect(() => () => taparElFondo(quien, false), [quien]);

  // Hacia arriba, sigue al dedo y vuelve a Ascent: se entró bajando el cielo, se sale subiéndolo.
  const gesto = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy < -8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => avance.setValue(Math.max(0, Math.min(1, 1 + g.dy / alto))),
        onPanResponderRelease: (_, g) => {
          if (g.dy < -alto * 0.18 || g.vy < -0.8) return alCerrar();
          Animated.timing(avance, { toValue: 1, duration: 260, easing: LLEGA, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () => {
          Animated.timing(avance, { toValue: 1, duration: 260, easing: LLEGA, useNativeDriver: true }).start();
        },
      }),
    [avance, alto, alCerrar],
  );

  if (!montada) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={alCerrar} statusBarTranslucent>
      <Animated.View
        testID="pantalla-de-moss"
        accessibilityViewIsModal
        // Con los datos de Moss hay que poder bajar y subir la lista: el gesto de salir se apaga y queda «Volver».
        {...(conDatos ? {} : gesto.panHandlers)}
        style={[StyleSheet.absoluteFill, { transform: [{ translateY: avance.interpolate({ inputRange: [0, 1], outputRange: [-alto, 0] }) }] }]}
      >
        <CieloDeMoss avance={avance} alto={alto} rotulo={vinculo.vinculada ? T.moss.vinculada : T.moss.vinculaTitulo} sinCentro={conDatos} />
        {conDatos && seccion.datos && <SeccionMoss datos={seccion.datos} alDesvincular={() => void vinculo.desvincular()} alCambiar={() => void seccion.recargar()} alAbrirTutorial={() => setTutorial(true)} />}
        <TutorialMoss
          visible={tutorial}
          alTerminar={() => {
            setTutorial(false);
            void plataforma.almacenamiento.guardar(TUTORIAL_VISTO, '1');
          }}
        />
        {vinculo.vinculada !== null && !conDatos && (
          <View style={estilos.vinculo}>
            {vinculo.vinculada ? (
              <Tocable testID="moss-desvincular" style={estilos.botonTenue} onPress={() => void vinculo.desvincular()} accessibilityRole="button">
                <Text style={estilos.botonTenueTexto}>{T.moss.desvincular}</Text>
              </Tocable>
            ) : codigo && !vinculo.canjeado ? (
              <>
                <Text style={estilos.pie}>{T.moss.mossQuiere}</Text>
                <Tocable testID="moss-vincular-codigo" style={estilos.boton} onPress={() => void vinculo.conCodigo(codigo)} accessibilityRole="button">
                  <Text style={estilos.botonTexto}>{T.moss.vincular}</Text>
                </Tocable>
              </>
            ) : (
              <>
                <Text style={estilos.pie}>{T.moss.vinculaPie}</Text>
                <Tocable testID="moss-vincular" style={estilos.boton} onPress={() => void vinculo.vincular()} accessibilityRole="button" accessibilityHint={T.moss.seAbreMoss}>
                  <Text style={estilos.botonTexto}>{T.moss.vincularConMoss}</Text>
                </Tocable>
                <Text style={estilos.nota}>{T.moss.seAbreMoss}</Text>
              </>
            )}
            {!!vinculo.aviso && <Text style={estilos.nota}>{vinculo.aviso}</Text>}
          </View>
        )}
        <Tocable testID="moss-volver" style={estilos.volver} onPress={alCerrar} accessibilityRole="button">
          <Svg width={18} height={10} viewBox="0 0 18 10">
            <Path d="M1 9l8-8 8 8" fill="none" stroke={MOSS.pergaminoTenue} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={estilos.volverTexto}>{T.moss.volver}</Text>
        </Tocable>
      </Animated.View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  // UN GLOBITO (5/11, a pedido), como lo que va a decir sin vincular y vinculada: con el logo de Moss adentro.
  entrada: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 8, minHeight: 40, paddingHorizontal: 16, marginTop: -8, marginBottom: 10, borderRadius: 999, borderWidth: 1, borderColor: MOSS.oroBorde, backgroundColor: MOSS.nocheVidrio },
  entradaNombre: { color: MOSS.oroClaro, fontFamily: LETRAS_DE_MOSS.titulo, fontSize: 20, lineHeight: 23 },
  cielo: { width: '100%', overflow: 'hidden', backgroundColor: MOSS.noche0 },
  centro: { position: 'absolute', left: 0, right: 0, top: '22%', alignItems: 'center' },
  nombre: { color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.titulo, fontSize: 64, lineHeight: 72, marginTop: 6 },
  rotulo: { color: MOSS.oro, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', marginTop: 10, textAlign: 'center', paddingHorizontal: 24 },
  vinculo: { position: 'absolute', left: 32, right: 32, bottom: 120, alignItems: 'center', gap: 14 },
  pie: { color: MOSS.pergaminoTenue, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  boton: { alignSelf: 'stretch', minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: MOSS.oro },
  botonTexto: { color: MOSS.noche0, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 16, letterSpacing: 0.4 },
  botonTenue: { minHeight: 44, paddingHorizontal: 22, borderRadius: 999, borderWidth: 1, borderColor: MOSS.oroBorde, alignItems: 'center', justifyContent: 'center' },
  botonTenueTexto: { color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 14 },
  nota: { color: MOSS.pergaminoTenue, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  brillo: { position: 'absolute', left: 0, right: 0, bottom: 1, height: 70 },
  horizonte: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, backgroundColor: MOSS.oro },
  volver: { position: 'absolute', left: 0, right: 0, bottom: 44, alignItems: 'center', gap: 8, paddingVertical: 10 },
  volverTexto: { color: MOSS.pergaminoTenue, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 13, letterSpacing: 0.6 },
});
