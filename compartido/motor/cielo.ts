import * as THREE from 'three';
import type { LienzoSubida } from './subida';
import { cielo, cuantasPara } from '@nucleo/estrellas';

/**
 * EL CAMPO DE ESTRELLAS DE LA ENTRADA, en GPU (opción C, expo-gl).
 *
 * En la web esto es un canvas 2D (`src/components/bienvenida/Cielo.tsx`), pero el
 * teléfono no tiene canvas 2D. En vez del SVG achatado (sin titileo por-estrella
 * ni paralaje por capa) se usa el MISMO motor que dibuja los planetas: un pase de
 * `Points` con un shader chico. Las posiciones y las fases salen de
 * `nucleo/estrellas.ts`, iguales que la web, así que titila igual y el paralaje
 * es por capa. El primer cuadro es barato (solo puntos, sin cuerpo raytraceado),
 * como el del sol.
 *
 * `mover(paso)` corre el cielo al cambiar de pantalla; la interpolación es la
 * misma que la web (se acerca al objetivo de a poco), para que no salte.
 */

const VERTEX = `
  uniform float uDpr;
  uniform float uCorr;
  uniform float uAspect;
  attribute float fase;
  attribute float tam;
  attribute float brilloBase;
  attribute float capa;
  varying float vFase;
  varying float vBrillo;
  void main() {
    vFase = fase;
    vBrillo = brilloBase;
    float wx = (position.x * 2.0 - 1.0) * uAspect - uCorr * capa * 0.16;
    float wy = (1.0 - position.y * 2.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(wx, wy, 0.0, 1.0);
    gl_PointSize = tam * uDpr;
  }
`;

const FRAGMENT = `
  precision mediump float;
  uniform float uTime;
  varying float vFase;
  varying float vBrillo;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    if (dot(d, d) > 0.25) discard;
    float pulso = 0.82 + 0.18 * sin(uTime * 0.9 + vFase);
    gl_FragColor = vec4(vec3(0.81, 0.85, 0.94), clamp(vBrillo * pulso, 0.0, 1.0));
  }
`;

export function animarCielo(l: LienzoSubida, op: { paso?: number } = {}): { mover: (paso: number) => void; destruir: () => void } {
  const renderer = l.renderer;
  const escena = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  cam.position.z = 2;

  const { w, h } = l.tamano();
  const estrellas = cielo(cuantasPara(w || 400, h || 700));
  const n = estrellas.length;
  const pos = new Float32Array(n * 3);
  const fase = new Float32Array(n);
  const tam = new Float32Array(n);
  const bri = new Float32Array(n);
  const capa = new Float32Array(n);
  estrellas.forEach((e, i) => {
    pos[i * 3] = e.x;
    pos[i * 3 + 1] = e.y;
    pos[i * 3 + 2] = 0;
    fase[i] = e.fase;
    tam[i] = e.r * 2.2;
    bri[i] = e.brillo;
    capa[i] = e.capa;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('fase', new THREE.BufferAttribute(fase, 1));
  geo.setAttribute('tam', new THREE.BufferAttribute(tam, 1));
  geo.setAttribute('brilloBase', new THREE.BufferAttribute(bri, 1));
  geo.setAttribute('capa', new THREE.BufferAttribute(capa, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uDpr: { value: l.densidad() }, uCorr: { value: op.paso ?? 0 }, uAspect: { value: 1 } },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  });
  const nube = new THREE.Points(geo, mat);
  escena.add(nube);

  let corrObjetivo = op.paso ?? 0;
  function medir() {
    const t = l.tamano();
    const W = t.w || 400;
    const H = t.h || 700;
    renderer.setSize(W, H, false);
    renderer.setPixelRatio(l.densidad());
    const asp = W / H;
    cam.left = -asp;
    cam.right = asp;
    cam.updateProjectionMatrix();
    mat.uniforms.uAspect.value = asp;
    mat.uniforms.uDpr.value = l.densidad();
  }
  medir();
  const soltar = l.alCambiarDeTamano(medir);

  let t0 = 0;
  let vivo = true;
  function pintar(ahora: number) {
    if (!vivo) return;
    if (t0 === 0) t0 = ahora;
    l.cuadro(pintar);
    mat.uniforms.uTime.value = (ahora - t0) / 1000;
    mat.uniforms.uCorr.value += (corrObjetivo - mat.uniforms.uCorr.value) * 0.045;
    renderer.render(escena, cam);
    l.presentar();
  }
  l.cuadro(pintar);

  return {
    mover: (paso: number) => {
      corrObjetivo = paso;
    },
    destruir: () => {
      vivo = false;
      soltar();
      geo.dispose();
      mat.dispose();
      // El renderer lo suelta quien lo creó.
    },
  };
}
