import { forwardRef, useEffect, useRef, useState, type ComponentProps } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { ENTRADA, ENTRADA_ESPERA_MAX_MS } from '@nucleo/animacion';
import { LOGO, arcoDelLogo, puntoDelLogo } from '@nucleo/logo';
import { cuerpoEn } from '@nucleo/horizonte';
import { paletaDe } from '@nucleo/paletas';
import { cuerpoDeEntrada } from './cuerposDeEntrada';
import { LLEGA, SE_VA } from './movimiento';

// Animated le agrega `collapsable={false}`, y en la web llega al <path> del DOM como un
// atributo que no existe (React lo canta en la consola). Al trazo no le sirve: se descarta.
const PathSinColapsar = forwardRef<Path, ComponentProps<typeof Path> & { collapsable?: boolean }>(function PathSinColapsar({ collapsable: _c, ...resto }, ref) {
  return <Path ref={ref} {...resto} />;
});
const PathAnimado = Animated.createAnimatedComponent(PathSinColapsar);

// El viewBox va de -60 a 60; con 202 pt el aro queda del tamaño del logo del splash
// (`imageWidth: 160` en app.json), y el salto del splash a esto casi no se ve.
const LADO = 202;
const ESCALA = LADO / 120;
const ARCO = arcoDelLogo();
const PUNTO = puntoDelLogo();
const enPt = (u: number) => LADO / 2 + u * ESCALA;
const PLANETA = LOGO.planeta * ESCALA;
// Hacia el punto (-38°): de ese lado viene la luz del eclipse.
const HACIA = { x: Math.cos((-38 * Math.PI) / 180), y: Math.sin((-38 * Math.PI) / 180) };
const PERLA = '#eef1f8';
const GRIS_ARO = '#c9ccd6';
// nucleo/horizonte.ts mide en esta pantalla; el motor estira x con el ancho y y y el radio con el alto.
const ANCHO_DISENO = 390;
const ALTO_DISENO = 844;
const VIAJA = Easing.bezier(0.55, 0, 0.25, 1);
const DIBUJA = Easing.bezier(0.45, 0, 0.25, 1);

type Cuerpo = { rango: number; planeta: string | null };

/**
 * LA ENTRADA DE LA APP (28/11, la D de la galería 31: eclipse con tu cuerpo). El aro se dibuja
 * como siempre —tiene que empalmar con el splash— alrededor de un planeta a contraluz, con una
 * corona perla y el punto que brilla como el diamante de un eclipse. Cuando llegan los datos, la
 * corona toma el color del rango, la sombra se enciende con el cuerpo del rango y el cuerpo viaja
 * a su lugar de Inicio, del tamaño exacto: abajo, el motor ya lo está dibujando ahí.
 *
 * Sin cuerpo (sin sesión, o un cuerpo sin foto) sale como antes: zoom al centro. Con «Reducir
 * movimiento», el logo quieto y un fundido.
 *
 * `alAbrir` llega al empezar la salida; la app recién se monta con `alTerminar` (ver _layout).
 */
