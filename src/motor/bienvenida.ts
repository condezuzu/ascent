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

/**
 * CUÁNTO GIRA CADA OBJETO, en vueltas por segundo.
 *
 * No es decoración: es lo que hace que el asteroide se lea como una piedra
 * dando tumbos y la galaxia como algo enorme y lento. Un objeto quieto es un
 * dibujo; uno que gira parejo es una cosa en el espacio.
 */
const GIRO: Record<number, number> = {
  1: 0.02,
  2: 0.5, // el asteroide es el que más gira: es una piedra suelta
  3: 0.05,
  4: 0.06,
  5: 0.04,
  6: 0.05,
  7: 0.03, // la galaxia, lentísima: es la más grande
  8: 0.12,
};

/** Partículas de la estela: van detrás del asteroide, quemándose. */
const ESTELA = 90;

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

  // LA ESTELA DEL ASTEROIDE. Una piedra que entra a la atmósfera deja fuego
  // atrás: sin eso el paso del polvo al asteroide es "la nube se juntó" y no
  // "algo cayó". Vive en su propia nube de puntos porque tiene otro color y
  // otra opacidad, y se apaga sola cuando el asteroide deja de ser el objeto.
  const posEstela = new Float32Array(ESTELA * 3);
  const semillaEstela = new Float32Array(ESTELA);
  for (let i = 0; i < ESTELA; i++) semillaEstela[i] = Math.random();
  const geoEstela = new THREE.BufferGeometry();
  geoEstela.setAttribute('position', new THREE.BufferAttribute(posEstela, 3));
  const matEstela = new THREE.PointsMaterial({
    size: 2.6 * Math.min(window.devicePixelRatio || 1, 2),
    color: new THREE.Color('#ff7a1a'),
    transparent: true,
    opacity: 0,
    sizeAttenuation: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  escena.add(new THREE.Points(geoEstela, matEstela));

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
  let anterior = arranque;
  let vueltas = 0;
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
    // EL TRAGO DE LA CÁMARA: el agujero no se achica, CRECE hasta pasar por
    // encima de quien mira. Por eso se agranda y se desvanece a la vez: lo
    // último que se ve es el borde saliéndose de la pantalla.
    const cierre = 1 + c.trago * 5;

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
    // Cada objeto gira a SU ritmo, y en el cambio se interpola: si el giro
    // saltara de golpe, el cambio de forma se vería como un tirón.
    const giro = (GIRO[c.desde] ?? 0.05) + ((GIRO[c.hasta] ?? 0.05) - (GIRO[c.desde] ?? 0.05)) * m;
    vueltas += giro * Math.max(0, Math.min(0.1, (ahora - anterior) / 1000)) * velocidad * Math.PI * 2;
    anterior = ahora;
    nube.rotation.z = vueltas;

    // La estela: solo mientras el asteroide es el objeto, y más fuerte cuando
    // termina de formarse. Sale del centro hacia atrás, abriéndose.
    const esAsteroide = (c.hasta === 2 ? m : 0) + (c.desde === 2 ? 1 - m : 0);
    matEstela.opacity = esAsteroide * 0.75 * (1 - c.trago);
    if (matEstela.opacity > 0.01) {
      const largo = 0.75 * escala;
      for (let k = 0; k < ESTELA; k++) {
        const s = semillaEstela[k];
        // Cada partícula corre por la cola a su ritmo y vuelve a empezar: es
        // fuego saliendo, no una línea pintada.
        const avance = (t * (0.5 + s) * 0.9) % 1;
        const d = 0.12 * escala + avance * largo;
        const abre = avance * 0.13 * escala;
        posEstela[k * 3] = -Math.cos(vueltas * 0.2) * d + (s - 0.5) * abre;
        posEstela[k * 3 + 1] = -0.35 * d + (s - 0.5) * abre * 0.6;
        posEstela[k * 3 + 2] = 0;
      }
      geoEstela.attributes.position.needsUpdate = true;
    }

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
      geoEstela.dispose();
      matEstela.dispose();
      renderer.dispose();
    },
  };
}
