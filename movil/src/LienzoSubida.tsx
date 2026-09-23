import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, PixelRatio, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import type { WebGLRenderer } from 'three';

/**
 * LA COREOGRAFÍA DE LA SUBIDA, EN EL TELÉFONO: el objeto viejo se deshace y
 * el nuevo se arma con sus partículas.
 *
 * Es el mismo archivo que la web (`compartido/motor/subida.ts`); esto es el
 * marco. Lo único de acá es de dónde sale cada cosa que aquel le pide al
 * lienzo: el contexto de `expo-gl`, el tamaño de `onLayout`, la densidad del
 * buffer y el movimiento reducido del sistema.
 *
 * ─────────────────────────────────────────────────────────────────────
 * TIENE SU PROPIO `GLView`, Y NO EL DE LA RAÍZ
 *
 * `FondoRaiz` mantiene un contexto que dura toda la sesión justamente para no
 * recompilar shaders en cada cambio de pestaña, y la regla general es usar
 * ese. Acá no se puede y no conviene:
 *
 *   - NO SE PUEDE: esto vive adentro de un `Modal`, que en iOS es otra
 *     jerarquía de vistas por encima de todo. El `GLView` de la raíz queda
 *     tapado; no hay forma de dibujar sobre él desde adentro del modal.
 *   - NO CONVIENE: un renderer de three guarda los programas compilados por
 *     CONTEXTO. El de la raíz no sirve para este contexto aunque se lo
 *     pasara.
 *
 * Y el costo es chico: esta escena son `Points` con el material de fábrica de
 * three, no el cuerpo raytraceado del fondo. Es un shader simple, compilado
 * una vez, en un momento que pasa siete veces en la vida de una cuenta.
 *
 * ─────────────────────────────────────────────────────────────────────
 * LA DENSIDAD SALE DEL BUFFER, NO SE ELIGE
 *
 * Misma trampa que el fondo (ver `motorNativo.ts`): el buffer de `expo-gl` ya
 * mide lo que mide la vista en píxeles físicos. Si se le dijera otra densidad,
 * three dibujaría en un viewport más chico y las partículas quedarían en una
 * esquina. Acá no se topa a 2x como en el fondo: son 900 puntos planos, no un
 * cuerpo raytraceado a pantalla completa.
 */
export default function LienzoSubida({
  rangoAntes,
  rangoDespues,
  planeta,
  alArrancar,
  alTerminar,
}: {
  rangoAntes: number;
  rangoDespues: number;
  planeta?: string | null;
  /**
   * Entrega cómo saltear la animación, apenas arranca. Tocar la pantalla
   * antes de tiempo la saltea en vez de no hacer nada: es lo que hace la web,
   * y quedarse mirando algo que no responde al toque se siente colgado.
   */
  alArrancar?: (saltar: () => void) => void;
  alTerminar: () => void;
}) {
  const caja = useRef({ w: 0, h: 0 });
  const avisar = useRef<(() => void)[]>([]);
  const animacion = useRef<{ saltar: () => void; destruir: () => void } | null>(null);
  const renderer = useRef<WebGLRenderer | null>(null);
  // El aviso de terminado se guarda en una ref: el bucle nace una sola vez y
  // no tiene por qué morir porque el padre se vuelva a dibujar.
  const terminar = useRef(alTerminar);
  terminar.current = alTerminar;

  // AL SALIR SE SUELTA TODO, y el renderer también: este contexto es de esta
  // pantalla y muere con ella. Es lo contrario del fondo, donde el renderer
  // sobrevive a propósito para no recompilar shaders.
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
      // Tarde y a propósito, igual que el fondo: three.js es pesado de
      // evaluar y no tiene por qué costar el arranque de la app.
      const { crearRenderer, animarSubida } = await import('./motorNativo');

      const r = crearRenderer(gl);
      if (!r) {
        // Sin motor no hay animación, pero el momento tiene que pasar igual:
        // si esto se quedara mudo, la subida de rango no terminaría nunca y
        // el nombre del rango nuevo no llegaría a aparecer.
        terminar.current();
        return;
      }
      renderer.current = r;

      const reducido = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);

      const control = animarSubida(
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
          // SIN ESTO LA PANTALLA QUEDA NEGRA: en `expo-gl` el cuadro dibujado
          // no se muestra solo, hay que decirle que terminó.
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
          rangoAntes,
          rangoDespues,
          planeta,
          movimientoReducido: reducido,
          alTerminar: () => terminar.current(),
        }
      );
      animacion.current = control;
      alArrancar?.(control.saltar);
    },
    // `alArrancar` queda afuera a propósito: es una función que el padre
    // rearma en cada dibujo, y meterla acá recrearía el contexto de GL —y con
    // él la animación entera— a mitad de la subida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rangoAntes, rangoDespues, planeta]
  );

  return (
    <View style={estilos.todo} onLayout={alMedir} pointerEvents="none">
      {/* El `key` amarra el contexto a ESTA subida: si el componente se
          reusara para otro salto de rango, un contexto viejo dibujaría el
          objeto anterior. */}
      <GLView
        key={`${rangoAntes}-${rangoDespues}`}
        style={estilos.todo}
        onContextCreate={alCrearContexto}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  todo: { ...StyleSheet.absoluteFillObject },
});