export default function EntradaDeLaApp({ lista, cuerpo, alAbrir, alTerminar }: { lista: boolean; cuerpo: Cuerpo | null; alAbrir: () => void; alTerminar: () => void }) {
  // Lo que se anima con el hilo de JS: el trazo y los colores, que el driver nativo no mueve.
  const aro = useRef(new Animated.Value(0)).current;
  const tinte = useRef(new Animated.Value(0)).current;
  // Y con el nativo, todo lo demás: así no se traba cuando el teléfono está ocupado.
  const limbo = useRef(new Animated.Value(0)).current;
  const silueta = useRef(new Animated.Value(0)).current;
  const perla = useRef(new Animated.Value(0)).current;
  const punto = useRef(new Animated.Value(0)).current;
  const destello = useRef(new Animated.Value(0)).current;
  const rayos = useRef(new Animated.Value(0)).current;
  const enciende = useRef(new Animated.Value(0)).current;
  const viaje = useRef(new Animated.Value(0)).current;
  const final = useRef(new Animated.Value(0)).current;
  const zoom = useRef(new Animated.Value(0)).current;
  const [fase, setFase] = useState<'dibujando' | 'esperando' | 'abriendo'>('dibujando');
  const [quieto, setQuieto] = useState(false);
  const [vencida, setVencida] = useState(false);
  const ventana = useWindowDimensions();
  const [caja, setCaja] = useState({ w: ventana.width, h: ventana.height });

  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((q) => {
        if (!vivo) return;
        if (q) {
          setQuieto(true);
          [aro, silueta, punto].forEach((v) => v.setValue(1));
          return setFase('esperando');
        }
        const despues = (ms: number, a: Animated.CompositeAnimation) => Animated.sequence([Animated.delay(ms), a]);
        Animated.parallel([
          Animated.timing(aro, { toValue: 1, duration: ENTRADA.aro, easing: DIBUJA, useNativeDriver: false }),
          Animated.timing(silueta, { toValue: 1, duration: 300, useNativeDriver: true }),
          despues(280, Animated.timing(limbo, { toValue: 1, duration: 560, easing: Easing.out(Easing.quad), useNativeDriver: true })),
          despues(420, Animated.timing(perla, { toValue: 1, duration: 580, easing: LLEGA, useNativeDriver: true })),
          despues(ENTRADA.aro, Animated.parallel([
            Animated.timing(punto, { toValue: 1, duration: ENTRADA.punto, easing: LLEGA, useNativeDriver: true }),
            Animated.timing(destello, { toValue: 1, duration: ENTRADA.destello * 1.6, easing: LLEGA, useNativeDriver: true }),
            Animated.timing(rayos, { toValue: 1, duration: 640, easing: LLEGA, useNativeDriver: true }),
          ])),
        ]).start(() => vivo && setFase('esperando'));
      });
    return () => {
      vivo = false;
    };
  }, [aro, limbo, silueta, perla, punto, destello, rayos]);

  useEffect(() => {
    if (fase !== 'esperando' || lista) return;
    const t = setTimeout(() => setVencida(true), ENTRADA_ESPERA_MAX_MS);
    return () => clearTimeout(t);
  }, [fase, lista]);

  const foto = cuerpo && !quieto ? cuerpoDeEntrada(cuerpo.rango, cuerpo.planeta) : null;

  useEffect(() => {
    if (fase !== 'esperando' || !(lista || vencida)) return;
    if (!foto) {
      setFase('abriendo');
      alAbrir();
      Animated.timing(zoom, {
        toValue: 1,
        duration: quieto ? 200 : ENTRADA.zoom,
        easing: SE_VA,
        // Nativo: la app se monta justo ahora y traba el hilo de JS; el zoom no se entera.
        useNativeDriver: true,
      }).start(() => alTerminar());
      return;
    }
    setFase('abriendo');
    alAbrir();
    Animated.sequence([
      Animated.parallel([
        Animated.timing(tinte, { toValue: 1, duration: 360, useNativeDriver: false }),
        Animated.timing(enciende, { toValue: 1, duration: 520, easing: LLEGA, useNativeDriver: true }),
        Animated.sequence([Animated.delay(ENTRADA.enciende), Animated.timing(viaje, { toValue: 1, duration: ENTRADA.viaje, easing: VIAJA, useNativeDriver: true })]),
      ]),
      // Llegó: debajo está el motor con el mismo cuerpo en el mismo lugar, y la foto se va.
      Animated.timing(final, { toValue: 1, duration: ENTRADA.final, useNativeDriver: true }),
    ]).start(() => alTerminar());
  }, [fase, lista, vencida, quieto, foto, zoom, tinte, enciende, viaje, final, alAbrir, alTerminar]);

  // Adónde va: el lugar y el radio del cuerpo en Inicio, en esta pantalla.
  const c = cuerpo ? cuerpoEn(cuerpo.rango, cuerpo.planeta, 'alta') : null;
  const tx = c ? (caja.w * c.x) / ANCHO_DISENO : caja.w / 2;
  const ty = c ? (caja.h * c.y) / ALTO_DISENO : caja.h / 2;
  const radio = c ? (c.R * caja.h) / ALTO_DISENO : PLANETA;
  const dx = tx - caja.w / 2;
  const dy = ty - caja.h / 2;
  const S = radio / PLANETA;
  const pal = cuerpo ? paletaDe(cuerpo.rango, cuerpo.planeta) : null;
  const claro = pal?.claro ?? PERLA;
  // La foto se arma del tamaño de Inicio y arranca achicada: agrandada desde chica, el teléfono la
  // mostraría con la resolución de chica, borrosa.
  const anchoFoto = foto ? radio / foto.fraccion : 0;
  const anchoBrillo = foto ? PLANETA / foto.fraccion : 0;

  const opacidad = (v: Animated.Value, entrada: number[], salida: number[]) => v.interpolate({ inputRange: entrada, outputRange: salida, extrapolate: 'clamp' });
  const lado = 34;
  return (
    <Animated.View
      testID="entrada-de-la-app"
      pointerEvents={fase === 'abriendo' ? 'none' : 'auto'}
      onLayout={(e: LayoutChangeEvent) => setCaja({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={[StyleSheet.absoluteFill, estilos.raiz, { opacity: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
    >
      {/* El negro del splash: se apaga mientras el cuerpo viaja, y abajo aparece el motor. */}
      <Animated.View testID="entrada-negro" style={[StyleSheet.absoluteFill, estilos.negro, { opacity: opacidad(viaje, [0, 0.23, 0.97], [1, 1, 0]) }]} />

      {foto && (
        <Animated.View
          testID="entrada-cuerpo"
          pointerEvents="none"
          style={[
            estilos.foto,
            { left: tx - anchoFoto / 2, top: ty - anchoFoto / 2, width: anchoFoto, height: anchoFoto, opacity: opacidad(final, [0, 1], [1, 0]) },
            {
              transform: [
                { translateX: viaje.interpolate({ inputRange: [0, 1], outputRange: [-dx, 0] }) },
                { translateY: viaje.interpolate({ inputRange: [0, 1], outputRange: [-dy, 0] }) },
                { scale: viaje.interpolate({ inputRange: [0, 1], outputRange: [1 / S, 1] }) },
              ],
            },
          ]}
        >
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacidad(enciende, [0, 0.6], [0, 1]), transform: [{ scale: enciende.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.92, 1.03, 1] }) }] }]}>
            <Image source={foto.foto} style={estilos.llena} />
          </Animated.View>
        </Animated.View>
      )}

      <Animated.View style={[estilos.centro, { transform: [{ scale: quieto ? 1 : zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 7] }) }] }]}>
        <Animated.View
          style={[
            estilos.logo,
            {
              transform: [
                { translateX: viaje.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
                { translateY: viaje.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
                { scale: viaje.interpolate({ inputRange: [0, 1], outputRange: [1, S] }) },
              ],
            },
          ]}
        >
          {/* El cuerpo aclarado mientras es chico: a ese tamaño el del motor se ve apagado. */}
          {foto && (
            <Animated.View pointerEvents="none" style={[estilos.brillo, { left: LADO / 2 - anchoBrillo / 2, top: LADO / 2 - anchoBrillo / 2, width: anchoBrillo, height: anchoBrillo, opacity: opacidad(viaje, [0, 0.74], [1, 0]) }]}>
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacidad(enciende, [0, 0.6], [0, 1]), transform: [{ scale: enciende.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.92, 1.03, 1] }) }] }]}>
                <Image source={foto.brillo} style={estilos.llena} />
              </Animated.View>
            </Animated.View>
          )}

          {/* La corona perla, y la del color del rango encima cuando llegan los datos. */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: perla, transform: [{ scale: perla.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacidad(tinte, [0, 1], [1, 0]) }]}>
              <Corona id="coronaPerla" colores={[PERLA, '#cfd6e6', '#cfd6e6']} />
            </Animated.View>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacidad(viaje, [0, 0.49, 0.86], [1, 1, 0]), transform: [{ scale: viaje.interpolate({ inputRange: [0, 0.86, 1], outputRange: [1, 2.2, 2.2] }) }] }]}>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: tinte }]}>
              {pal && <Corona id="coronaColor" colores={[pal.claro, pal.principal, pal.apagado]} />}
            </Animated.View>
          </Animated.View>

          {/* LA LUZ DEL ECLIPSE (28/11: «tiene que ser luz, no geométrica»). Degradés corridos hacia el punto, detrás
              del planeta: asoman como una medialuna del lado de la luz y se apagan solos hacia el otro. Se van con la
              sombra; corridos, con el cuerpo encendido caerían adentro de él. */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: limbo }]}>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacidad(enciende, [0, 0.62], [1, 0]) }]}>
              <Luz id="haloPerla" r={46} corrido={8} paradas={[[0, PERLA, 0], [0.5, PERLA, 0], [0.58, PERLA, 0.42], [0.72, '#cfd6e6', 0.14], [1, '#cfd6e6', 0]]} />
              {/* Un borde finito y tenue que da la vuelta entera: sin él, el lado sin luz se funde con el negro y el planeta
                  se lee ovalado. */}
              <Luz id="bordeParejo" r={30.5} corrido={0} paradas={[[0, '#f4f6fb', 0], [0.83, '#f4f6fb', 0], [0.855, '#f4f6fb', 0.4], [0.9, '#cfd6e6', 0.1], [1, '#cfd6e6', 0]]} />
              <Luz id="bordePerla" r={30.5} corrido={4.5} paradas={[[0, '#f4f6fb', 0], [0.8, '#f4f6fb', 0], [0.855, '#f4f6fb', 0.95], [0.9, '#cfd6e6', 0.35], [0.95, '#cfd6e6', 0.08], [1, '#cfd6e6', 0]]} />
            </Animated.View>
          </Animated.View>
          {/* Encendido, el cuerpo lleva su resplandor parejo, del borde para afuera. */}
          {pal && (
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacidad(viaje, [0, 0.37], [1, 0]) }]}>
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: tinte }]}>
                <Luz id="haloColor" r={46} corrido={0} paradas={[[0, pal.claro, 0], [0.565, pal.claro, 0], [0.6, pal.claro, 0.35], [0.75, pal.principal, 0.12], [1, pal.principal, 0]]} />
              </Animated.View>
            </Animated.View>
          )}

          {/* El planeta a contraluz: tapa el cuerpo hasta que se enciende. */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: silueta }]}>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacidad(enciende, [0, 0.62], [1, 0]) }]}>
              <Svg width={LADO} height={LADO} viewBox="-60 -60 120 120">
                <Circle r={LOGO.planeta} fill="#05060b" stroke="rgba(255,255,255,0.07)" strokeWidth={0.6} />
              </Svg>
            </Animated.View>
          </Animated.View>

          <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacidad(viaje, [0, 0.34], [1, 0]) }]}>
            <Svg width={LADO} height={LADO} viewBox="-60 -60 120 120">
              <PathAnimado
                d={ARCO.d}
                fill="none"
                stroke={tinte.interpolate({ inputRange: [0, 1], outputRange: [GRIS_ARO, claro] })}
                strokeWidth={LOGO.trazo}
                strokeLinecap="round"
                // Sin esto, la punta redonda del trazo vacío ya se ve como un puntito.
                strokeOpacity={aro.interpolate({ inputRange: [0, 0.02, 1], outputRange: [0, 1, 1] })}
                strokeDasharray={[ARCO.largo, ARCO.largo]}
                strokeDashoffset={aro.interpolate({ inputRange: [0, 1], outputRange: [ARCO.largo, 0] })}
              />
            </Svg>
          </Animated.View>

          <Animated.View
            style={[
              estilos.absoluto,
              { left: enPt(PUNTO.x) - lado, top: enPt(PUNTO.y) - lado, width: lado * 2, height: lado * 2 },
              {
                opacity: destello.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 0] }),
                transform: [{ scale: destello.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.3, 1, 1.8] }) }],
              },
            ]}
          >
            <Svg width={lado * 2} height={lado * 2} viewBox="-1 -1 2 2">
              <Defs>
                <RadialGradient id="destelloDeEntrada" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor="#ffffff" stopOpacity={0.95} />
                  <Stop offset="0.35" stopColor="#e8ecf6" stopOpacity={0.5} />
                  <Stop offset="1" stopColor="#e8ecf6" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle r={1} fill="url(#destelloDeEntrada)" />
            </Svg>
          </Animated.View>

          {/* Los rayos del punto: una estrella que se enciende y gira apenas. */}
          <Animated.View
            style={[
              estilos.absoluto,
              { left: enPt(PUNTO.x) - 14 * ESCALA, top: enPt(PUNTO.y) - 14 * ESCALA, width: 28 * ESCALA, height: 28 * ESCALA },
              {
                opacity: rayos.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 0] }),
                transform: [
                  { scale: rayos.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1.2, 0.7] }) },
                  { rotate: rayos.interpolate({ inputRange: [0, 0.35, 1], outputRange: ['0deg', '20deg', '45deg'] }) },
                ],
              },
            ]}
          >
            <Svg width={28 * ESCALA} height={28 * ESCALA} viewBox="0 0 28 28">
              <Defs>
                <LinearGradient id="rayoH" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#ffffff" stopOpacity={0} />
                  <Stop offset="0.5" stopColor="#ffffff" stopOpacity={1} />
                  <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
                </LinearGradient>
                <LinearGradient id="rayoV" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#ffffff" stopOpacity={0} />
                  <Stop offset="0.5" stopColor="#ffffff" stopOpacity={1} />
                  <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={13.65} width={28} height={0.7} fill="url(#rayoH)" />
              <Rect x={13.65} y={0} width={0.7} height={28} fill="url(#rayoV)" />
            </Svg>
          </Animated.View>

          <Animated.View
            style={[
              estilos.absoluto,
              { left: enPt(PUNTO.x) - LOGO.punto * ESCALA, top: enPt(PUNTO.y) - LOGO.punto * ESCALA, width: LOGO.punto * ESCALA * 2, height: LOGO.punto * ESCALA * 2 },
              { opacity: punto.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }), transform: [{ scale: punto.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1.7, 1] }) }] },
            ]}
          >
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacidad(viaje, [0, 0.26], [1, 0]) }]}>
              <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: LOGO.punto * ESCALA, backgroundColor: tinte.interpolate({ inputRange: [0, 1], outputRange: ['#ffffff', claro] }) }]} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/** La corona del eclipse: una bruma tenue alrededor del planeta, transparente adentro (un aro se veía geométrico). */
