import { forwardRef, useEffect, useRef, useState, type ComponentProps } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
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
// El borde del planeta del lado del punto: ahí se enciende el diamante.
const BORDE = { x: LOGO.planeta * Math.cos((LOGO.puntoEn * Math.PI) / 180), y: LOGO.planeta * Math.sin((LOGO.puntoEn * Math.PI) / 180) };
const enPt = (u: number) => LADO / 2 + u * ESCALA;
const PLANETA = LOGO.planeta * ESCALA;
// nucleo/horizonte.ts mide en esta pantalla; el motor estira x con el ancho y y y el radio con el alto.
const ANCHO_DISENO = 390;
const ALTO_DISENO = 844;
const DIBUJA = Easing.bezier(0.45, 0, 0.25, 1);
const VIAJA = Easing.bezier(0.55, 0, 0.25, 1);
const SUAVE = Easing.bezier(0.65, 0, 0.35, 1);

type Parada = [number, string, number];
type Cuerpo = { rango: number; planeta: string | null };

// LA LUZ DEL ECLIPSE (28/11, la hizo el chat de modelos: _tmp-entrada/como-se-hace.md). La corona es UNA luz
// concéntrica con el planeta que nace en su borde (26/58) y solo baja hacia afuera: un pico después del borde
// se lee como un segundo círculo, y una luz corrida, como un óvalo.
const corona = (c1: string, c2: string, c3: string): Parada[] => [[0, c1, 0.95], [0.448, c1, 0.95], [0.47, c1, 0.62], [0.5, c1, 0.4], [0.55, c2, 0.24], [0.62, c2, 0.13], [0.72, c2, 0.06], [0.85, c3, 0.022], [1, c3, 0]];
// Los chorros de la corona: elipses angostas, de a dos opuestas, así el conjunto sigue redondo.
const RAYOS = [{ giro: -24, rx: 58, ry: 15, op: 0.55 }, { giro: 38, rx: 50, ry: 14, op: 0.4 }, { giro: 104, rx: 54, ry: 15, op: 0.3 }];
const PERLA: [string, string, string] = ['#f4f6fb', '#d9deea', '#b9c2d6'];
// La asimetría la pone el diamante: su resplandor va centrado en el borde y debajo del planeta.
const RESPLANDOR: Parada[] = [[0, '#ffffff', 0.85], [0.06, '#ffffff', 0.65], [0.16, '#f4f6fb', 0.32], [0.32, '#f4f6fb', 0.13], [0.55, '#e3e8f2', 0.045], [1, '#e3e8f2', 0]];
const DIAMANTE: Parada[] = [[0, '#ffffff', 1], [0.22, '#ffffff', 0.95], [0.4, '#ffffff', 0.45], [0.7, '#ffffff', 0.1], [1, '#ffffff', 0]];

/**
 * LA ENTRADA DE LA APP (28/11, la D de la galería: eclipse con tu cuerpo; la luz, del chat de modelos).
 * El aro se dibuja como siempre —tiene que empalmar con el splash— alrededor del planeta a contraluz; nace la
 * corona, el aro se funde en ella y el punto baja al borde, donde se enciende el diamante. Cuando llegan los
 * datos, la corona toma el color del rango, el eclipse termina y la sombra se enciende con el cuerpo del rango,
 * que viaja a su lugar de Inicio, del tamaño exacto: abajo, el motor ya lo está dibujando ahí.
 *
 * Sin cuerpo (sin sesión, o un cuerpo sin foto) sale con el zoom al centro. Con «Reducir movimiento», el logo
 * quieto y un fundido. `alAbrir` llega al empezar la salida; la app recién se monta con `alTerminar`.
 */
