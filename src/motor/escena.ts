import * as THREE from 'three';
import { VERTEX, FRAGMENT } from './shaders';
import { RANGOS_CFG, PLANETAS_CFG, ESTRELLAS_POR_RANGO, type ConfigCuerpo } from './cuerpos';

export type OpcionesFondo = {
  rango: number;
  planeta?: string | null; // nombre del planeta del día (rango 4)
  apagado?: boolean; // pérdida de racha: el fondo se apaga
  vacio?: boolean; // estado vacío: el espacio antes de que se forme nada
  // posición del cuerpo: se recorta por una esquina, nunca centrado
  esquina?: 'abajo-derecha' | 'arriba-derecha' | 'centro';
  animar?: boolean; // false => un solo frame estático (reduced motion / equipos lentos)
};

export type Fondo = {
  destruir: () => void;
};

const LIMITE_PARTICULAS = 1400;

function colorU(hex: string) {
  return new THREE.Color(hex);
}

export function crearMaterialCuerpo(cfg: ConfigCuerpo, apagado: boolean, pixel: number) {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uPaleta0: { value: colorU(cfg.paleta[0]) },
      uPaleta1: { value: colorU(cfg.paleta[1]) },
      uPaleta2: { value: colorU(cfg.paleta[2]) },
      uPaleta3: { value: colorU(cfg.paleta[3]) },
      uBandas: { value: cfg.bandas },
      uContraste: { value: cfg.contraste },
      uTurbulencia: { value: cfg.turbulencia },
      uTormenta: { value: cfg.tormenta },
      uTormentaPos: { value: new THREE.Vector2(...cfg.tormentaPos) },
      uAnillo: { value: cfg.anillo ? 1 : 0 },
      uModo: { value: cfg.modo },
      uCrateres: { value: cfg.crateres },
      uSemilla: { value: 0.37 },
      uApagado: { value: apagado ? 1 : 0 },
      uPixel: { value: pixel },
    },
  });
}

// Con sizeAttenuation:false el tamaño de PointsMaterial se mide en PÍXELES
// físicos del framebuffer, no en unidades de mundo: hay que escalarlo por
// el devicePixelRatio o las partículas quedan de ~1px y casi no se ven.
function dpr(): number {
  return Math.min(window.devicePixelRatio || 1, 2);
}

function crearEstrellas(cantidad: number, rango: number): THREE.Points {
  const n = Math.min(cantidad, LIMITE_PARTICULAS);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 4;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 4;
    pos[i * 3 + 2] = -1 - Math.random() * 2;
    const b = 0.25 + Math.random() * 0.75;
    // violeta solo en rangos altos
    const violeta = rango >= 7 && Math.random() < 0.3;
    col[i * 3] = b * (violeta ? 0.75 : 0.85);
    col[i * 3 + 1] = b * (violeta ? 0.6 : 0.9);
    col[i * 3 + 2] = b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.8 * dpr(),
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: false,
  });
  return new THREE.Points(geo, mat);
}

// Galaxia espiral en partículas (rango 7)
function crearGalaxia(): THREE.Points {
  const n = LIMITE_PARTICULAS;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const brazo = i % 3;
    const t = Math.random();
    const r = 0.08 + t * 0.75;
    const ang = brazo * ((Math.PI * 2) / 3) + t * 4.2 + (Math.random() - 0.5) * 0.5;
    pos[i * 3] = Math.cos(ang) * r;
    pos[i * 3 + 1] = Math.sin(ang) * r * 0.5;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
    const nucleo = 1 - t;
    col[i * 3] = 0.55 + nucleo * 0.4;
    col[i * 3 + 1] = 0.45 + nucleo * 0.45;
    col[i * 3 + 2] = 0.9;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 2.0 * dpr(),
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}

// Polvo (rango 1) o estado vacío: puñado de partículas perdidas
function crearPolvo(vacio: boolean): THREE.Points {
  const n = vacio ? 4 : 120;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = vacio ? 0.5 : Math.pow(Math.random(), 0.6) * 0.45;
    const a = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * r * (vacio ? 1 : 1 + (Math.random() - 0.5) * 0.4);
    pos[i * 3 + 1] = Math.sin(a) * r * 0.7;
    pos[i * 3 + 2] = 0;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: (vacio ? 3.0 : 2.2) * dpr(),
    color: new THREE.Color('#9fb0d8'),
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: false,
  });
  return new THREE.Points(geo, mat);
}

