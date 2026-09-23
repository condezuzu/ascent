import * as THREE from 'three';
import { RANGOS_CFG, PLANETAS_CFG } from './cuerpos';
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
} from '@nucleo/subida';

/**
 * LA SUBIDA DE RANGO, dibujada: las partículas del objeto anterior se
 * dispersan y se reorganizan en el objeto nuevo. Son las mismas partículas —
 * los días registrados son el material del rango nuevo. El salto 4 → 5
 * (Júpiter se enciende y se vuelve Sol) es la ignición: la animación más
 * espectacular de las siete.
 *
 * TODA LA ARITMÉTICA VIVE EN `nucleo/subida.ts`, probada con números. Acá
 * queda lo que necesita una GPU delante: los materiales y el bucle.
 *
 * ─────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTE ARCHIVO ESTÁ EN `compartido/` Y NO EN LA WEB
 *
 * Porque la app nativa tenía la subida de rango vacía. El evento llegaba, se
 * abría una pantalla, y lo que se veía era el objeto nuevo entrando con la
 * animación de entrada del fondo: el objeto viejo no se deshacía en el nuevo,
 * que es exactamente lo que la subida cuenta. Los días que ya hiciste son el
 * material de lo que sos ahora; sin esa transformación queda un cartel.
 *
 * NO SE DUPLICA: es el mismo archivo para las dos apps, igual que
 * `motor/escena.ts`. Lo que separaba a este de aquel eran seis cosas del
 * navegador, y las seis se le piden ahora al `Lienzo`:
 *
 *     new WebGLRenderer({ canvas })   → lo trae `l.renderer`
 *     canvas.clientWidth / Height     → `l.tamano()`
 *     window.devicePixelRatio         → `l.densidad()`
 *     requestAnimationFrame           → `l.cuadro()`
 *     ResizeObserver                  → `l.alCambiarDeTamano()`
 *     matchMedia(reduced-motion)      → `movimientoReducido`, que cada app
 *                                       averigua a su manera
 *
 * Y una séptima que no existía en la web: `l.presentar()`. El navegador
 * muestra el cuadro solo; `expo-gl` no, y sin eso la pantalla queda negra.
 *
 * EL RENDERER NO SE DESTRUYE ACÁ, lo destruye quien lo creó. Es la misma
 * regla que `montarEscena`: en la app nativa el renderer puede ser de un
 * contexto que vive más que esta animación, y soltarlo se llevaría puesto el
 * fondo de toda la sesión.
 */

/**
 * Lo que la subida necesita de un lienzo. Es un subconjunto del `Lienzo` de
 * `escena.ts` a propósito —no usa `nivel` ni `alDespertar`— así que cualquiera
 * que arme uno completo sirve acá sin tocar nada.
 */
export type LienzoSubida = {
  renderer: THREE.WebGLRenderer;
  /** Tamaño en puntos (no en píxeles físicos) de donde se dibuja. */
  tamano: () => { w: number; h: number };
  /** Píxeles físicos por punto, con el tope ya aplicado. */
  densidad: () => number;
  /** Pide el próximo cuadro. `fn` recibe la hora en el reloj de `performance.now`. */
  cuadro: (fn: (t: number) => void) => void;
  /** Después de cada `render`. En la web no hace nada. */
  presentar: () => void;
  /** Avisa cuando cambia el tamaño. Devuelve cómo dejar de escuchar. */
  alCambiarDeTamano: (fn: () => void) => () => void;
};

export type OpcionesSubida = {
  rangoAntes: number;
  rangoDespues: number;
  /** El planeta de esta persona: el rango 4 no es un planeta cualquiera. */
  planeta?: string | null;
  /** Con el movimiento reducido del sistema se salta al objeto ya formado. */
  movimientoReducido?: boolean;
  alTerminar: () => void;
};

export { N, formaDeRango };

export function colorDeRango(rango: number, planeta?: string): THREE.Color {
  // En rango 4 el cuerpo es EL planeta que le tocó a esta persona, no un
  // planeta cualquiera: si no se sabe cuál, Ceres es el primero de la lista.
  const cfg =
    rango === 4
      ? PLANETAS_CFG[planeta && PLANETAS_CFG[planeta] ? planeta : 'Ceres']
      : RANGOS_CFG[rango];
  return new THREE.Color(cfg ? cfg.paleta[2] : rango >= 7 ? '#9a86ff' : '#aebfe0');
}

export function animarSubida(
  l: LienzoSubida,
  op: OpcionesSubida
): { saltar: () => void; destruir: () => void } {
  const { rangoAntes, rangoDespues, planeta, alTerminar } = op;

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
    // sizeAttenuation:false mide en píxeles físicos: escalar por la densidad.
    size: 2.2 * l.densidad(),
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
  // Flash cálido: el planeta se ENCIENDE (paleta del sol, no azul).
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
    const { w, h } = l.tamano();
    const ancho = w || 400;
    const alto = h || 700;
    l.renderer.setSize(ancho, alto, false);
    l.renderer.setPixelRatio(l.densidad());
    const asp = ancho / alto;
    camara.left = -asp;
    camara.right = asp;
    camara.updateProjectionMatrix();
    escalaDesde = escalaParaEntrar(extDesde, asp);
    escalaHasta = escalaParaEntrar(extHasta, asp);
  }
  medir();
  const dejarDeMedir = l.alCambiarDeTamano(medir);

  const DUR = duracionDeSubida(rangoAntes, rangoDespues);
  let vivo = true;
  let t0: number | null = null;
  // Con movimiento reducido se salta directo al objeto formado y al nombre.
  let saltado = !!op.movimientoReducido;

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

    l.renderer.render(escena, camara);
    l.presentar();

    if (p >= 1) {
      vivo = false;
      alTerminar();
      return;
    }
    l.cuadro(frame);
  }
  l.cuadro(frame);

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
      // EL RENDERER NO: es de quien lo creó. Ver el encabezado.
    },
  };
}