export default function EntradaDeLaApp({ lista, cuerpo, alAbrir, alTerminar }: { lista: boolean; cuerpo: Cuerpo | null; alAbrir: () => void; alTerminar: () => void }) {
  // El trazo del aro va con el hilo de JS (el driver nativo no lo mueve); todo lo demás, con el nativo.
  const aro = useRef(new Animated.Value(0)).current;
  const v = useRef({
    silueta: new Animated.Value(0),
    punto: new Animated.Value(0),
    corona: new Animated.Value(0),
    rayos: new Animated.Value(0),
    aroFuera: new Animated.Value(0),
    baja: new Animated.Value(0),
    diamante: new Animated.Value(0),
    resplandor: new Animated.Value(0),
    destellos: new Animated.Value(0),
    tinte: new Animated.Value(0),
    coronaFuera: new Animated.Value(0),
    luzFuera: new Animated.Value(0),
    planetaFuera: new Animated.Value(0),
    enciende: new Animated.Value(0),
  }).current;
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
    let espera: ReturnType<typeof setTimeout> | undefined;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((q) => {
        if (!vivo) return;
        if (q) {
          setQuieto(true);
          [aro, v.silueta, v.punto].forEach((x) => x.setValue(1));
          return setFase('esperando');
        }
        const t = (valor: Animated.Value, desde: number, dura: number, easing?: (n: number) => number) =>
          Animated.sequence([Animated.delay(desde), Animated.timing(valor, { toValue: 1, duration: dura, easing, useNativeDriver: valor !== aro })]);
        Animated.parallel([
          t(v.silueta, 0, 300),
          t(aro, 0, ENTRADA.aro, DIBUJA),
          t(v.punto, 500, 300, LLEGA),
          t(v.corona, 300, 620, LLEGA),
          t(v.rayos, 420, 760, LLEGA),
          t(v.aroFuera, 760, 380, SE_VA),
          t(v.baja, 760, 420, SUAVE),
          t(v.diamante, 1000, 380, LLEGA),
          t(v.resplandor, 1000, 560, LLEGA),
          t(v.destellos, 1000, 800, LLEGA),
        ]).start();
        // Los datos pueden entrar con el diamante ya encendido: los destellos siguen solos.
        espera = setTimeout(() => vivo && setFase('esperando'), ENTRADA.eclipse);
      });
    return () => {
      vivo = false;
      if (espera) clearTimeout(espera);
    };
  }, [aro, v]);

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
    const desde = (ms: number, a: Animated.CompositeAnimation) => Animated.sequence([Animated.delay(ms), a]);
    Animated.sequence([
      Animated.parallel([
        // Tu color en la corona; después el eclipse termina y la sombra se enciende con tu cuerpo.
        Animated.timing(v.tinte, { toValue: 1, duration: 300, useNativeDriver: true }),
        desde(ENTRADA.enciende, Animated.parallel([
          // Rápida: con un cuerpo más chico que el disco (el asteroide), una corona lenta dibuja un círculo vacío.
          Animated.timing(v.coronaFuera, { toValue: 1, duration: 300, easing: LLEGA, useNativeDriver: true }),
          Animated.timing(v.luzFuera, { toValue: 1, duration: 360, easing: SE_VA, useNativeDriver: true }),
          Animated.timing(v.planetaFuera, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(v.enciende, { toValue: 1, duration: 480, easing: LLEGA, useNativeDriver: true }),
        ])),
        desde(ENTRADA.salida, Animated.timing(viaje, { toValue: 1, duration: ENTRADA.viaje, easing: VIAJA, useNativeDriver: true })),
      ]),
      // Llegó: debajo está el motor con el mismo cuerpo en el mismo lugar, y la foto se va.
      Animated.timing(final, { toValue: 1, duration: ENTRADA.final, useNativeDriver: true }),
    ]).start(() => alTerminar());
  }, [fase, lista, vencida, quieto, foto, zoom, v, viaje, final, alAbrir, alTerminar]);

  // Adónde va: el lugar y el radio del cuerpo en Inicio, en esta pantalla.
  const c = cuerpo ? cuerpoEn(cuerpo.rango, cuerpo.planeta, 'alta') : null;
  const tx = c ? (caja.w * c.x) / ANCHO_DISENO : caja.w / 2;
  const ty = c ? (caja.h * c.y) / ALTO_DISENO : caja.h / 2;
  const radio = c ? (c.R * caja.h) / ALTO_DISENO : PLANETA;
  const dx = tx - caja.w / 2;
  const dy = ty - caja.h / 2;
  const S = radio / PLANETA;
  const pal = cuerpo ? paletaDe(cuerpo.rango, cuerpo.planeta) : null;
  // La foto se arma del tamaño de Inicio y arranca achicada: agrandada desde chica, el teléfono la
  // mostraría con la resolución de chica, borrosa.
  const anchoFoto = foto ? radio / foto.fraccion : 0;
  const anchoBrillo = foto ? PLANETA / foto.fraccion : 0;

  const entre = (x: Animated.Value, desde: number[], hasta: number[]) => x.interpolate({ inputRange: desde, outputRange: hasta, extrapolate: 'clamp' });
  const apaga = (x: Animated.Value) => entre(x, [0, 1], [1, 0]);
  const enPunto = (centro: { x: number; y: number }, lado: number) => ({ left: enPt(centro.x) - (lado * ESCALA) / 2, top: enPt(centro.y) - (lado * ESCALA) / 2, width: lado * ESCALA, height: lado * ESCALA });
  const bajaX = (BORDE.x - PUNTO.x) * ESCALA;
  const bajaY = (BORDE.y - PUNTO.y) * ESCALA;

  return (
    <Animated.View
      testID="entrada-de-la-app"
      pointerEvents={fase === 'abriendo' ? 'none' : 'auto'}
      onLayout={(e: LayoutChangeEvent) => setCaja({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={[StyleSheet.absoluteFill, estilos.raiz, { opacity: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
    >
      {/* El negro del splash. Se abre recién cuando el cuerpo casi llegó: antes, abajo se veía el de Inicio y había dos. */}
      <Animated.View testID="entrada-negro" style={[StyleSheet.absoluteFill, estilos.negro, { opacity: entre(viaje, [0, 0.62, 1], [1, 1, 0]) }]} />

      {foto && (
        <Animated.View
          testID="entrada-cuerpo"
          pointerEvents="none"
          style={[
            estilos.absoluto,
            { left: tx - anchoFoto / 2, top: ty - anchoFoto / 2, width: anchoFoto, height: anchoFoto, opacity: apaga(final) },
            {
              transform: [
                { translateX: viaje.interpolate({ inputRange: [0, 1], outputRange: [-dx, 0] }) },
                { translateY: viaje.interpolate({ inputRange: [0, 1], outputRange: [-dy, 0] }) },
                { scale: viaje.interpolate({ inputRange: [0, 1], outputRange: [1 / S, 1] }) },
              ],
            },
          ]}
        >
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: entre(v.enciende, [0, 0.6], [0, 1]), transform: [{ scale: entre(v.enciende, [0, 0.6, 1], [0.92, 1.03, 1]) }] }]}>
            <Image source={foto.foto} style={estilos.llena} />
          </Animated.View>
        </Animated.View>
      )}

      <Animated.View style={[estilos.logo, { transform: [{ scale: quieto ? 1 : zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 7] }) }] }]}>
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
          {/* 1 · La corona perla, que se va cuando llega tu color. */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: v.corona, transform: [{ scale: entre(v.corona, [0, 1], [0.94, 1]) }] }]}>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: apaga(v.tinte) }]}>
              <Corona id="perla" colores={PERLA} rayos={v.rayos} />
            </Animated.View>
          </Animated.View>

          {/* 2 · La corona de tu color: llega con los datos y se apaga cuando se enciende el cuerpo. */}
          {pal && (
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: apaga(v.coronaFuera), transform: [{ scale: entre(v.coronaFuera, [0, 1], [1, 1.06]) }] }]}>
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: v.tinte }]}>
                <Corona id="color" colores={[pal.claro, pal.claro, pal.principal]} rayos={v.rayos} />
              </Animated.View>
            </Animated.View>
          )}

          {/* 3 · El resplandor del diamante, debajo del planeta: aclara ese lado sin comerse el disco. */}
          <Animated.View style={[estilos.absoluto, enPunto(BORDE, 60), { opacity: v.resplandor, transform: [{ scale: entre(v.resplandor, [0, 1], [0.55, 1]) }] }]}>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: apaga(v.luzFuera) }]}>
              <Luz id="resplandor" lado={60} paradas={RESPLANDOR} />
            </Animated.View>
          </Animated.View>

          {/* 4 · El cuerpo aclarado mientras es chico: a ese tamaño el del motor se ve apagado. */}
          {foto && (
            <Animated.View pointerEvents="none" style={[estilos.absoluto, { left: LADO / 2 - anchoBrillo / 2, top: LADO / 2 - anchoBrillo / 2, width: anchoBrillo, height: anchoBrillo, opacity: entre(viaje, [0, 0.74], [1, 0]) }]}>
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: entre(v.enciende, [0, 0.6], [0, 1]), transform: [{ scale: entre(v.enciende, [0, 0.6, 1], [0.92, 1.03, 1]) }] }]}>
                <Image source={foto.brillo} style={estilos.llena} />
              </Animated.View>
            </Animated.View>
          )}

          {/* 5 · El planeta a contraluz, sin trazo: un borde finito era otro círculo. */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: v.silueta }]}>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: apaga(v.planetaFuera) }]}>
              <Svg width={LADO} height={LADO} viewBox="-60 -60 120 120">
                <Defs>
                  <RadialGradient id="planetaDeEntrada" cx="66%" cy="30%" r="80%">
                    <Stop offset="0" stopColor="#0d111b" stopOpacity={1} />
                    <Stop offset="0.7" stopColor="#07090f" stopOpacity={1} />
                    <Stop offset="1" stopColor="#040509" stopOpacity={1} />
                  </RadialGradient>
                </Defs>
                <Circle r={LOGO.planeta} fill="url(#planetaDeEntrada)" />
              </Svg>
            </Animated.View>
          </Animated.View>

          {/* 6 · El aro de siempre, que se funde en la corona. */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: apaga(v.aroFuera) }]}>
            <Svg width={LADO} height={LADO} viewBox="-60 -60 120 120">
              <PathAnimado
                d={ARCO.d}
                fill="none"
                stroke="#c9ccd6"
                strokeWidth={LOGO.trazo}
                strokeLinecap="round"
                // Sin esto, la punta redonda del trazo vacío ya se ve como un puntito.
                strokeOpacity={aro.interpolate({ inputRange: [0, 0.02, 1], outputRange: [0, 1, 1] })}
                strokeDasharray={[ARCO.largo, ARCO.largo]}
                strokeDashoffset={aro.interpolate({ inputRange: [0, 1], outputRange: [ARCO.largo, 0] })}
              />
            </Svg>
          </Animated.View>

          {/* 7 · Los destellos del diamante. */}
          <Animated.View
            style={[
              estilos.absoluto,
              enPunto(BORDE, 46),
              {
                opacity: entre(v.destellos, [0, 0.3, 1], [0, 1, 0.55]),
                transform: [{ scale: entre(v.destellos, [0, 0.3, 1], [0.2, 1.1, 1]) }, { rotate: v.destellos.interpolate({ inputRange: [0, 0.3, 1], outputRange: ['-14deg', '-6deg', '0deg'] }) }],
              },
            ]}
          >
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: apaga(v.luzFuera) }]}>
              <Svg width={46 * ESCALA} height={46 * ESCALA} viewBox="-23 -23 46 46">
                <Defs>
                  <LinearGradient id="destelloH" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="#ffffff" stopOpacity={0} />
                    <Stop offset="0.5" stopColor="#ffffff" stopOpacity={1} />
                    <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
                  </LinearGradient>
                  <LinearGradient id="destelloV" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#ffffff" stopOpacity={0} />
                    <Stop offset="0.5" stopColor="#ffffff" stopOpacity={1} />
                    <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Rect x={-23} y={-0.45} width={46} height={0.9} fill="url(#destelloH)" />
                <Rect x={-0.4} y={-13} width={0.8} height={26} fill="url(#destelloV)" />
                <Rect x={-9} y={-0.3} width={18} height={0.6} fill="url(#destelloH)" transform="rotate(45)" />
                <Rect x={-9} y={-0.3} width={18} height={0.6} fill="url(#destelloH)" transform="rotate(-45)" />
              </Svg>
            </Animated.View>
          </Animated.View>

          {/* 8 · El diamante: chico, con el centro justo en el borde del planeta. */}
          <Animated.View style={[estilos.absoluto, enPunto(BORDE, 14), { opacity: entre(v.diamante, [0, 0.45], [0, 1]), transform: [{ scale: entre(v.diamante, [0, 0.45, 1], [0.3, 1.25, 1]) }] }]}>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: apaga(v.luzFuera) }]}>
              <Luz id="diamante" lado={14} paradas={DIAMANTE} />
            </Animated.View>
          </Animated.View>

          {/* 9 · El punto del logo: brota, y baja por el radio hasta el borde, donde se enciende el diamante. */}
          <Animated.View
            style={[
              estilos.absoluto,
              enPunto(PUNTO, LOGO.punto * 2),
              { opacity: entre(v.punto, [0, 0.2, 1], [0, 1, 1]), transform: [{ scale: entre(v.punto, [0, 0.6, 1], [0, 1.7, 1]) }] },
            ]}
          >
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                estilos.punto,
                {
                  opacity: entre(v.baja, [0, 0.82, 1], [1, 1, 0]),
                  transform: [
                    { translateX: entre(v.baja, [0, 0.82, 1], [0, bajaX, bajaX]) },
                    { translateY: entre(v.baja, [0, 0.82, 1], [0, bajaY, bajaY]) },
                    { scale: entre(v.baja, [0, 0.82, 1], [1, 0.55, 0.4]) },
                  ],
                },
              ]}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/** La corona: la luz concéntrica y sus tres chorros, que se prenden con `rayos`. */
