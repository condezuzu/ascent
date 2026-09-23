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
  /** Se inyecta para poder probar los tintes con una semilla fija. */
  azar?: () => number;
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
  // El azar de los tintes es aparte del de la dispersión: mezclarlos haría que
  // cambiar uno moviera el otro, y los dos están probados por separado.
  const azarTinte = op.azar ?? Math.random;
  const extDesde = extension(desde);
  const extHasta = extension(hasta);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(actual, 3));
  // El planeta sale del de ESTA persona: el rango 4 no es un planeta
  // cualquiera, y terminar la subida con el color de Ceres para después
  // mostrar la Tierra de fondo sería un corte.
  const colA = colorDeRango(rangoAntes, planeta ?? undefined);
  const colB = colorDeRango(rangoDespues, planeta ?? undefined);
  // ─────────────────────────────────────────────────────────────────
  // LAS PARTÍCULAS SON ESTRELLAS, NO CUADRADITOS
  //
  // `PointsMaterial` sin textura dibuja un CUADRADO: es un punto de GL y nadie
  // le recorta las esquinas. A 2 px de lado casi no se nota, pero durante la
  // dispersión crecen y se ven novecientos cuadraditos blancos. Lo reportó el
  // humano y tenía razón.
  //
  // SE ARREGLA CON UN SHADER Y NO CON UNA TEXTURA. Lo normal sería pintar un
  // círculo en un canvas y usarlo de sprite; acá no hay canvas —`expo-gl` da un
  // contexto, no un elemento— así que habría que generar la textura a mano en
  // las dos apps. Doce líneas de shader hacen lo mismo, dan un borde suave
  // gratis y no ocupan memoria de textura.
  //
  // Y NO SON TODAS DEL MISMO COLOR. Un cielo de novecientos puntos idénticos se
  // lee como una malla; en el de verdad cada estrella tira a un lado. Cada
  // partícula lleva su propio desvío —fijo, sorteado una vez al nacer— y su
  // propio tamaño, y el color de la subida se mezcla con eso en el shader.
  const tintes = new Float32Array(N * 3);
  const tamanos = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    // Tres desvíos chicos e independientes: uno por canal. Independientes y no
    // un solo brillo, que daría la misma estrella más clara o más oscura; así
    // unas tiran a cálido y otras a frío, como en una carta celeste.
    //
    // EL PRIMER VALOR ERA EL DOBLE Y SE VEÍA CONFETI: sobre el dorado del
    // Sol salían partículas claramente verdes y rosadas. Una estrella que
    // tira a un lado sigue siendo del color del cuerpo; una verde es otra
    // cosa. Se bajó hasta que la variación se nota y el color no se pierde.
    tintes[i * 3] = 1 + (azarTinte() - 0.5) * 0.34;
    tintes[i * 3 + 1] = 1 + (azarTinte() - 0.5) * 0.22;
    tintes[i * 3 + 2] = 1 + (azarTinte() - 0.5) * 0.34;
    // Y magnitudes distintas, con unas pocas grandes: `x^2` deja la mayoría
    // chicas y algunas notoriamente más brillantes, que es lo que hace que un
    // campo de estrellas tenga profundidad.
    const m = azarTinte();
    tamanos[i] = 0.75 + m * m * 1.9;
  }
  geo.setAttribute('tinte', new THREE.BufferAttribute(tintes, 3));
  geo.setAttribute('magnitud', new THREE.BufferAttribute(tamanos, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      // El color de la subida, ya mezclado entre el de antes y el de después.
      uColor: { value: colA.clone() },
      uOpacidad: { value: opacidadEn(0) },
      // En píxeles físicos, igual que `sizeAttenuation: false`.
      uTamano: { value: 2.6 * l.densidad() },
    },
    vertexShader: `
      attribute vec3 tinte;
      attribute float magnitud;
      uniform float uTamano;
      varying vec3 vTinte;
      void main() {
        vTinte = tinte;
        vec4 vista = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uTamano * magnitud;
        gl_Position = projectionMatrix * vista;
      }
    `,
    fragmentShader: `
      precision mediump float;
      uniform vec3 uColor;
      uniform float uOpacidad;
      varying vec3 vTinte;
      void main() {
        // REDONDA Y CON BORDE SUAVE. gl_PointCoord va de 0 a 1 adentro del
        // cuadrado del punto; la distancia al centro dice si estamos adentro
        // del círculo. El smoothstep es el antialias: sin él el círculo
        // queda con escalones, que a este tamaño se ven como cuadrado igual.
        float d = length(gl_PointCoord - vec2(0.5));
        float alfa = smoothstep(0.5, 0.18, d);
        if (alfa <= 0.0) discard;
        gl_FragColor = vec4(uColor * vTinte, alfa * uOpacidad);
      }
    `,
    transparent: true,
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

    (mat.uniforms.uColor.value as THREE.Color).copy(colA).lerp(colB, fasesEn(p).junta);
    mat.uniforms.uOpacidad.value = opacidadEn(p);
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
