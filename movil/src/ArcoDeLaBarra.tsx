import { useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';
import { alturaDelArco, caminoDelArco, columnasDelArco, SUBE_EL_ARCO } from '@nucleo/arcoDeLaBarra';
import { C, conTema, luz } from './colores';
import { useTema } from './useTema';

// Más de lo que mide la barra: lo que sobra cae fuera de la pantalla.
const ALTO_DEL_FONDO = 150;
const MUESTRAS_POR_PESTANA = 6;

/**
 * LA BARRA SE FUNDE EN UN ARCO (2/11, la variante «en la curva» de la galería, con lo que pidió).
 * No hay caja ni línea recta: lo de abajo del arco va borroso, y un punto corre por el arco hasta la
 * pestaña en la que se está, atado a la misma tira que mueve las pantallas, así acompaña al dedo.
 *
 * EL DESENFOQUE VA EN COLUMNAS (5/11). Hasta el 3/11 era un `UIVisualEffectView` recortado por un círculo
 * de unos 1750 pt, cuyo borde era el arco, y el teléfono se reiniciaba al deslizar: se caía el compositor de
 * iOS. Sin él no volvió a pasar. Después fue una franja oscura, y se notaba como caja. Ahora vuelve sin
 * recorte: de donde arranca el arco para abajo, una sola pieza; y arriba, la franja curva, en columnas
 * (`columnasDelArco`). Cada columna desenfoca solo lo suyo: bajando hasta el fondo, sobre un cielo claro se
 * veían franjas verticales de colores, también detrás de los iconos.
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
      <BlurView tint="dark" intensity={40} style={{ position: 'absolute', left: 0, width: ancho, top: 0, height: ALTO_DEL_FONDO }} />
      {/* Medio punto de más de ancho y de alto: sin eso, entre dos piezas asomaba una línea sin desenfocar. */}
      {columnasDelArco(ancho).map((c) => (
        <BlurView key={c.left} tint="dark" intensity={40} style={{ position: 'absolute', left: c.left, width: c.ancho + 0.5, top: c.top, height: 0.5 - c.top }} />
      ))}
      <Svg width={ancho} height={ALTO_DEL_FONDO + 1} style={estilos.linea}>
        {/* Un oscuro parejo y muy leve, con la forma exacta del arco: tapa los escalones de las columnas. */}
        <Path d={`${caminoDelArco(ancho)} L${ancho} ${ALTO_DEL_FONDO + 1} L0 ${ALTO_DEL_FONDO + 1} Z`} fill={C.negro} fillOpacity={0.12} />
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
