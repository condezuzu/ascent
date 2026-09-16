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
  2: 0.16, // la piedra da tumbos, pero sin estela: era una nube (15/9)
  3: 0.05,
  4: 0.06,
  5: 0.04,
  6: 0.05,
  7: 0.03, // la galaxia, lentísima: es la más grande
  // EL AGUJERO NEGRO NO GIRA. Girándolo, el disco inclinado se convertía en un
  // iris dando vueltas. Quieto e inclinado, lo que se lee es el volumen: una
  // mitad del disco pasa por delante del horizonte y la otra por detrás.
  8: 0,
};

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
    /** Cuántas partículas dibujar. Por omisión, todas. */
    particulas?: number;
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
  //
  // CUÁNTAS depende del equipo (`particulasPara`): en un teléfono viejo, mover
  // novecientas en cada cuadro cuesta más que todo lo demás junto. Se toma una
  // de cada `salto` de la forma completa —no las primeras— para que la forma
  // recortada siga siendo la misma forma y no media.
  const cuantas = op.particulas && op.particulas > 0 ? Math.min(N, Math.round(op.particulas)) : N;
  const salto = Math.max(1, Math.floor(N / cuantas));
  const recortar = (f: Float32Array) => {
    if (salto === 1) return f;
    const chica = new Float32Array(cuantas * 3);
    for (let k = 0; k < cuantas; k++) {
      const o = ((k * salto) % N) * 3;
      chica[k * 3] = f[o];
      chica[k * 3 + 1] = f[o + 1];
      chica[k * 3 + 2] = f[o + 2];
    }
    return chica;
  };
  const formas = RANGOS_DE_LA_ENTRADA.map((r) => recortar(formaDeRango(r)));
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
    // Las partículas SE TAPAN con el horizonte —por eso se prueba la
    // profundidad— pero no se tapan entre ellas, que las apagaría unas a otras.
    depthTest: true,
    depthWrite: false,
  });
  const nube = new THREE.Points(geo, mat);
  escena.add(nube);

  // EL HORIZONTE DEL AGUJERO NEGRO: un disco NEGRO y OPACO en el medio. No es
  // decoración: es lo que tapa la mitad de atrás del disco de acreción. Sin él
  // las partículas de atrás se suman a las de adelante —el material es
  // aditivo— y el objeto se ve transparente, como un ojo.
  //
  // Se dibuja ANTES que las partículas y escribe profundidad: el orden lo
  // decide la GPU, no nosotros.
  const horizonte = new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 64),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 })
  );
  horizonte.position.z = 0;
  horizonte.renderOrder = -1;
  escena.add(horizonte);

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

    for (let k = 0; k < cuantas * 3; k++) {
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

    // El horizonte aparece con el agujero negro y se va con el trago. Su
    // tamaño acompaña al objeto, o dejaría de tapar lo que tiene que tapar.
    const esAgujero = (c.hasta === 8 ? m : 0) + (c.desde === 8 ? 1 - m : 0);
    const matHorizonte = horizonte.material as THREE.MeshBasicMaterial;
    matHorizonte.opacity = esAgujero * (1 - c.trago);
    horizonte.visible = matHorizonte.opacity > 0.01;
    horizonte.scale.setScalar(escala * cierre);

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
      horizonte.geometry.dispose();
      (horizonte.material as THREE.Material).dispose();
      renderer.dispose();
    },
  };
}
