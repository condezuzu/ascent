import * as THREE from 'three';
import { alCambiarDeTamano } from './alCambiarDeTamano';
import { animarEntrada as animar, type Entrada } from '@compartido/motor/bienvenida';
import type { CuadroDeLaEntrada } from '@nucleo/bienvenida';

/**
 * LA ENTRADA EN LA WEB: el adaptador, y nada más.
 *
 * La coreografía —los ocho objetos y el agujero que traga— vive en
 * `compartido/motor/bienvenida.ts`, compartida con la app nativa (se partió el
 * 30/9, igual que la subida de rango). Acá queda lo único del navegador: crear
 * el renderer sobre un `<canvas>`, medir con `ResizeObserver` y la densidad.
 */

export type { Entrada };

export function animarEntrada(
  canvas: HTMLCanvasElement,
  op: {
    velocidad?: number;
    quieta?: boolean;
    alCuadro?: (c: CuadroDeLaEntrada) => void;
    alTerminar?: () => void;
    reloj?: () => number | null;
    particulas?: number;
    /** Píxeles por punto (equipo flojo). En el lienzo compartido es `densidad`. */
    pixeles?: number;
  } = {}
): Entrada | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    // Sin WebGL no hay nada que hacer: la pantalla tiene su versión sin motor.
    return null;
  }

  const control = animar(
    {
      renderer,
      tamano: () => ({ w: canvas.clientWidth, h: canvas.clientHeight }),
      densidad: () => op.pixeles ?? Math.min(window.devicePixelRatio || 1, 2),
      cuadro: (fn) => {
        requestAnimationFrame(fn);
      },
      presentar: () => {},
      alCambiarDeTamano: (fn) => alCambiarDeTamano(canvas, fn),
    },
    { velocidad: op.velocidad, quieta: op.quieta, alCuadro: op.alCuadro, alTerminar: op.alTerminar, reloj: op.reloj, particulas: op.particulas }
  );

  return {
    saltar: control.saltar,
    destruir() {
      control.destruir();
      // EL RENDERER ES DE ACÁ: lo creó este archivo, lo suelta este archivo.
      renderer.dispose();
    },
  };
}
