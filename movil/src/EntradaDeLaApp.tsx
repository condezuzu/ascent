import { forwardRef, useEffect, useRef, useState, type ComponentProps } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { ENTRADA, ENTRADA_ESPERA_MAX_MS } from '@nucleo/animacion';
import { LOGO, arcoDelLogo, puntoDelLogo } from '@nucleo/logo';

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

/**
 * LA ENTRADA DE LA APP (20/10, la «rápida» de la galería). El aro se dibuja, destella el
 * puntito y la cámara entra al centro mientras el fondo se va. `alAbrir` llega al empezar
 * el zoom —recién ahí se monta la app—, y `alTerminar` cuando ya no queda nada encima.
 * Con «Reducir movimiento», el logo quieto y un fundido.
 */
export default function EntradaDeLaApp({ lista, alAbrir, alTerminar }: { lista: boolean; alAbrir: () => void; alTerminar: () => void }) {
  const aro = useRef(new Animated.Value(0)).current;
  const planeta = useRef(new Animated.Value(0)).current;
  const punto = useRef(new Animated.Value(0)).current;
  const destello = useRef(new Animated.Value(0)).current;
  const zoom = useRef(new Animated.Value(0)).current;
  const [fase, setFase] = useState<'dibujando' | 'esperando' | 'abriendo'>('dibujando');
  const [quieto, setQuieto] = useState(false);
  const [vencida, setVencida] = useState(false);

  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((q) => {
        if (!vivo) return;
        if (q) {
          setQuieto(true);
          [aro, planeta, punto].forEach((v) => v.setValue(1));
          return setFase('esperando');
        }
        Animated.sequence([
          Animated.parallel([
            // El trazo no anda con el driver nativo; el resto sí. Por eso la app no se monta todavía.
            Animated.timing(aro, { toValue: 1, duration: ENTRADA.aro, easing: Easing.bezier(0.45, 0, 0.25, 1), useNativeDriver: false }),
            Animated.timing(planeta, { toValue: 1, duration: ENTRADA.aro * 0.9, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          ]),
          Animated.parallel([
            Animated.timing(punto, { toValue: 1, duration: ENTRADA.destello, easing: Easing.out(Easing.quad), useNativeDriver: false }),
            Animated.timing(destello, { toValue: 1, duration: ENTRADA.destello * 1.6, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          ]),
        ]).start(() => vivo && setFase('esperando'));
      });
    return () => {
      vivo = false;
    };
  }, [aro, planeta, punto, destello]);

  useEffect(() => {
    if (fase !== 'esperando' || lista) return;
    const t = setTimeout(() => setVencida(true), ENTRADA_ESPERA_MAX_MS);
    return () => clearTimeout(t);
  }, [fase, lista]);

  useEffect(() => {
    if (fase !== 'esperando' || !(lista || vencida)) return;
    setFase('abriendo');
    alAbrir();
    Animated.timing(zoom, {
      toValue: 1,
      duration: quieto ? 200 : ENTRADA.zoom,
      easing: Easing.bezier(0.55, 0, 0.8, 0.2),
      // Nativo: la app se monta justo ahora y traba el hilo de JS; el zoom no se entera.
      useNativeDriver: true,
    }).start(() => alTerminar());
  }, [fase, lista, vencida, quieto, zoom, alAbrir, alTerminar]);

  const lado = 34;
  return (
    <Animated.View
      testID="entrada-de-la-app"
      pointerEvents={fase === 'abriendo' ? 'none' : 'auto'}
      style={[StyleSheet.absoluteFill, estilos.fondo, { opacity: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
    >
      <Animated.View
        style={[estilos.logo, { transform: [{ scale: quieto ? 1 : zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 7] }) }] }]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: planeta }]}>
          <Svg width={LADO} height={LADO} viewBox="-60 -60 120 120">
            <Defs>
              <RadialGradient id="planetaDeEntrada" cx="38%" cy="32%" r="70%">
                <Stop offset="0" stopColor="#5a6276" />
                <Stop offset="0.55" stopColor="#1e2230" />
                <Stop offset="1" stopColor="#0b0d14" />
              </RadialGradient>
            </Defs>
            <Circle r={LOGO.planeta} fill="url(#planetaDeEntrada)" />
          </Svg>
        </Animated.View>
        <Svg width={LADO} height={LADO} viewBox="-60 -60 120 120" style={StyleSheet.absoluteFill}>
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
        <Animated.View
          style={[
            estilos.destello,
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
        <Animated.View
          style={[
            estilos.punto,
            { left: enPt(PUNTO.x) - LOGO.punto * ESCALA, top: enPt(PUNTO.y) - LOGO.punto * ESCALA, width: LOGO.punto * ESCALA * 2, height: LOGO.punto * ESCALA * 2, borderRadius: LOGO.punto * ESCALA },
            { opacity: punto.interpolate({ inputRange: [0, 0.01, 1], outputRange: [0, 1, 1] }), transform: [{ scale: punto.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 1.7, 1] }) }] },
          ]}
        />
      </Animated.View>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  // El negro del splash (app.json), no el de la app: así el paso del splash a esto no se nota.
  fondo: { backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  logo: { width: LADO, height: LADO },
  destello: { position: 'absolute' },
  punto: { position: 'absolute', backgroundColor: '#ffffff' },
});
