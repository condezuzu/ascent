import * as THREE from 'three';
import { alCambiarDeTamano } from './alCambiarDeTamano';
import { colorDeRango } from './subida';
import { N, formaDeRango, extension, escalaParaEntrar } from '@/lib/subida';
import { cuadroEn, cuadroQuietoEn, DURACION_S, DURACION_QUIETA_S, RANGOS_DE_LA_ENTRADA, type CuadroDeLaEntrada } from '@/lib/bienvenida';

/**
 * LA CUARTA PANTALLA DE LA ENTRADA: los ocho objetos, uno detrás de otro, cada
 * vez más rápido, y el agujero negro tragándose la pantalla.
 *
 * LOS TIEMPOS NO ESTÁN ACÁ. Están en `lib/bienvenida.ts`, probados con
 * números; acá queda lo que necesita una GPU delante. Es la misma división que
 * en la subida de rango, y por la misma razón: las capturas no ven
 * animaciones.
 *
 * LAS FORMAS SON LAS DE SIEMPRE (`formaDeRango`): el polvo de la entrada tiene
 * que ser el mismo polvo que ve alguien con un día de racha, o la entrada
 * estaría prometiendo otra app.
 *
 * SIN DISPERSIÓN, a diferencia de la subida: cada partícula viaja derecho de
 * su lugar en una forma a su lugar en la siguiente. Con tramos de medio
 * segundo, desarmar y rearmar se ve como ruido; el viaje directo se lee.
 */

/** Cuánto sube el brillo cuando el objeto termina de formarse. */
const DESTELLO = 0.35;

export type Entrada = {
  /** Un número de 0 a 1: para el número de la racha y el velo negro. */
  alCuadro: (c: CuadroDeLaEntrada) => void;
  saltar: () => void;
  destruir: () => void;
};

export function animarEntrada(
  canvas: HTMLCanvasElement,
  op: {
    /** Multiplica el tiempo: 0,5 lo pone al doble de lento (galería). */
    velocidad?: number;
    /** La versión sin recorrido, para "reducir movimiento". */
    quieta?: boolean;
    alCuadro?: (c: CuadroDeLaEntrada) => void;
    alTerminar?: () => void;
    /**
     * De dónde sale el tiempo. Por omisión, el reloj. Devolver un número lo
     * CONGELA en ese segundo: es lo que hace posible mirar la animación cuadro
     * a cuadro y, sobre todo, fotografiarla — un navegador sin cabeza corre
     * `requestAnimationFrame` a un cuadro por segundo y una captura del
     * segundo 3 sale donde caiga (ver `spec/trampas.md`).
     */
    reloj?: () => number | null;
  } = {}
): Entrada | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    // Sin WebGL no hay nada que hacer acá: la pantalla tiene su versión sin
    // motor y es la que corresponde mostrar.
    return null;
  }

  const escena = new THREE.Scene();
  const camara = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camara.position.z = 2;

  // Las ocho formas, una sola vez: crearlas en medio de la animación sería un
  // tirón de 900 partículas justo cuando hay que cambiar de objeto.
  const formas = RANGOS_DE_LA_ENTRADA.map((r) => formaDeRango(r));
  const escalas = formas.map((f) => ({ ext: extension(f), escala: 1 }));
  const colores = RANGOS_DE_LA_ENTRADA.map((r) => colorDeRango(r));

  const actual = new Float32Array(formas[0]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(actual, 3));
  const mat = new THREE.PointsMaterial({
    size: 2.2 * Math.min(window.devicePixelRatio || 1, 2),
    color: colores[0].clone(),
    transparent: true,
    opacity: 0,
    sizeAttenuation: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const nube = new THREE.Points(geo, mat);
  escena.add(nube);

  function medir() {
    const w = canvas.clientWidth || 400;
    const h = canvas.clientHeight || 700;
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const aspecto = w / h;
    camara.left = -aspecto;
    camara.right = aspecto;
    camara.updateProjectionMatrix();
    // Cada forma entra en ESTA pantalla: el sol y la galaxia se salen por los
    // costados de un teléfono vertical si se las deja como fueron diseñadas.
    for (const e of escalas) e.escala = escalaParaEntrar(e.ext, aspecto);
  }
  medir();
  const soltarTamano = alCambiarDeTamano(canvas, medir);

  const duracion = op.quieta ? DURACION_QUIETA_S : DURACION_S;
  const dameCuadro = op.quieta ? cuadroQuietoEn : cuadroEn;
  const velocidad = op.velocidad && op.velocidad > 0 ? op.velocidad : 1;

  let arranque = performance.now();
  let saltado = false;
  let vivo = true;
  let pedido = 0;

  function pintar(ahora: number) {
    if (!vivo) return;
    pedido = requestAnimationFrame(pintar);
    // NUNCA se acumula el tiempo: se pregunta dónde corresponde estar. Un
    // cuadro perdido no arrastra el retraso hasta el final.
    const fijo = op.reloj?.();
    const t = fijo !== null && fijo !== undefined ? fijo : saltado ? duracion : ((ahora - arranque) / 1000) * velocidad;
    const c = dameCuadro(t);
    op.alCuadro?.(c);

    const i = Math.max(0, RANGOS_DE_LA_ENTRADA.indexOf(c.desde as 1));
    const j = Math.max(0, RANGOS_DE_LA_ENTRADA.indexOf(c.hasta as 1));
    const desde = formas[i];
    const hasta = formas[j];
    const m = c.mezcla;
    const escala = escalas[i].escala + (escalas[j].escala - escalas[i].escala) * m;
    // El trago: el objeto se cierra sobre sí mismo hasta desaparecer.
    const cierre = 1 - c.trago;

    for (let k = 0; k < N * 3; k++) {
      actual[k] = (desde[k] + (hasta[k] - desde[k]) * m) * escala * cierre;
    }
    geo.attributes.position.needsUpdate = true;

    mat.color.copy(colores[i]).lerp(colores[j], m);
    // Un respiro de luz cada vez que la forma termina de armarse: es lo que
    // hace que la aceleración se SIENTA además de verse.
    const brillo = 1 + DESTELLO * Math.max(0, m - 0.8) * 5;
    mat.color.multiplyScalar(brillo);
    // Aparece con un fundido y se va con el trago. Nunca aparece de golpe:
    // esta es la primera imagen de la app.
    mat.opacity = Math.min(1, t * 1.4) * (1 - c.trago);
    // Gira despacio y se acelera con el número: la rotación es la única pista
    // de que el objeto es una cosa en el espacio y no un dibujo.
    nube.rotation.z = t * 0.06 + c.racha * 0.004;

    renderer.render(escena, camara);
    if (c.fin && (fijo === null || fijo === undefined)) {
      vivo = false;
      cancelAnimationFrame(pedido);
      op.alTerminar?.();
    }
  }
  pedido = requestAnimationFrame(pintar);

  return {
    alCuadro: () => {},
    saltar: () => {
      saltado = true;
    },
    destruir: () => {
      vivo = false;
      cancelAnimationFrame(pedido);
      soltarTamano();
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    },
  };
}