function Corona({ id, colores: [borde, medio, afuera] }: { id: string; colores: [string, string, string] }) {
  return (
    <Svg width={LADO} height={LADO} viewBox="-60 -60 120 120">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={medio} stopOpacity={0} />
          <Stop offset="0.55" stopColor={medio} stopOpacity={0} />
          <Stop offset="0.64" stopColor={borde} stopOpacity={0.16} />
          <Stop offset="0.8" stopColor={medio} stopOpacity={0.07} />
          <Stop offset="1" stopColor={afuera} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle r={46} fill={`url(#${id})`} />
    </Svg>
  );
}

/** Una luz: un degradé radial en un círculo de radio `r`, corrido `corrido` unidades hacia el punto. */
function Luz({ id, r, corrido, paradas }: { id: string; r: number; corrido: number; paradas: [number, string, number][] }) {
  return (
    <Svg width={LADO} height={LADO} viewBox="-60 -60 120 120" style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          {paradas.map(([o, c, a]) => (
            <Stop key={o} offset={String(o)} stopColor={c} stopOpacity={a} />
          ))}
        </RadialGradient>
      </Defs>
      <Circle cx={HACIA.x * corrido} cy={HACIA.y * corrido} r={r} fill={`url(#${id})`} />
    </Svg>
  );
}

const estilos = StyleSheet.create({
  raiz: { alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  // El negro del splash (app.json), no el de la app: así el paso del splash a esto no se nota.
  negro: { backgroundColor: '#000000' },
  centro: { width: LADO, height: LADO },
  logo: { width: LADO, height: LADO },
  foto: { position: 'absolute' },
  brillo: { position: 'absolute' },
  llena: { width: '100%', height: '100%' },
  absoluto: { position: 'absolute' },
});
