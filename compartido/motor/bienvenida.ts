import * as THREE from 'three';
import { colorDeRango, type LienzoSubida } from './subida';
import { N, formaDeRango, extension, escalaParaEntrar } from '@nucleo/subida';
import { cuadroEn, cuadroQuietoEn, DURACION_S, DURACION_QUIETA_S, RANGOS_DE_LA_ENTRADA, type CuadroDeLaEntrada } from '@nucleo/bienvenida';

/**
 * LA CUARTA PANTALLA DE LA ENTRADA, COMPARTIDA: los ocho objetos, uno detrás de
 * otro cada vez más rápido, y el agujero negro tragándose la pantalla.
 *
 * Se partió de `src/motor/bienvenida.ts` el 30/9 para portarla al teléfono, igual
 * que se hizo con la subida de rango (`compartido/motor/subida.ts`). Lo del
 * navegador se le pide ahora al `Lienzo`: el renderer, el tamaño, la densidad, el
 * pedido de cuadro, el aviso de tamaño y —lo que no existía en la web—
 * `l.presentar()`, sin el cual `expo-gl` deja la pantalla negra.
 *
 * EL RENDERER NO SE DESTRUYE ACÁ: lo suelta quien lo creó (la misma regla que
 * `animarSubida`). Los tiempos y las curvas siguen en `nucleo/bienvenida.ts`.
 */

/** Cuánto sube el brillo cuando el objeto termina de formarse. */
const DESTELLO = 0.35;

/** Cuánto gira cada objeto, en vueltas por segundo. El agujero negro no gira. */
const GIRO: Record<number, number> = { 1: 0.02, 2: 0.16, 3: 0.05, 4: 0.06, 5: 0.04, 6: 0.05, 7: 0.03, 8: 0 };

export type Entrada = { saltar: () => void; destruir: () => void };

export function animarEntrada(
  l: LienzoSubida,
  op: {
    velocidad?: number;
    quieta?: boolean;
    alCuadro?: (c: CuadroDeLaEntrada) => void;
    alTerminar?: () => void;
    /** Devolver un número CONGELA el tiempo en ese segundo (para capturas). */
    reloj?: () => number | null;
    particulas?: number;
  } = {}
): Entrada {
  const renderer = l.renderer;
  const escena = new THREE.Scene();
  const camara = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camara.position.z = 2;

  // Las ocho formas, una sola vez. `cuantas` depende del equipo: mover 900
  // partículas por cuadro es lo más caro en un teléfono viejo.
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
    size: 2.2 * l.densidad(),
    color: colores[0].clone(),
    transparent: true,
    opacity: 0,
    sizeAttenuation: false,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
  });
  const nube = new THREE.Points(geo, mat);
  escena.add(nube);

  // El horizonte del agujero negro: un disco NEGRO y OPACO que tapa la mitad de
  // atrás del disco de acreción (el material es aditivo y sin esto el objeto se
  // ve transparente). Se dibuja antes y escribe profundidad.
  const horizonte = new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 64),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 })
  );
  horizonte.position.z = 0;
  horizonte.renderOrder = -1;
  escena.add(horizonte);

  function medir() {
    const { w, h } = l.tamano();
    const ancho = w || 400;
    const alto = h || 700;
    renderer.setSize(ancho, alto, false);
    renderer.setPixelRatio(l.densidad());
    const aspecto = ancho / alto;
    camara.left = -aspecto;
    camara.right = aspecto;
    camara.updateProjectionMatrix();
    for (const e of escalas) e.escala = escalaParaEntrar(e.ext, aspecto);
  }
  medir();
  const soltarTamano = l.alCambiarDeTamano(medir);

  const duracion = op.quieta ? DURACION_QUIETA_S : DURACION_S;
  const dameCuadro = op.quieta ? cuadroQuietoEn : cuadroEn;
  const velocidad = op.velocidad && op.velocidad > 0 ? op.velocidad : 1;

  let arranque = 0;
  let anterior = 0;
  let vueltas = 0;
  let saltado = false;
  let vivo = true;

  function pintar(ahora: number) {
    if (!vivo) return;
    if (arranque === 0) {
      arranque = ahora;
      anterior = ahora;
    }
    l.cuadro(pintar);
    // NUNCA se acumula el tiempo: se pregunta dónde corresponde estar.
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
    // EL TRAGO DE LA CÁMARA: el agujero CRECE hasta pasar por encima de quien
    // mira; se agranda y se desvanece a la vez.
    const cierre = 1 + c.trago * 5;

    for (let k = 0; k < cuantas * 3; k++) {
      actual[k] = (desde[k] + (hasta[k] - desde[k]) * m) * escala * cierre;
    }
    geo.attributes.position.needsUpdate = true;

    mat.color.copy(colores[i]).lerp(colores[j], m);
    const brillo = 1 + DESTELLO * Math.max(0, m - 0.8) * 5;
    mat.color.multiplyScalar(brillo);
    mat.opacity = Math.min(1, t * 1.4) * (1 - c.trago);
    const giro = (GIRO[c.desde] ?? 0.05) + ((GIRO[c.hasta] ?? 0.05) - (GIRO[c.desde] ?? 0.05)) * m;
    vueltas += giro * Math.max(0, Math.min(0.1, (ahora - anterior) / 1000)) * velocidad * Math.PI * 2;
    anterior = ahora;
    nube.rotation.z = vueltas;

    const esAgujero = (c.hasta === 7 ? m : 0) + (c.desde === 7 ? 1 - m : 0);
    const matHorizonte = horizonte.material as THREE.MeshBasicMaterial;
    matHorizonte.opacity = esAgujero * (1 - c.trago);
    horizonte.visible = matHorizonte.opacity > 0.01;
    horizonte.scale.setScalar(escala * cierre);

    renderer.render(escena, camara);
    l.presentar();
    if (c.fin && (fijo === null || fijo === undefined)) {
      vivo = false;
      op.alTerminar?.();
    }
  }
  l.cuadro(pintar);

  return {
    saltar: () => {
      saltado = true;
    },
    destruir: () => {
      vivo = false;
      soltarTamano();
      geo.dispose();
      mat.dispose();
      horizonte.geometry.dispose();
      (horizonte.material as THREE.Material).dispose();
      // El renderer NO se suelta acá: es de quien lo creó (el fondo en nativo).
    },
  };
}
