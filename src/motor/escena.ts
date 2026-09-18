import * as THREE from 'three';
import { alCambiarDeTamano } from './alCambiarDeTamano';
import { nivelEquipo } from '@/lib/equipo';
import { montarEscena, type Lienzo, type Montaje, type OpcionesFondo } from '@compartido/motor/escena';

// EL MOTOR EN LA WEB: el adaptador.
//
// El motor vive en `compartido/motor/escena.ts` desde el 18/9, y se comparte
// con la app nativa. Lo que queda acá es lo único que la web resuelve a su
// manera: un `<canvas>` en el DOM, la densidad de la pantalla, los eventos que
// despiertan al motor y el tamaño del contenedor. Todo eso entra al núcleo por
// un `Lienzo`.
//
// La firma de `montarFondo` no cambió con la mudanza, a propósito:
// `FondoEspacial` y el resto de la web lo siguen llamando igual.

export type { Estilo, Lienzo, Montaje, Nivel, OpcionesFondo } from '@compartido/motor/escena';
export { nivelEquipo };

function dpr(): number {
  return Math.min(window.devicePixelRatio || 1, 2);
}

// -------------------------------------------------------------------
// RENDERER COMPARTIDO
// Crear un WebGLRenderer por pantalla significaba crear un contexto WebGL
// nuevo y, sobre todo, recompilar los shaders desde cero en cada montaje.
// Con uno solo para toda la app, el programa se compila una única vez y el
// resto de las pantallas lo reusan: el canvas se muda de contenedor.
// -------------------------------------------------------------------
let renderer: THREE.WebGLRenderer | null = null;
let lienzo: HTMLCanvasElement | null = null;
let rendererRoto = false;

function obtenerRenderer(): { renderer: THREE.WebGLRenderer; lienzo: HTMLCanvasElement } | null {
  if (rendererRoto) return null;
  if (renderer && lienzo) return { renderer, lienzo };
  try {
    const c = document.createElement('canvas');
    c.style.width = '100%';
    c.style.height = '100%';
    c.style.display = 'block';
    const r = new THREE.WebGLRenderer({
      canvas: c,
      alpha: true,
      antialias: nivelEquipo() !== 'bajo',
      powerPreference: 'high-performance',
    });
    renderer = r;
    lienzo = c;
    return { renderer: r, lienzo: c };
  } catch {
    rendererRoto = true; // sin WebGL: queda el fondo de CSS solo
    return null;
  }
}

/**
 * Arma la escena del rango dentro de `contenedor` y devuelve cómo soltarla.
 * El renderer y el canvas son compartidos: no se destruyen, se reusan en la
 * próxima pantalla.
 */
export function montarFondo(contenedor: HTMLElement, op: OpcionesFondo): Montaje | null {
  const rr = obtenerRenderer();
  if (!rr) return null;
  contenedor.appendChild(rr.lienzo);
  return montarEscena(lienzoWeb(contenedor, rr.renderer), op);
}

function lienzoWeb(contenedor: HTMLElement, renderer: THREE.WebGLRenderer): Lienzo {
  // LO QUE DESPIERTA AL MOTOR. Son escuchas pasivas que solo anotan la hora:
  // no leen el evento ni tocan el DOM, así que no estorban al scroll.
  //
  // `pointermove` entra a propósito aunque parezca ruido: en una computadora
  // mover el mouse es alguien que está ahí, y el costo es escribir un
  // número. En un teléfono no se dispara si nadie toca.
  const SENALES = ['pointerdown', 'pointermove', 'touchstart', 'wheel', 'keydown', 'scroll'] as const;
  return {
    renderer,
    tamano: () => ({
      w: contenedor.clientWidth || window.innerWidth,
      h: contenedor.clientHeight || window.innerHeight,
    }),
    densidad: dpr,
    nivel: nivelEquipo,
    cuadro: (fn) => {
      requestAnimationFrame(fn);
    },
    // El navegador presenta solo cada cuadro que se dibuja en un canvas.
    presentar: () => {},
    alDespertar: (fn) => {
      for (const s of SENALES) window.addEventListener(s, fn, { passive: true });
      return () => {
        for (const s of SENALES) window.removeEventListener(s, fn);
      };
    },
    // La caja del contenedor, no solo la ventana: ver `alCambiarDeTamano`.
    alCambiarDeTamano: (fn) => alCambiarDeTamano(contenedor, fn),
  };
}
