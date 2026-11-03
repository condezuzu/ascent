import { useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { alturaDelArco, caminoDelArco, SUBE_EL_ARCO } from '@nucleo/arcoDeLaBarra';
import { C, conTema, luz } from './colores';
import { useTema } from './useTema';

// Más de lo que mide la barra: lo que sobra cae fuera de la pantalla.
const ALTO_DEL_FONDO = 150;
const MUESTRAS_POR_PESTANA = 6;

/**
 * LA BARRA SE FUNDE EN UN ARCO (2/11, la variante «en la curva» de la galería, con lo que pidió).
 * No hay caja ni línea recta: lo de abajo del arco va oscuro, y un punto corre por el arco hasta la
 * pestaña en la que se está, atado a la misma tira que mueve las pantallas, así acompaña al dedo.
 *
 * SIN DESENFOQUE NATIVO (3/11). Iba borroso: un `UIVisualEffectView` recortado por un círculo de unos
 * 1750 pt, cuyo borde era el arco. Con eso en la tienda, el teléfono se reiniciaba a veces al deslizar,
 * y la pantalla de bloqueo que aparece dice que se cayó el compositor de iOS, no la app. El círculo era
 * lo más grande y lo más nuevo que le llegaba. Un degradado con la forma del arco no le pide nada.
 */
export default function ArcoDeLaBarra({ correr, ancho, cantidad }: { correr: Animated.Value; ancho: number; cantidad: number }) {
  useTema();
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
      <Svg width={ancho} height={ALTO_DEL_FONDO + 1} style={estilos.linea}>
        <Defs>
          <LinearGradient id="barra-abajo" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.negro} stopOpacity={0.56} />
            <Stop offset="0.5" stopColor={C.negro} stopOpacity={0.82} />
          </LinearGradient>
        </Defs>
        <Path d={`${caminoDelArco(ancho)} L${ancho} ${ALTO_DEL_FONDO + 1} L0 ${ALTO_DEL_FONDO + 1} Z`} fill="url(#barra-abajo)" />
        <Path d={caminoDelArco(ancho)} fill="none" stroke={C.claro} strokeOpacity={0.34} strokeWidth={1} />
      </Svg>
      <Animated.View testID="punto-del-arco" style={[estilos.punto, { transform: [{ translateX: x }, { translateY: y }] }]} />
    </View>
  );
}

const estilos = conTema(() => StyleSheet.create({
  linea: { position: 'absolute', left: 0, top: -SUBE_EL_ARCO - 1 },
  // Atado a (0, 0) y lo mueve la transformación; el `left` y el `top` lo centran en la línea.
  punto: { position: 'absolute', left: -3, top: -SUBE_EL_ARCO - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: C.claro, ...luz(C.claro, 0.9, 5) },
}));