export function montarFondo(canvas: HTMLCanvasElement, op: OpcionesFondo): Fondo | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    return null; // sin WebGL: el CSS de respaldo queda solo
  }

  const escena = new THREE.Scene();
  const camara = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camara.position.z = 2;

  const materiales: THREE.ShaderMaterial[] = [];
  const orbitantes: { obj: THREE.Object3D; r: number; v: number; f: number }[] = [];
  let galaxia: THREE.Points | null = null;

  // --- campo estelar (el ambiente permanente) ---
  const estrellas = crearEstrellas(ESTRELLAS_POR_RANGO[op.rango] ?? 120, op.rango);
  if (op.apagado) (estrellas.material as THREE.PointsMaterial).opacity = 0.35;
  escena.add(estrellas);

  // --- objeto del rango, recortado por una esquina ---
  const cfg =
    op.rango === 4 && op.planeta && PLANETAS_CFG[op.planeta]
      ? PLANETAS_CFG[op.planeta]
      : RANGOS_CFG[op.rango];

  const grupo = new THREE.Group();
  escena.add(grupo);

  if (op.vacio || op.rango === 1) {
    const polvo = crearPolvo(!!op.vacio);
    grupo.add(polvo);
    grupo.scale.setScalar(0.9);
  } else if (op.rango === 7) {
    galaxia = crearGalaxia();
    grupo.add(galaxia);
    grupo.scale.setScalar(1.4);
  } else if (cfg) {
    // el quad es más grande que el cuerpo (R=0.46): el tamaño visible del
    // cuerpo queda igual que antes y el anillo/disco/corona ya no se recortan
    const tam = op.rango >= 5 ? 2.4 : 1.9;
    const mat = crearMaterialCuerpo(cfg, !!op.apagado, 2 / (tam * Math.min(canvas.clientWidth || 400, canvas.clientHeight || 700)));
    materiales.push(mat);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam), mat);
    grupo.add(quad);

    // Rango 6 (Sistema): sol central chico + planetitas orbitando
    if (op.rango === 6) {
      quad.scale.setScalar(0.5);
      for (let i = 0; i < 4; i++) {
        const nombres = ['Mercurio', 'Tierra', 'Neptuno', 'Júpiter'] as const;
        const pcfg = PLANETAS_CFG[nombres[i]];
        const pmat = crearMaterialCuerpo(pcfg, !!op.apagado, 0.02);
        materiales.push(pmat);
        const pquad = new THREE.Mesh(new THREE.PlaneGeometry(0.2 + i * 0.06, 0.2 + i * 0.06), pmat);
        grupo.add(pquad);
        orbitantes.push({ obj: pquad, r: 0.42 + i * 0.24, v: 0.25 / (1 + i * 0.7), f: i * 1.7 });
      }
    }
  }

  // posición: entra por una esquina y se sale de la pantalla
  const esquina = op.esquina ?? 'abajo-derecha';
  if (esquina === 'abajo-derecha') grupo.position.set(0.72, -0.78, 0);
  else if (esquina === 'arriba-derecha') grupo.position.set(0.78, 0.75, 0);

  // --- loop ---
  let vivo = true;
  let pausado = false;
  const reloj = new THREE.Clock();
  let tiempo = Math.random() * 100;

  // posición inicial de los orbitantes: sin esto, en el modo estático
  // (un solo frame) quedarían todos apilados en el centro
  for (const o of orbitantes) {
    o.obj.position.set(Math.cos(tiempo * o.v + o.f) * o.r, Math.sin(tiempo * o.v + o.f) * o.r * 0.35, 0);
  }
  for (const m of materiales) m.uniforms.uTime.value = tiempo;

  function medir() {
    const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 400;
    const h = canvas.clientHeight || canvas.parentElement?.clientHeight || 700;
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const asp = w / h;
    camara.left = -asp;
    camara.right = asp;
    camara.updateProjectionMatrix();
    if (esquina === 'abajo-derecha') grupo.position.set(asp * 0.8, -0.72, 0);
    else if (esquina === 'arriba-derecha') grupo.position.set(asp * 0.82, 0.72, 0);
  }
  medir();

  function frame() {
    if (!vivo) return;
    if (!pausado) {
      tiempo += reloj.getDelta();
      for (const m of materiales) m.uniforms.uTime.value = tiempo;
      for (const o of orbitantes) {
        o.obj.position.set(Math.cos(tiempo * o.v + o.f) * o.r, Math.sin(tiempo * o.v + o.f) * o.r * 0.35, 0);
      }
      if (galaxia) galaxia.rotation.z = tiempo * 0.02;
      renderer.render(escena, camara);
    }
    if (op.animar !== false) requestAnimationFrame(frame);
  }

  // reduced motion / equipos lentos: un solo frame, sin loop
  if (op.animar === false) {
    renderer.render(escena, camara);
  } else {
    requestAnimationFrame(frame);
  }

  // pausar cuando la app pierde el foco
  const onVis = () => {
    pausado = document.hidden;
    if (!pausado) reloj.getDelta(); // descartar el tiempo acumulado
  };
  document.addEventListener('visibilitychange', onVis);
  const onResize = () => medir();
  window.addEventListener('resize', onResize);

  return {
    destruir() {
      vivo = false;
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', onResize);
      escena.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
      });
      renderer.dispose();
    },
  };
}
