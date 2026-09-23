import * as THREE from 'three';
import { alCambiarDeTamano } from './alCambiarDeTamano';
import { animarSubida as animar, type LienzoSubida } from '@compartido/motor/subida';

/**
 * LA SUBIDA DE RANGO EN LA WEB: el adaptador, y nada más.
 *
 * La coreografía —el objeto viejo deshaciéndose en el nuevo— vive en
 * `compartido/motor/subida.ts`, compartida con la app nativa, y la aritmética
 * en `nucleo/subida.ts`, probada con números. Acá queda lo único que es del
 * navegador: crear el renderer sobre un `<canvas>`, medir con `ResizeObserver`
 * y preguntarle al sistema si quiere movimiento reducido.
 *
 * ESTE ARCHIVO ERA DE 167 LÍNEAS y tenía adentro toda la animación. Se partió
 * el 23/9 para poder portarla al teléfono, donde no había: allá el evento
 * llegaba, se abría la pantalla y el objeto nuevo entraba sin que el viejo se
 * deshiciera. Lo que se movió no se tocó — es la misma animación.
 */

export { N, formaDeRango, colorDeRango } from '@compartido/motor/subida';

export function animarSubida(
  canvas: HTMLCanvasElement,
  rangoAntes: number,
  rangoDespues: number,
  alTerminar: () => void,
  planeta?: string | null
): { saltar: () => void; destruir: () => void } {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    alTerminar();
    return { saltar: () => {}, destruir: () => {} };
  }

  const lienzo: LienzoSubida = {
    renderer,
    tamano: () => ({ w: canvas.clientWidth, h: canvas.clientHeight }),
    // El tope de 2x es el mismo de siempre: un cuerpo a pantalla completa en
    // 3x es lo que calienta un teléfono.
    densidad: () => Math.min(window.devicePixelRatio || 1, 2),
    cuadro: (fn) => {
      requestAnimationFrame(fn);
    },
    // El navegador presenta el cuadro solo. Esto existe por `expo-gl`.
    presentar: () => {},
    alCambiarDeTamano: (fn) => alCambiarDeTamano(canvas, fn),
  };

  const animacion = animar(lienzo, {
    rangoAntes,
    rangoDespues,
    planeta,
    movimientoReducido: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    alTerminar,
  });

  return {
    saltar: animacion.saltar,
    destruir() {
      animacion.destruir();
      // EL RENDERER ES DE ACÁ: lo creó este archivo, lo suelta este archivo.
      // La coreografía compartida no lo toca porque en la app nativa puede
      // ser el del fondo, que vive toda la sesión.
      renderer.dispose();
    },
  };
}