function Corona({ id, colores: [c1, c2, c3], rayos }: { id: string; colores: [string, string, string]; rayos: Animated.Value }) {
  return (
    <>
      <Svg width={LADO} height={LADO} viewBox="-60 -60 120 120" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`corona-${id}`} cx="50%" cy="50%" r="50%">
            {corona(c1, c2, c3).map(([o, c, a]) => (
              <Stop key={o} offset={String(o)} stopColor={c} stopOpacity={a} />
            ))}
          </RadialGradient>
        </Defs>
        <Circle r={58} fill={`url(#corona-${id})`} />
      </Svg>
      {RAYOS.map((r, i) => (
        <Animated.View key={i} style={[StyleSheet.absoluteFill, { opacity: rayos.interpolate({ inputRange: [0, 1], outputRange: [0, r.op] }), transform: [{ rotate: `${r.giro}deg` }] }]}>
          <Svg width={LADO} height={LADO} viewBox="-60 -60 120 120">
            <Defs>
              <RadialGradient id={`rayo-${id}-${i}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={c1} stopOpacity={0.5} />
                <Stop offset="0.45" stopColor={c1} stopOpacity={0.22} />
                <Stop offset="0.7" stopColor={c2} stopOpacity={0.07} />
                <Stop offset="1" stopColor={c2} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse rx={r.rx} ry={r.ry} fill={`url(#rayo-${id}-${i})`} />
          </Svg>
        </Animated.View>
      ))}
    </>
  );
}

/** Una luz redonda de `lado` unidades del logo, con su degradé. */
function Luz({ id, lado, paradas }: { id: string; lado: number; paradas: Parada[] }) {
  const r = lado / 2;
  return (
    <Svg width={lado * ESCALA} height={lado * ESCALA} viewBox={`${-r} ${-r} ${lado} ${lado}`}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          {paradas.map(([o, c, a]) => (
            <Stop key={o} offset={String(o)} stopColor={c} stopOpacity={a} />
          ))}
        </RadialGradient>
      </Defs>
      <Circle r={r} fill={`url(#${id})`} />
    </Svg>
  );
}

const estilos = StyleSheet.create({
  raiz: { alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  // El negro del splash (app.json), no el de la app: así el paso del splash a esto no se nota.
  negro: { backgroundColor: '#000000' },
  logo: { width: LADO, height: LADO },
  absoluto: { position: 'absolute' },
  llena: { width: '100%', height: '100%' },
  punto: { borderRadius: LOGO.punto * ESCALA, backgroundColor: '#ffffff' },
});
