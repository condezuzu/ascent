import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CURVA } from '@nucleo/deslizar';
import { C, conAlfa } from './colores';
import { LLEGA } from './movimiento';

/**
 * EL VELO DE LECTURA (30/10). El planeta vive abajo a la derecha y lo que se toca al entrenar
 * también: «Ver lista» sobre el planeta daba 2,24:1. Oscurece de la mitad para abajo, sin tocar
 * el número de la racha. Va entero en todas las pantallas, salvo Inicio en reposo, que lo lleva a
 * la mitad para que el planeta se vea: ahí, lo que se lee encima lleva su placa (`C.placa`).
 */
export default function VeloDeLectura({ entero }: { entero: boolean }) {
  const opacidad = useRef(new Animated.Value(entero ? 1 : 0.5)).current;
  useEffect(() => {
    Animated.timing(opacidad, { toValue: entero ? 1 : 0.5, duration: 420, easing: LLEGA, useNativeDriver: true }).start();
  }, [entero, opacidad]);
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
