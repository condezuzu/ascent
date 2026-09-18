import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { astroDeAmigo } from '@compartido/ranking';
import Insignia from './Insignia';

/**
 * EL CAMPO ESTELAR DE DETRÁS DE LA LISTA DEL RANKING, como en la web: cada
 * amigo es su insignia, del tamaño y el brillo de su racha. Es fondo, no
 * contenido: no recibe toques y va debajo de un velo que la lista le gana.
 *
 * Dónde va cada uno y de qué tamaño lo decide `astroDeAmigo`, el mismo de la
 * web. Lo que se traduce acá:
 *
 *   - `.campo-estelar.de-fondo`: se estira 10 px arriba y abajo y 14 a los
 *     lados de la lista, al 78 %.
 *   - `flotar`: 8 px arriba y vuelta en 7 s, cada uno con su retraso.
 *   - `.ranking::before`, el velo: una elipse centrada al 45 % de alto, con el
 *     fondo al 62 % en el centro y al 88 % desde el 72 % del radio. El tamaño
 *     es el `farthest-corner` de CSS, que acá hay que hacer a mano: la elipse
 *     que pasa por la esquina más lejana con la proporción de `farthest-side`
 *     sale de 0,707 del ancho por 0,778 del alto.
 */
export default function CampoEstelar({
  amigos,
  fondo,
}: {
  amigos: { id: string; rango_actual: number; racha_actual: number }[];
  /** El `--fondo` de la web: el del rango propio. */
  fondo: string;
}) {
  const maxRacha = Math.max(1, ...amigos.map((a) => a.racha_actual));
  const [caja, setCaja] = useState<{ w: number; h: number } | null>(null);
  return (
    <View
      style={estilos.campo}
      pointerEvents="none"
      onLayout={(e) =>
        setCaja({
          w: e.nativeEvent.layout.width,
          h: e.nativeEvent.layout.height,
        })
      }
    >
      <View style={[StyleSheet.absoluteFill, { opacity: 0.78 }]}>
        {amigos.map((a, i) => (
          <Astro key={a.id} indice={i} rango={a.rango_actual} racha={a.racha_actual} maxRacha={maxRacha} />
        ))}
      </View>
      {caja && (
        <Svg width={caja.w} height={caja.h} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient
              id="velo-ranking"
              gradientUnits="userSpaceOnUse"
              cx={caja.w * 0.5}
              cy={caja.h * 0.45}
              fx={caja.w * 0.5}
              fy={caja.h * 0.45}
              r={caja.w * 0.707}
              gradientTransform={veloAchatado(caja.h * 0.45, (caja.h * 0.778) / (caja.w * 0.707))}
            >
              <Stop offset="0" stopColor={fondo} stopOpacity={0.62} />
              <Stop offset="0.72" stopColor={fondo} stopOpacity={0.88} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={caja.w} height={caja.h} fill="url(#velo-ranking)" />
        </Svg>
      )}
    </View>
  );
}

/** Escala vertical alrededor de `cy`: el círculo del degradado queda elipse. */
function veloAchatado(cy: number, k: number) {
  return `translate(0 ${cy * (1 - k)}) scale(1 ${k})`;
}

function Astro({ indice, rango, racha, maxRacha }: { indice: number; rango: number; racha: number; maxRacha: number }) {
  const astro = astroDeAmigo(indice, racha, maxRacha);
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const medio = {
      duration: 3500,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    };
    const vaiven = Animated.loop(
      Animated.sequence([Animated.timing(y, { toValue: -8, ...medio }), Animated.timing(y, { toValue: 0, ...medio })])
    );
    const t = setTimeout(() => vaiven.start(), astro.retraso * 1000);
    return () => {
      clearTimeout(t);
      vaiven.stop();
    };
  }, [y, astro.retraso]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: `${astro.x}%`,
        top: `${astro.y}%`,
        // El centro del astro va en (x, y): en la web es `translate(-50%, -50%)`.
        marginLeft: -astro.tam / 2,
        marginTop: -astro.tam / 2,
        opacity: astro.opacidad,
        transform: [{ translateY: y }],
      }}
    >
      <Insignia rango={rango} tam={astro.tam} />
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  campo: { position: 'absolute', top: -10, bottom: -10, left: -14, right: -14 },
});
