import * as THREE from 'three';
import { alCambiarDeTamano } from './alCambiarDeTamano';
import { RANGOS_CFG, PLANETAS_CFG } from '@compartido/motor/cuerpos';
import {
  N,
  formaDeRango,
  azarDeDispersion,
  duracionDeSubida,
  esIgnicion,
  extension,
  escalaParaEntrar,
  escalaEn,
  progresoEn,
  posicionesSubida,
  opacidadEn,
  flashEn,
  rotacionEn,
  fasesEn,
} from '@/lib/subida';

// Subida de rango: las partículas del objeto anterior se dispersan y se
// reorganizan en el objeto nuevo. Son las mismas partículas — los días
// registrados son el material del rango nuevo.
// El salto 4 -> 5 (Júpiter se enciende y se vuelve Sol) es la ignición:
// la animación más espectacular de las siete.
//
// TODA LA ARITMÉTICA VIVE EN `lib/subida.ts`, probada con números. Acá queda
// lo que necesita una GPU delante: el renderer, los materiales y el bucle.
// Antes era al revés, y la animación que paga los ochenta días de racha no
// tenía un solo test — y se salía de la pantalla en los rangos 5 a 8 en
// cualquier teléfono vertical, sin que nada lo avisara.

export { N, formaDeRango };

export function colorDeRango(rango: number, planeta?: string): THREE.Color {
  // En rango 4 el cuerpo es EL planeta que le toco a esta persona, no un
  // planeta cualquiera: si no se sabe cual, Ceres es el primero de la lista.
  const cfg =
    rango === 4
      ? PLANETAS_CFG[planeta && PLANETAS_CFG[planeta] ? planeta : 'Ceres']
      : RANGOS_CFG[rango];
  return new THREE.Color(cfg ? cfg.paleta[2] : rango >= 7 ? '#9a86ff' : '#aebfe0');
}

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

  const escena = new THREE.Scene();
  const camara = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camara.position.z = 2;

  const desde = formaDeRango(rangoAntes);
  const hasta = formaDeRango(rangoDespues);
  const actual = new Float32Array(desde);
  const azar = azarDeDispersion();
  const extDesde = extension(desde);
  const extHasta = extension(hasta);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(actual, 3));
  // El planeta sale del de ESTA persona: el rango 4 no es un planeta
  // cualquiera, y terminar la subida con el color de Ceres para después
  // mostrar la Tierra de fondo sería un corte.
  const colA = colorDeRango(rangoAntes, planeta ?? undefined);
  const colB = colorDeRango(rangoDespues, planeta ?? undefined);
  const mat = new THREE.PointsMaterial({
    // sizeAttenuation:false mide en píxeles físicos: escalar por DPR
    size: 2.2 * Math.min(window.devicePixelRatio || 1, 2),
    color: colA.clone(),
    transparent: true,
    opacity: opacidadEn(0),
    sizeAttenuation: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const puntos = new THREE.Points(geo, mat);
  escena.add(puntos);

  const ignicion = esIgnicion(rangoAntes, rangoDespues);
  // flash cálido: el planeta se ENCIENDE (paleta del sol, no azul)
  const flashGeo = new THREE.PlaneGeometry(6, 6);
  const flashMat = new THREE.MeshBasicMaterial({ color: '#fff1c2', transparent: true, opacity: 0 });
  const flash = new THREE.Mesh(flashGeo, flashMat);
  flash.position.z = 0.5;
  escena.add(flash);

  // Las dos escalas se calculan con la pantalla de ESTE momento, y se vuelven
  // a calcular si gira: una subida que se ve bien en vertical y se sale al
  // girar el teléfono sería el mismo bug de antes con otra forma.
  let escalaDesde = 1;
  let escalaHasta = 1;
  function medir() {
    const w = canvas.clientWidth || 400;
    const h = canvas.clientHeight || 700;
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const asp = w / h;
    camara.left = -asp;
    camara.right = asp;
    camara.updateProjectionMatrix();
    escalaDesde = escalaParaEntrar(extDesde, asp);
    escalaHasta = escalaParaEntrar(extHasta, asp);
  }
  medir();
  const dejarDeMedir = alCambiarDeTamano(canvas, medir);

  const DUR = duracionDeSubida(rangoAntes, rangoDespues);
  let vivo = true;
  let t0: number | null = null;
  // con reduced motion se salta directo al objeto formado y al nombre
  let saltado = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function frame(ms: number) {
    if (!vivo) return;
    if (t0 === null) t0 = ms;
    const segundos = saltado ? DUR : (ms - t0) / 1000;
    const p = progresoEn(segundos, DUR);

    posicionesSubida(desde, hasta, azar, p, segundos, ignicion, actual);
    geo.attributes.position.needsUpdate = true;

    mat.color.copy(colA).lerp(colB, fasesEn(p).junta);
    mat.opacity = opacidadEn(p);
    puntos.rotation.z = rotacionEn(segundos, rangoDespues);
    puntos.scale.setScalar(escalaEn(p, escalaDesde, escalaHasta));
    flashMat.opacity = flashEn(p, ignicion);

    renderer.render(escena, camara);

    if (p >= 1) {
      vivo = false;
      alTerminar();
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    saltar() {
      saltado = true;
    },
    destruir() {
      vivo = false;
      dejarDeMedir();
      geo.dispose();
      mat.dispose();
      // El flash también: antes quedaban su geometría y su material colgados
      // en la GPU después de cada subida.
      flashGeo.dispose();
      flashMat.dispose();
      renderer.dispose();
    },
  };
}
