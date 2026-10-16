import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { LinearGradient } from 'expo-linear-gradient';
import type { WebGLRenderer } from 'three';
import type { Montaje } from '@compartido/motor/escena';
import { ELIPSES_BASE, ELIPSES_VELO } from '@compartido/fondoDegradados';
import { FONDO_BASE, paletaDe } from '@nucleo/paletas';
import ElipsesDeLuz from '../ElipsesDeLuz';
import { factorDeTope } from '../FondoRaiz';
import { conAlfa } from '../colores';

const PALETA = paletaDe(1);

/**
 * EL FONDO DE LA ENTRADA: el mismo espacio que arma `FondoRaiz` para el rango 1
 * —capa fija de elipses y estrellas, el motor con `soloEstrellas`, el velo y los
 * bordes—. Tiene su propio contexto de GL porque sin sesión no está `FondoRaiz`.
 *
 * EN EL IPHONE SE VEÍA NEGRO (16/10) y en la galería no, por dos diferencias con
 * el fondo de la app. Una: la galería (web) tiene debajo del motor la capa fija
 * de estrellas de `FondoEspacial`, y esto tenía solo el motor. Dos: el `GLView`
 * se creaba antes de medir la vista, y en `expo-gl` el buffer queda del tamaño
 * que tenía la vista al crearse. Ahora se crea recién con la medida y con el
 * tope de densidad, como en `FondoRaiz`.
 */
export default function Espacio() {
  const caja = useRef({ w: 0, h: 0 });
  const [medida, setMedida] = useState<{ w: number; h: number } | null>(null);
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
    setMedida({ w: width, h: height });
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

  // La vista del GL achicada por el tope y estirada de vuelta desde el centro (ver `FondoRaiz`).
  const f = factorDeTope();
  const vistaGL = medida && {
    position: 'absolute' as const,
    width: medida.w * f,
    height: medida.h * f,
    left: (medida.w - medida.w * f) / 2,
    top: (medida.h - medida.h * f) / 2,
    transform: [{ scale: 1 / f }],
  };

  return (
    <View style={estilos.raiz} onLayout={alMedir} pointerEvents="none">
      {medida && <ElipsesDeLuz elipses={ELIPSES_BASE} paleta={PALETA} ancho={medida.w} alto={medida.h} estrellas id="entrada-base" />}
      {vistaGL && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacidad }]}>
          <GLView style={vistaGL} onContextCreate={alCrear} />
        </Animated.View>
      )}
      {/* El velo de la app nativa para los rangos de abajo (0,5) y los bordes, como en `FondoRaiz`. */}
      <View style={estilos.velo}>
        {medida && <ElipsesDeLuz elipses={ELIPSES_VELO} paleta={PALETA} ancho={medida.w} alto={medida.h} id="entrada-velo" />}
      </View>
      <LinearGradient
        style={StyleSheet.absoluteFill}
        colors={[conAlfa(FONDO_BASE, 0.8), conAlfa(FONDO_BASE, 0), conAlfa(FONDO_BASE, 0), conAlfa(FONDO_BASE, 0.88)]}
        locations={[0, 0.26, 0.86, 1]}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { ...StyleSheet.absoluteFillObject, backgroundColor: FONDO_BASE },
  velo: { ...StyleSheet.absoluteFillObject, backgroundColor: FONDO_BASE, opacity: 0.5 },
});
