import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, PixelRatio, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import type { WebGLRenderer } from 'three';
import type { CuadroDeLaEntrada } from '@nucleo/bienvenida';

/**
 * LA ENTRADA (bienvenida) EN EL TELÉFONO: el marco del motor. La coreografía es
 * la misma que la web (`compartido/motor/bienvenida.ts`); acá está de dónde sale
 * cada cosa que aquel le pide al lienzo: el contexto de `expo-gl`, el tamaño de
 * `onLayout`, la densidad del buffer y —lo que no existe en la web—
 * `gl.endFrameEXP()` en `presentar`, sin el cual la pantalla queda negra.
 *
 * TIENE SU PROPIO `GLView`, igual que `LienzoSubida`: la bienvenida vive antes de
 * la sesión, cuando el `FondoRaiz` todavía no está montado, así que no hay un
 * contexto de fondo que reusar. Es un shader simple de `Points`, compilado una
 * vez, en un momento que pasa una vez por login.
 */
export default function LienzoBienvenida({
  quieta,
  alCuadro,
  alTerminar,
  alArrancar,
}: {
  quieta?: boolean;
  /** Cada cuadro: da el número de la racha y el velo del trago. */
  alCuadro?: (c: CuadroDeLaEntrada) => void;
  alTerminar?: () => void;
  /** Entrega cómo saltear apenas arranca (tocar la pantalla la termina). */
  alArrancar?: (saltar: () => void) => void;
}) {
  const caja = useRef({ w: 0, h: 0 });
  const avisar = useRef<(() => void)[]>([]);
  const animacion = useRef<{ saltar: () => void; destruir: () => void } | null>(null);
  const renderer = useRef<WebGLRenderer | null>(null);
  const cuadroRef = useRef(alCuadro);
  cuadroRef.current = alCuadro;
  const terminar = useRef(alTerminar);
  terminar.current = alTerminar;

  useEffect(
    () => () => {
      animacion.current?.destruir();
      renderer.current?.dispose();
      animacion.current = null;
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

  const alCrearContexto = useCallback(
    async (gl: ExpoWebGLRenderingContext) => {
      const { crearRenderer, animarEntrada } = await import('./motorNativo');
      const r = crearRenderer(gl);
      if (!r) {
        terminar.current?.();
        return;
      }
      renderer.current = r;
      const reducido = quieta ?? (await AccessibilityInfo.isReduceMotionEnabled().catch(() => false));
      const control = animarEntrada(
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
        {
          quieta: reducido,
          alCuadro: (c) => cuadroRef.current?.(c),
          alTerminar: () => terminar.current?.(),
        }
      );
      animacion.current = control;
      alArrancar?.(control.saltar);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quieta]
  );

  return (
    <View style={estilos.todo} onLayout={alMedir} pointerEvents="none">
      <GLView style={estilos.todo} onContextCreate={alCrearContexto} />
    </View>
  );
}

const estilos = StyleSheet.create({
  todo: { ...StyleSheet.absoluteFillObject },
});
