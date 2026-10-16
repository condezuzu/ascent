import { useCallback, useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import type { WebGLRenderer } from 'three';
import type { Montaje } from '@compartido/motor/escena';
import { C } from '../colores';

/**
 * EL FONDO DE LA ENTRADA (15/10): el espacio de la app —el motor con `soloEstrellas`,
 * sus estrellas y sus fugaces, sin el polvo— y el velo de las pestañas encima.
 *
 * Tiene su propio contexto de GL porque sin sesión no está `FondoRaiz`. El motor
 * tarda en compilar la primera vez: hasta que dibuja, se ve el negro del fondo, y
 * después entra con un fundido en vez de aparecer de golpe.
 */
export default function Espacio() {
  const caja = useRef({ w: 0, h: 0 });
  const oyentes = useRef(new Set<() => void>());
  const montaje = useRef<Montaje | null>(null);
  const renderer = useRef<WebGLRenderer | null>(null);
  const opacidad = useRef(new Animated.Value(0)).current;

  useEffect(
    () => () => {
      montaje.current?.soltar();
      renderer.current?.dispose();
      montaje.current = null;
      renderer.current = null;
    },
    []
  );

  const alMedir = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width === caja.current.w && height === caja.current.h) return;
    caja.current = { w: width, h: height };
    oyentes.current.forEach((fn) => fn());
  }, []);

  const alCrear = useCallback(
    async (gl: ExpoWebGLRenderingContext) => {
      const { crearRenderer, montarEscenaEnGL } = await import('../motorNativo');
      const r = crearRenderer(gl);
      if (!r) return;
      renderer.current = r;
      montaje.current = montarEscenaEnGL(
        r,
        gl,
        {
          tamano: () => caja.current,
          alCambiar: (fn) => {
            oyentes.current.add(fn);
            return () => oyentes.current.delete(fn);
          },
        },
        { rango: 1, soloEstrellas: true }
      );
      if (montaje.current) Animated.timing(opacidad, { toValue: 1, duration: 900, useNativeDriver: true }).start();
    },
    [opacidad]
  );

  return (
    <View style={estilos.raiz} onLayout={alMedir} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacidad }]}>
        <GLView style={StyleSheet.absoluteFill} onContextCreate={alCrear} />
      </Animated.View>
      {/* El velo de la app nativa (0,5, el de `FondoRaiz` para los rangos de abajo). */}
      <View style={estilos.velo} />
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { ...StyleSheet.absoluteFillObject, backgroundColor: C.fondo },
  velo: { ...StyleSheet.absoluteFillObject, backgroundColor: C.fondo, opacity: 0.5 },
});
