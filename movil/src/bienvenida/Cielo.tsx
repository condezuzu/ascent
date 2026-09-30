import { useCallback, useEffect, useRef } from 'react';
import { PixelRatio, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import type { WebGLRenderer } from 'three';

/**
 * EL CAMPO DE ESTRELLAS de las tres primeras pantallas de la entrada, en GPU
 * (opción C, expo-gl — la decisión del humano contra el SVG achatado y contra
 * Skia). El mismo motor que dibuja los planetas, ya en el binario. La coreografía
 * —posiciones, titileo por-estrella, paralaje por capa— vive en
 * `compartido/motor/cielo.ts`, con la misma matemática que la web
 * (`nucleo/estrellas.ts`). Acá está solo el marco de `expo-gl`.
 *
 * Se queda montado en las tres primeras: `mover(paso)` corre el cielo al cambiar
 * de pantalla, sin recrear el contexto. El primer cuadro es barato (solo puntos),
 * como el del sol.
 */
export default function Cielo({ paso }: { paso: number }) {
  const caja = useRef({ w: 0, h: 0 });
  const avisar = useRef<(() => void)[]>([]);
  const control = useRef<{ mover: (p: number) => void; destruir: () => void } | null>(null);
  const renderer = useRef<WebGLRenderer | null>(null);
  const pasoRef = useRef(paso);
  pasoRef.current = paso;

  useEffect(() => {
    control.current?.mover(paso);
  }, [paso]);

  useEffect(
    () => () => {
      control.current?.destruir();
      renderer.current?.dispose();
      control.current = null;
      renderer.current = null;
    },
    []
  );

  const alMedir = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width === caja.current.w && height === caja.current.h) return;
    caja.current = { w: width, h: height };
    avisar.current.forEach((fn) => fn());
  }, []);

  const alCrear = useCallback(async (gl: ExpoWebGLRenderingContext) => {
    const { crearRenderer, animarCielo } = await import('../motorNativo');
    const r = crearRenderer(gl);
    if (!r) return;
    renderer.current = r;
    control.current = animarCielo(
      {
        renderer: r,
        tamano: () => caja.current,
        densidad: () => {
          const { w } = caja.current;
          return w > 0 ? gl.drawingBufferWidth / w : PixelRatio.get();
        },
        cuadro: (fn) => {
          requestAnimationFrame(fn);
        },
        presentar: () => {
          gl.endFrameEXP();
        },
        alCambiarDeTamano: (fn) => {
          avisar.current.push(fn);
          return () => {
            avisar.current = avisar.current.filter((x) => x !== fn);
          };
        },
      },
      { paso: pasoRef.current }
    );
  }, []);

  return (
    <View style={estilos.raiz} onLayout={alMedir} pointerEvents="none">
      <GLView style={StyleSheet.absoluteFill} onContextCreate={alCrear} />
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { ...StyleSheet.absoluteFillObject, backgroundColor: '#05060a' },
});
