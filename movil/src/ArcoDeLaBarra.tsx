import { useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { alturaDelArco, radioDelArco, SUBE_EL_ARCO } from '@nucleo/arcoDeLaBarra';
import { C, conAlfa, conTema, luz } from './colores';
import { useTema } from './useTema';

// Más de lo que mide la barra: lo que sobra cae fuera de la pantalla.
const ALTO_DEL_FONDO = 150;
const MUESTRAS_POR_PESTANA = 6;

/**
 * LA BARRA SE FUNDE EN UN ARCO (2/11, la variante «en la curva» de la galería, con lo que pidió).
 * No hay caja ni línea recta: lo de abajo del arco va borroso, y un punto corre por el arco hasta la
 * pestaña en la que se está, atado a la misma tira que mueve las pantallas, así acompaña al dedo.
 *
 * LO BORROSO SE RECORTA CON UN CÍRCULO ENORME: un `UIVisualEffectView` no acepta una máscara con
 * forma, pero sí el recorte de un padre redondeado. Con este radio, el borde del círculo es el arco.
 */
export default function ArcoDeLaBarra({ correr, ancho, cantidad }: { correr: Animated.Value; ancho: number; cantidad: number }) {
  useTema();
  const radio = radioDelArco(ancho);
  const { x, y } = useMemo(() => {
    const entrada: number[] = [];
    const xs: number[] = [];
    const ys: number[] = [];
    // De menor a mayor: la tira va de menos el último índice por un ancho hasta cero.
    for (let m = (cantidad - 1) * MUESTRAS_POR_PESTANA; m >= 0; m--) {
      const indice = m / MUESTRAS_POR_PESTANA;
      const px = ((indice + 0.5) * ancho) / cantidad;
      entrada.push(-indice * ancho);
      xs.push(px);
      ys.push(alturaDelArco(px, ancho));
    }
    return {
      x: correr.interpolate({ inputRange: entrada, outputRange: xs, extrapolate: 'clamp' }),
      y: correr.interpolate({ inputRange: entrada, outputRange: ys, extrapolate: 'clamp' }),
    };
  }, [correr, ancho, cantidad]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="arco-de-la-barra">
      <View style={[estilos.recorte, { width: radio * 2, height: radio * 2, borderRadius: radio, left: ancho / 2 - radio }]}>
        <View style={{ position: 'absolute', left: radio - ancho / 2, top: 0, width: ancho, height: ALTO_DEL_FONDO }}>
          <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />
          {/* Encima del desenfoque y no debajo: iOS dibuja mal un desenfoque con algo translúcido atrás. */}
          <LinearGradient
            colors={[conAlfa(C.negro, 0.34), conAlfa(C.negro, 0.66)]}
            locations={[0, 0.5]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </View>
      <Svg width={ancho} height={SUBE_EL_ARCO + 2} style={estilos.linea}>
        <Path d={`M0 ${SUBE_EL_ARCO + 1} Q${ancho / 2} ${1 - SUBE_EL_ARCO} ${ancho} ${SUBE_EL_ARCO + 1}`} fill="none" stroke={C.claro} strokeOpacity={0.34} strokeWidth={1} />
      </Svg>
      <Animated.View testID="punto-del-arco" style={[estilos.punto, { transform: [{ translateX: x }, { translateY: y }] }]} />
    </View>
  );
}

const estilos = conTema(() => StyleSheet.create({
  recorte: { position: 'absolute', top: -SUBE_EL_ARCO, overflow: 'hidden' },
  linea: { position: 'absolute', left: 0, top: -SUBE_EL_ARCO - 1 },
  // Atado a (0, 0) y lo mueve la transformación; el `left` y el `top` lo centran en la línea.
  punto: { position: 'absolute', left: -3, top: -SUBE_EL_ARCO - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: C.claro, ...luz(C.claro, 0.9, 5) },
}));
