import * as THREE from 'three';
import { formaDeRango, colorDeRango } from './subida';
import { brilloEn, sigueSalvando, dispersionDesde, posicionesEn } from '@/lib/salvada';
import { marca } from '@/lib/medir';

/**
 * "TE SALVASTE": el objeto del rango se deshace y vuelve a armarse.
 *
 * ES LAS MISMAS PARTÍCULAS QUE LA SUBIDA DE RANGO, a propósito. La app ya
 * tiene un vocabulario: los días registrados son materia, y esa materia se
 * reorganiza cuando subís. Que la racha salvada use el mismo material dice, sin
 * texto, que lo que casi se pierde es eso mismo.
 *
 * LIENZO PROPIO Y NO EL FONDO COMPARTIDO. El motor del fondo tiene UN solo
 * renderer y UN solo canvas que se mudan de pantalla en pantalla: pedirle un
 * segundo montaje le robaría el canvas al fondo y no se lo devolvería. Y hay
 * una razón más fuerte: en un equipo flojo el fondo NO SE CARGA —esa es toda
 * la decisión de `nucleo/fondo.ts`— y este momento no puede depender de que el
 * fondo exista. Acá se monta lo mínimo, se anima una vez y se suelta.
 *
 * LA CURVA NO ESTÁ ACÁ: vive en `lib/salvada.ts`, probada con números. Acá
 * queda solo lo que necesita una GPU delante.
 */
export function animarSalvada(
  canvas: HTMLCanvasElement,
  rango: number,
  planeta: string | null,
  alTerminar: () => void
): { destruir: () => void } {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    // Sin WebGL no hay gesto y no pasa nada: la ventana dice lo mismo con
    // palabras. Lo que no puede es quedarse esperando una animación que no
    // va a llegar.
    alTerminar();
    return { destruir: () => {} };
  }

  const escena = new THREE.Scene();
  const camara = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camara.position.z = 2;

  const base = formaDeRango(rango);
  const actual = new Float32Array(base);
  // Hacia dónde se suelta cada partícula. Direcciones fijas y no ruido por
  // cuadro: el objeto se ABRE y se vuelve a cerrar por el mismo camino, que es
  // lo que hace que se lea como una sola cosa y no como una nube nueva. La
  // cuenta vive en `lib/salvada.ts`, probada con números.
  const afuera = dispersionDesde(base);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(actual, 3));
  const OPACIDAD = 0.95;
  const mat = new THREE.PointsMaterial({
    // sizeAttenuation:false mide en píxeles físicos: escalar por DPR
    size: 2.2 * Math.min(window.devicePixelRatio || 1, 2),
    color: colorDeRango(rango, planeta ?? undefined),
    transparent: true,
    opacity: OPACIDAD,
    sizeAttenuation: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const puntos = new THREE.Points(geo, mat);
  escena.add(puntos);

  function medir() {
    const w = canvas.clientWidth || 400;
    const h = canvas.clientHeight || 700;
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const asp = w / h;
    camara.left = -asp;
    camara.right = asp;
    camara.updateProjectionMatrix();
  }
  medir();
  const alRedimensionar = () => medir();
  window.addEventListener('resize', alRedimensionar);

  let vivo = true;
  let termino = false;
  // Deja rastro, por la misma razón que el pulso: sin esto, "el gesto no se
  // vio" tiene tres causas —no se montó, se montó y no anima, o anima y no se
  // ve— y desde afuera son idénticas.
  marca('ascent:salvada');
  const t0 = performance.now();

  function frame(ahora: number) {
    if (!vivo) return;
    // `ahora` puede ser ANTERIOR a `t0`: es el tiempo del comienzo del cuadro.
    // Las funciones de la curva dan el reposo para tiempos negativos, así que
    // el primer cuadro dibuja el objeto entero y no algo dado vuelta.
    const t = ahora - t0;
    posicionesEn(base, afuera, t, actual);
    geo.attributes.position.needsUpdate = true;
    mat.opacity = OPACIDAD * brilloEn(t);
    // Un giro apenas perceptible, para que suelto no se vea congelado.
    puntos.rotation.z = t * 0.00012;
    renderer.render(escena, camara);
    if (sigueSalvando(t)) {
      requestAnimationFrame(frame);
      return;
    }
    // Se vuelve al estado EXACTO de reposo y no a lo que dio la última cuenta:
    // si no, el objeto queda para siempre con la pizca de error del último
    // cuadro.
    actual.set(base);
    geo.attributes.position.needsUpdate = true;
    mat.opacity = OPACIDAD;
    puntos.rotation.z = 0;
    renderer.render(escena, camara);
    if (!termino) {
      termino = true;
      alTerminar();
    }
  }
  requestAnimationFrame(frame);

  return {
    destruir() {
      vivo = false;
      window.removeEventListener('resize', alRedimensionar);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    },
  };
}
