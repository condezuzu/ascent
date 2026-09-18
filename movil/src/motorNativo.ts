import * as THREE from 'three';
import { PixelRatio } from 'react-native';
import type { ExpoWebGLRenderingContext } from 'expo-gl';
import { montarEscena, type Lienzo, type Montaje, type OpcionesFondo } from '@compartido/motor/escena';
import { eventos } from '@compartido/eventos';
import { DESPERTAR_MOTOR } from './despertarMotor';

/**
 * EL MOTOR EN LA APP NATIVA: el adaptador de `expo-gl`.
 *
 * El motor es el MISMO que el de la web (`compartido/motor/escena.ts`). Lo que
 * cambia es solo cómo se le arma el `Lienzo`, y es todo lo que hay acá.
 *
 * Se importa TARDE, desde `FondoEspacial`, con `import()`: three.js es pesado
 * de evaluar y en la web costaba tres segundos de arranque medidos. Acá el
 * paquete viaja entero adentro de la app, pero evaluarlo recién cuando se
 * monta el fondo sigue siendo la diferencia entre ver la racha enseguida o no.
 *
 * LO QUE ESTO NO SABE TODAVÍA, porque solo se sabe con un iPhone en la mano:
 *
 *   - Si alcanza el fps. El framebuffer de `expo-gl` es de resolución
 *     completa (3x en un iPhone), y la web lo topa en 2x para no cocinar la
 *     GPU. Acá no hay un tope fácil: la densidad tiene que coincidir con el
 *     buffer o la escena sale en una esquina.
 *   - Si three.js 0.176 anda sobre el WebGL 2 de `expo-gl`. Mirado en el
 *     código de `expo-gl`: le faltan `texStorage2D`, `vertexAttribIPointer`,
 *     `blitFramebuffer` y el multisample, y esta escena no usa ninguno (sin
 *     texturas, sin atributos enteros, sin render targets). Sobre el papel
 *     alcanza. Nada más.
 *   - Qué pasa con el contexto al mandar la app al fondo y volver.
 */

export type Caja = {
  /** El tamaño en puntos, el que da `onLayout`. */
  tamano: () => { w: number; h: number };
  /** Avisa cuando `onLayout` trae un tamaño nuevo. */
  alCambiar: (fn: () => void) => () => void;
};

export function montarEnGL(
  gl: ExpoWebGLRenderingContext,
  caja: Caja,
  op: OpcionesFondo
): Montaje | null {
  try {
    // three.js pide un canvas para medir y colgarle escuchas. `expo-gl` no
    // tiene uno: tiene un contexto. Esto es lo mínimo que three lee de un
    // canvas cuando el contexto ya viene hecho — el tamaño del buffer y dos
    // funciones que no hacen nada, porque acá no hay eventos de contexto
    // perdido a los que suscribirse.
    const canvas = {
      width: gl.drawingBufferWidth,
      height: gl.drawingBufferHeight,
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {},
      clientWidth: gl.drawingBufferWidth,
      clientHeight: gl.drawingBufferHeight,
      getContext: () => gl,
    } as unknown as HTMLCanvasElement;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      context: gl as unknown as WebGL2RenderingContext,
      alpha: true,
      // Sin antialias: en `expo-gl` es un render target con multisample, y el
      // multisample es justo una de las cosas que `expo-gl` no implementa.
      antialias: false,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);

    const lienzo: Lienzo = {
      renderer,
      tamano: caja.tamano,
      // LA DENSIDAD ES LA DEL BUFFER, NO UNA ELEGIDA. El buffer de `expo-gl`
      // ya tiene su tamaño en píxeles físicos; si la densidad no coincide,
      // three dibuja en un viewport más chico y la escena queda en una
      // esquina. Por eso no se topa en 2 como en la web — ver arriba.
      densidad: () => {
        const { w } = caja.tamano();
        return w > 0 ? gl.drawingBufferWidth / w : PixelRatio.get();
      },
      // Ante la duda, el del medio: es la misma regla que la web
      // (`src/lib/equipo.ts`) cuando el navegador no dice nada. Castigar por
      // falta de dato dejaría sin fondo a un teléfono bueno.
      nivel: () => 'medio',
      cuadro: (fn) => {
        requestAnimationFrame(fn);
      },
      // En `expo-gl` el cuadro dibujado NO se muestra solo: hay que decirle
      // que terminó. Sin esto, el motor dibuja y la pantalla queda negra.
      presentar: () => {
        gl.endFrameEXP();
      },
      alDespertar: (fn) => eventos.escuchar(DESPERTAR_MOTOR, () => fn()),
      alCambiarDeTamano: caja.alCambiar,
    };

    return montarEscena(lienzo, op);
  } catch (e) {
    // Sin motor queda el fondo plano, que es exactamente lo que había antes.
    // Se avisa en la consola y no en la pantalla: no hay nada que la persona
    // pueda hacer con el mensaje.
    console.warn('No se pudo montar el motor:', e);
    return null;
  }
}
