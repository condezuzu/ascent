import * as THREE from 'three';
import { alCambiarDeTamano } from './alCambiarDeTamano';
import { nivelEquipo } from '@/lib/equipo';
import { marca } from '@compartido/medir';
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

// -------------------------------------------------------------------
// SIN GPU DE VERDAD, EL MOTOR NO SE PRENDE (18/9)
//
// Medido con `herramientas/perfilar-bloqueo.mjs`: con WebGL por software
// (SwiftShader) montar el motor bloquea el hilo principal 4,5 s y después
// ~1 s POR CUADRO, mientras siga prendido. La página no atiende un toque en
// 7-20 s. Con la GPU de la misma máquina: ninguna tarea larga. No es el
// motor, es dibujarlo con la CPU. Le pasa a quien no tiene GPU que el
// navegador acepte: máquinas virtuales, escritorio remoto, placas en la
// lista negra de Chrome. En esos casos queda el fondo de CSS, que es para lo
// que está.
//
// TRES FILTROS, porque preguntarle al navegador no alcanza, y se equivoca
// para los dos lados:
//
//   1. `failIfMajorPerformanceCaveat`: el navegador no da contexto si sabe
//      que va a ser lento. Si se niega, se mira QUÉ renderizador hay: si es
//      uno por software, se apaga; si nombra una GPU de verdad, hay duda, y
//      se prende igual (Chrome a veces lo reporta mal).
//   2. EL NOMBRE SE MIRA SIEMPRE, también cuando dio contexto: el Chromium de
//      las sondas lo dio con SwiftShader aunque se pidió el caveat.
//   3. SE MIDEN LOS PRIMEROS CUADROS, siempre. Si la mediana pasa de LENTO_MS
//      se apaga. Es lo que decide de verdad, y lo que cubre una GPU real pero
//      incapaz.
//
// Los cuatro casos se prueban con `herramientas/probar-filtro-gpu.mjs`.
//
// La decisión vale para toda la sesión: volver a probar en cada pantalla es
// volver a congelarla.
// -------------------------------------------------------------------
const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;
// Con GPU un cuadro son ~16 ms; con SwiftShader, ~1000. El corte va lejos de
// los dos: una tarea larga de React al montar no puede apagar un teléfono
// bueno, y por eso además es la MEDIANA y no el peor.
const LENTO_MS = 250;
const CUADROS_A_MEDIR = 6;

/** El nombre del renderizador de verdad de un contexto, o '' si no lo dice. */
function nombreDe(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
}

/** Lo mismo, con un contexto de prueba que se suelta en el acto. null = no hay WebGL. */
function nombreDelRenderizador(): string | null {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return null;
    const nombre = nombreDe(gl);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return nombre;
  } catch {
    return null;
  }
}

function crearRenderer(c: HTMLCanvasElement, exigente: boolean) {
  return new THREE.WebGLRenderer({
    canvas: c,
    alpha: true,
    antialias: nivelEquipo() !== 'bajo',
    powerPreference: 'high-performance',
    failIfMajorPerformanceCaveat: exigente,
  });
}

function sinGpu(): null {
  marca('ascent:motor-sin-gpu');
  rendererRoto = true; // queda el fondo de CSS solo
  return null;
}

function obtenerRenderer(): { renderer: THREE.WebGLRenderer; lienzo: HTMLCanvasElement } | null {
  if (rendererRoto) return null;
  if (renderer && lienzo) return { renderer, lienzo };
  const c = document.createElement('canvas');
  c.style.width = '100%';
  c.style.height = '100%';
  c.style.display = 'block';
  let r: THREE.WebGLRenderer;
  try {
    r = crearRenderer(c, true);
  } catch {
    const nombre = nombreDelRenderizador();
    if (nombre === null || SOFTWARE.test(nombre)) return sinGpu();
    // El navegador se negó pero nombra una GPU: la medición de cuadros decide.
    marca('ascent:motor-gpu-en-duda');
    try {
      r = crearRenderer(c, false);
    } catch {
      rendererRoto = true;
      return null;
    }
  }
  // EL NOMBRE SE MIRA SIEMPRE, no solo cuando el navegador se niega. Medido
  // (18/9, `herramientas/probar-filtro-gpu.mjs`): el Chromium de las sondas
  // dio contexto con SwiftShader aunque se pidió el caveat, y la medición de
  // cuadros, a ~1 s cada uno, tarda en juntar los suyos.
  if (SOFTWARE.test(nombreDe(r.getContext()))) {
    r.dispose();
    r.forceContextLoss();
    return sinGpu();
  }
  renderer = r;
  lienzo = c;
  return { renderer, lienzo };
}

/** Apaga el motor por el resto de la sesión y deja el fondo de CSS. */
function apagarPorLento() {
  marca('ascent:motor-lento');
  rendererRoto = true;
  lienzo?.remove();
  renderer?.dispose();
  renderer?.forceContextLoss();
  renderer = null;
  lienzo = null;
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
  // `soltar` puede llegar dos veces: una del apagado por lento y otra de la
  // pantalla al desmontarse. La segunda no hace nada.
  let soltado = false;
  const soltar = () => {
    if (soltado) return;
    soltado = true;
    montaje.soltar();
  };
  const alSerLento = () => {
    soltar();
    apagarPorLento();
  };
  const montaje = montarEscena(lienzoWeb(contenedor, rr.renderer, vigilarCuadros(alSerLento)), op);
  return { ...montaje, soltar };
}

/**
 * Mide los primeros cuadros después de montar y avisa si van lentos. Se
 * saltea el primero (arrastra el montaje) y no cuenta con la pestaña
 * escondida, donde el navegador frena los cuadros a propósito.
 */
function vigilarCuadros(alSerLento: () => void) {
  if (rendererRoto) return () => {};
  const intervalos: number[] = [];
  let previo = -1;
  let terminado = false;
  return (t: number) => {
    if (terminado) return;
    if (document.hidden) {
      previo = -1;
      return;
    }
    if (previo >= 0) intervalos.push(t - previo);
    previo = t;
    if (intervalos.length < CUADROS_A_MEDIR + 1) return;
    terminado = true;
    const orden = intervalos.slice(1).sort((a, b) => a - b);
    const mediana = orden[Math.floor(orden.length / 2)];
    if (mediana > LENTO_MS) alSerLento();
  };
}

function lienzoWeb(contenedor: HTMLElement, renderer: THREE.WebGLRenderer, vigia: (t: number) => void): Lienzo {
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
      requestAnimationFrame((t) => {
        vigia(t);
        fn(t);
      });
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
