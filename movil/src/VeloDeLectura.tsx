import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, conAlfa } from './colores';
import { LLEGA } from './movimiento';

/**
 * EL VELO DE LECTURA (30/10). El planeta vive abajo a la derecha y lo que se toca al entrenar
 * también: «Ver lista» sobre el planeta daba 2,24:1. Oscurece de la mitad para abajo, sin tocar
 * el número de la racha. Cuánto, lo dice `velosDe`: donde el planeta hace de horizonte no hace falta,
 * porque lo oscuro lo pone su noche.
 */
export default function VeloDeLectura({ cuanto }: { cuanto: number }) {
  const opacidad = useRef(new Animated.Value(cuanto)).current;
  useEffect(() => {
    Animated.timing(opacidad, { toValue: cuanto, duration: 420, easing: LLEGA, useNativeDriver: true }).start();
  }, [cuanto, opacidad]);
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: opacidad }]} testID="velo-de-lectura">
      <LinearGradient
        colors={[conAlfa(C.negro, 0), conAlfa(C.negro, 0.58), conAlfa(C.negro, 0.8)]}
        locations={[0.34, 0.54, 1]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}
