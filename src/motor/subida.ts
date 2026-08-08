import * as THREE from 'three';
import { RANGOS_CFG, PLANETAS_CFG } from './cuerpos';

// Subida de rango: las partículas del objeto anterior se dispersan y se
// reorganizan en el objeto nuevo. Son las mismas partículas — los días
// registrados son el material del rango nuevo.
// El salto 4 -> 5 (Júpiter se enciende y se vuelve Sol) es la ignición:
// la animación más espectacular de las siete.

const N = 900;

function formaDeRango(rango: number): Float32Array {
  const pos = new Float32Array(N * 3);
  if (rango <= 1) {
    // polvo: nube suelta
    for (let i = 0; i < N; i++) {
      const r = Math.pow(Math.random(), 0.5) * 0.8;
      const a = Math.random() * Math.PI * 2;
      const b = (Math.random() - 0.5) * Math.PI;
      pos[i * 3] = Math.cos(a) * Math.cos(b) * r;
      pos[i * 3 + 1] = Math.sin(b) * r * 0.7;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r * 0.3;
    }
  } else if (rango === 7) {
    // galaxia espiral
    for (let i = 0; i < N; i++) {
      const brazo = i % 3;
      const t = Math.random();
      const r = 0.05 + t * 0.72;
      const ang = brazo * ((Math.PI * 2) / 3) + t * 4.2 + (Math.random() - 0.5) * 0.4;
      pos[i * 3] = Math.cos(ang) * r;
      pos[i * 3 + 1] = Math.sin(ang) * r * 0.45;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.04;
    }
  } else if (rango === 8) {
    // agujero negro: anillo denso con centro vacío
    for (let i = 0; i < N; i++) {
      const t = Math.random();
      const r = 0.3 + Math.pow(t, 2) * 0.35;
      const ang = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(ang) * r;
      pos[i * 3 + 1] = Math.sin(ang) * r * 0.32;
      pos[i * 3 + 2] = 0;
    }
  } else if (rango === 6) {
    // sistema: núcleo + anillos orbitales
    for (let i = 0; i < N; i++) {
      const orbita = i % 5;
      if (orbita === 0) {
        const r = Math.pow(Math.random(), 0.5) * 0.18;
        const a = Math.random() * Math.PI * 2;
        pos[i * 3] = Math.cos(a) * r;
        pos[i * 3 + 1] = Math.sin(a) * r;
        pos[i * 3 + 2] = 0;
      } else {
        const r = 0.22 + orbita * 0.13;
        const a = Math.random() * Math.PI * 2;
        pos[i * 3] = Math.cos(a) * r;
        pos[i * 3 + 1] = Math.sin(a) * r * 0.35;
        pos[i * 3 + 2] = 0;
      }
    }
  } else {
    // esfera (asteroide chico, luna, planeta, sol grande)
    const R = rango === 5 ? 0.62 : rango === 2 ? 0.3 : rango === 3 ? 0.4 : 0.5;
    for (let i = 0; i < N; i++) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const rugoso = rango === 2 ? 0.85 + Math.random() * 0.3 : 0.97 + Math.random() * 0.06;
      pos[i * 3] = Math.cos(th) * s * R * rugoso;
      pos[i * 3 + 1] = u * R * rugoso;
      pos[i * 3 + 2] = Math.sin(th) * s * R * rugoso * 0.5;
    }
  }
  return pos;
}

function colorDeRango(rango: number): THREE.Color {
  const cfg = rango === 4 ? PLANETAS_CFG['Ceres'] : RANGOS_CFG[rango];
  return new THREE.Color(cfg ? cfg.paleta[2] : rango >= 7 ? '#9a86ff' : '#aebfe0');
}

export function animarSubida(
  canvas: HTMLCanvasElement,
  rangoAntes: number,
  rangoDespues: number,
  alTerminar: () => void
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
  const azar = new Float32Array(N * 3);
  for (let i = 0; i < N * 3; i++) azar[i] = (Math.random() - 0.5) * 2.6;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(actual, 3));
  const colA = colorDeRango(rangoAntes);
  const colB = colorDeRango(rangoDespues);
  const mat = new THREE.PointsMaterial({
    // sizeAttenuation:false mide en píxeles físicos: escalar por DPR
    size: 2.2 * Math.min(window.devicePixelRatio || 1, 2),
    color: colA.clone(),
    transparent: true,
    opacity: 0.95,
    sizeAttenuation: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const puntos = new THREE.Points(geo, mat);
  escena.add(puntos);

  // ignición 4 -> 5: flash blanco azulado cuando el planeta se enciende
  const esIgnicion = rangoAntes === 4 && rangoDespues === 5;
  // flash cálido: el planeta se ENCIENDE (paleta del sol, no azul)
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 6),
    new THREE.MeshBasicMaterial({ color: '#fff1c2', transparent: true, opacity: 0 })
  );
  flash.position.z = 0.5;
  escena.add(flash);

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

  const DUR = esIgnicion ? 5.2 : 4.0;
  let vivo = true;
  let t0: number | null = null;
  // con reduced motion se salta directo al objeto formado y al nombre
  let saltado = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const suave = (x: number) => x * x * (3 - 2 * x);

  function frame(ms: number) {
    if (!vivo) return;
    if (t0 === null) t0 = ms;
    let t = (ms - t0) / 1000;
    if (saltado) t = DUR;
    const p = Math.min(1, t / DUR);

    // fase 1 (0..0.4): dispersión — fase 2 (0.4..1): reorganización
    const disp = suave(Math.min(1, p / 0.4));
    const junta = p < 0.4 ? 0 : suave((p - 0.4) / 0.6);
    const caos = Math.sin(Math.PI * Math.min(1, p / 0.75)); // pico de caos al medio

    for (let i = 0; i < N * 3; i++) {
      const libre = desde[i] + azar[i] * disp * (esIgnicion ? 1.4 : 1);
      actual[i] = libre + (hasta[i] - libre) * junta;
      // remolino durante el caos
      if (i % 3 === 0) {
        const y = actual[i + 1];
        actual[i] += Math.sin(y * 6 + t * 3) * 0.05 * caos;
      }
    }
    geo.attributes.position.needsUpdate = true;

    mat.color.copy(colA).lerp(colB, junta);
    mat.opacity = 0.55 + 0.45 * Math.max(disp, junta);
    puntos.rotation.z = t * (rangoDespues >= 7 ? 0.25 : 0.08);

    if (esIgnicion) {
      // el flash pega justo cuando las partículas terminan de juntarse
      const f = Math.max(0, 1 - Math.abs(p - 0.92) * 14);
      (flash.material as THREE.MeshBasicMaterial).opacity = f * 0.85;
    }

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
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    },
  };
}
