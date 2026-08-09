import * as THREE from 'three';
import { VERTEX, FRAGMENT } from './shaders';
import { RANGOS_CFG, PLANETAS_CFG, ESTRELLAS_POR_RANGO, type ConfigCuerpo } from './cuerpos';
import { paletaDe } from '@/lib/paletas';
import { marca, medir } from '@/lib/medir';

export type OpcionesFondo = {
  rango: number;
  planeta?: string | null; // nombre del planeta del día (rango 4)
  apagado?: boolean; // pérdida de racha: el fondo se apaga
  vacio?: boolean; // estado vacío: el espacio antes de que se forme nada
  reposo?: boolean; // día de descanso: cara nocturna y giro frenado
  // fantasma de la mejor racha: el objeto más grande que se alcanzó alguna vez,
  // apenas insinuado detrás del actual
  fantasma?: { rango: number; planeta?: string | null } | null;
  // posición del cuerpo: se recorta por una esquina, nunca centrado
  esquina?: 'abajo-derecha' | 'arriba-derecha' | 'centro';
  animar?: boolean; // false => un solo frame estático (reduced motion / equipos lentos)
};

// El quad SIEMPRE mide 2x2 para que vP vaya de -1 a 1 y el shader dibuje el
// disco completo. El tamaño en pantalla lo da mesh.scale, nunca la geometría.
const QUAD = new THREE.PlaneGeometry(2, 2);

function colorU(hex: string) {
  return new THREE.Color(hex);
}

function dpr(): number {
  return Math.min(window.devicePixelRatio || 1, 2);
}

// -------------------------------------------------------------------
// NIVEL DEL EQUIPO
// En un teléfono viejo no tiene sentido tirar 4200 partículas. Se mide una
// sola vez por sesión y de ahí sale un multiplicador para todo lo pesado.
// -------------------------------------------------------------------
type Nivel = 'bajo' | 'medio' | 'alto';
let nivelCache: Nivel | null = null;

export function nivelEquipo(): Nivel {
  if (nivelCache) return nivelCache;
  const nucleos = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  const pantallaChica = Math.min(window.innerWidth, window.innerHeight) < 400;
  if (nucleos <= 4 || mem <= 2) nivelCache = 'bajo';
  else if (nucleos <= 8 || mem <= 4 || pantallaChica) nivelCache = 'medio';
  else nivelCache = 'alto';
  return nivelCache;
}

const FACTOR: Record<Nivel, number> = { bajo: 0.3, medio: 0.6, alto: 1 };

function cuantas(base: number): number {
  return Math.max(24, Math.round(base * FACTOR[nivelEquipo()]));
}

const ESTRELLAS_TOPE = 1400;
const GALAXIA_BASE = 4200;

// -------------------------------------------------------------------
// RENDERER COMPARTIDO
// Crear un WebGLRenderer por pantalla significaba crear un contexto WebGL
// nuevo y, sobre todo, recompilar los shaders desde cero en cada montaje.
// Con uno solo para toda la app, el programa se compila una única vez y el
// resto de las pantallas lo reusan: el canvas se muda de contenedor.
// -------------------------------------------------------------------
let renderer: THREE.WebGLRenderer | null = null;
let lienzo: HTMLCanvasElement | null = null;
let rendererRoto = false;

function obtenerRenderer(): { renderer: THREE.WebGLRenderer; lienzo: HTMLCanvasElement } | null {
  if (rendererRoto) return null;
  if (renderer && lienzo) return { renderer, lienzo };
  try {
    const c = document.createElement('canvas');
    c.style.width = '100%';
    c.style.height = '100%';
    c.style.display = 'block';
    const r = new THREE.WebGLRenderer({
      canvas: c,
      alpha: true,
      antialias: nivelEquipo() !== 'bajo',
      powerPreference: 'high-performance',
    });
    renderer = r;
    lienzo = c;
    return { renderer: r, lienzo: c };
  } catch {
    rendererRoto = true; // sin WebGL: queda el fondo de CSS solo
    return null;
  }
}

export function crearMaterialCuerpo(
  cfg: ConfigCuerpo,
  apagado: boolean,
  pixel: number,
  reposo = false,
  atenua = 1
) {
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
      uAnilloVert: { value: cfg.anilloVertical ? 1 : 0 },
      uModo: { value: cfg.modo },
      uCrateres: { value: cfg.crateres },
      uCasquetes: { value: cfg.casquetes },
      uContinentes: { value: cfg.continentes },
      uPuntos: { value: cfg.puntos },
      uMares: { value: cfg.mares },
      uManchas: { value: cfg.manchas },
      uRayos: { value: cfg.rayos },
      uReposo: { value: reposo ? 1 : 0 },
      uAtenua: { value: atenua },
      uSemilla: { value: 0.37 },
      uApagado: { value: apagado ? 1 : 0 },
      uPixel: { value: pixel },
    },
  });
}

// Luna chica y gris para acompañar a los planetas que tienen
const LUNA_CFG: ConfigCuerpo = {
  paleta: ['#3c3f46', '#5c6069', '#949aa5', '#d8dce4'],
  bandas: 0, contraste: 0, turbulencia: 0.7, tormenta: 0, tormentaPos: [0, 0],
  anillo: false, anilloVertical: false, crateres: 1.0, casquetes: 0,
  continentes: 0, puntos: 0, mares: 0.5, manchas: 0, rayos: 0.4, lunas: 0, modo: 0,
};

// Cortinas de aurora para acompañar a la galaxia
const AURORA_CFG: ConfigCuerpo = {
  paleta: ['#1a0f38', '#4A2A8C', '#7F4FD0', '#8fe3d0'],
  bandas: 0, contraste: 0, turbulencia: 1.0, tormenta: 0, tormentaPos: [0, 0],
  anillo: false, anilloVertical: false, crateres: 0, casquetes: 0,
  continentes: 0, puntos: 0, mares: 0, manchas: 0, rayos: 0, lunas: 0, modo: 4,
};

function crearEstrellas(cantidad: number, rango: number, planeta?: string | null): THREE.Points {
  const n = Math.min(cuantas(cantidad), ESTRELLAS_TOPE);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  // Las estrellas toman el color del rango: el ambiente entero cambia,
  // no solo los acentos de la interfaz.
  const pal = paletaDe(rango, planeta);
  const cPrincipal = new THREE.Color(pal.principal);
  const cClaro = new THREE.Color(pal.claro);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 4;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 4;
    pos[i * 3 + 2] = -1 - Math.random() * 2;
    const b = 0.3 + Math.pow(Math.random(), 2) * 0.9;
    const tinte = Math.random();
    const c =
      tinte < 0.55
        ? new THREE.Color(0.92, 0.95, 1.0)
        : tinte < 0.85
          ? cClaro.clone()
          : cPrincipal.clone();
    col[i * 3] = c.r * b;
    col[i * 3 + 1] = c.g * b;
    col[i * 3 + 2] = c.b * b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 2.0 * dpr(),
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    sizeAttenuation: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}

// Galaxia espiral en partículas (rango 7): densa en el núcleo, con brazos
// que se abren y variedad de color entre el centro caliente y los bordes.
function crearGalaxia(rango: number): THREE.Points {
  const n = cuantas(GALAXIA_BASE);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const pal = paletaDe(rango, null);
  const cNucleo = new THREE.Color('#fff3d0');
  const cMedio = new THREE.Color(pal.claro);
  const cBrazo = new THREE.Color(pal.principal);
  const cBorde = new THREE.Color(pal.apagado);
  for (let i = 0; i < n; i++) {
    const t = Math.pow(Math.random(), 2.2);
    const brazo = i % 4;
    const r = 0.03 + t * 0.85;
    const disp = (Math.random() - 0.5) * (0.12 + t * 0.75);
    const ang = brazo * (Math.PI / 2) + t * 5.0 + disp;
    const grosor = (Math.random() - 0.5) * (0.10 - t * 0.06);
    pos[i * 3] = Math.cos(ang) * r + (Math.random() - 0.5) * 0.03;
    pos[i * 3 + 1] = (Math.sin(ang) * r) * 0.42 + grosor * 0.4;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 0.05;

    let c: THREE.Color;
    if (t < 0.12) c = cNucleo.clone();
    else if (t < 0.4) c = cNucleo.clone().lerp(cMedio, (t - 0.12) / 0.28);
    else if (t < 0.75) c = cMedio.clone().lerp(cBrazo, (t - 0.4) / 0.35);
    else c = cBrazo.clone().lerp(cBorde, (t - 0.75) / 0.25);
    const brillo = (0.45 + Math.pow(Math.random(), 3) * 1.5) * (1.25 - t * 0.5);
    col[i * 3] = c.r * brillo;
    col[i * 3 + 1] = c.g * brillo;
    col[i * 3 + 2] = c.b * brillo;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.9 * dpr(),
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}

// Polvo (rango 1) o estado vacío. Brilla: son las primeras partículas que
// el usuario ve y no pueden parecer apagadas.
function crearPolvo(vacio: boolean, rango: number): THREE.Points {
  const n = vacio ? 6 : cuantas(260);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const pal = paletaDe(rango, null);
  const cA = new THREE.Color(pal.claro);
  const cB = new THREE.Color('#ffffff');
  for (let i = 0; i < n; i++) {
    const r = vacio ? 0.45 + Math.random() * 0.2 : Math.pow(Math.random(), 0.55) * 0.5;
    const a = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * r * (1 + (Math.random() - 0.5) * 0.5);
    pos[i * 3 + 1] = Math.sin(a) * r * 0.75;
    pos[i * 3 + 2] = 0;
    const b = 0.5 + Math.pow(Math.random(), 2) * 1.3;
    const c = cA.clone().lerp(cB, Math.random() * 0.7);
    col[i * 3] = c.r * b;
    col[i * 3 + 1] = c.g * b;
    col[i * 3 + 2] = c.b * b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: (vacio ? 3.4 : 2.6) * dpr(),
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    sizeAttenuation: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}

/**
 * Arma la escena del rango dentro de `contenedor` y devuelve una función
 * para soltarla. El renderer y el canvas son compartidos: no se destruyen,
 * se reusan en la próxima pantalla.
 */
export function montarFondo(contenedor: HTMLElement, op: OpcionesFondo): (() => void) | null {
  const rr = obtenerRenderer();
  if (!rr) return null;
  const { renderer: rend, lienzo: canvas } = rr;
  contenedor.appendChild(canvas);

  const escena = new THREE.Scene();
  const camara = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camara.position.z = 2;

  const materiales: THREE.ShaderMaterial[] = [];
  const orbitantes: { obj: THREE.Object3D; r: number; v: number; f: number; ry: number }[] = [];
  let galaxia: THREE.Points | null = null;
  let auroraMesh: THREE.Mesh | null = null;
  let polvo: THREE.Points | null = null;

  marca('ascent:particulas-inicio');
  // --- campo estelar (el ambiente permanente, teñido por el rango) ---
  const estrellas = crearEstrellas(ESTRELLAS_POR_RANGO[op.rango] ?? 150, op.rango, op.planeta);
  if (op.apagado) (estrellas.material as THREE.PointsMaterial).opacity = 0.35;
  escena.add(estrellas);

  const cfg =
    op.rango === 4 && op.planeta && PLANETAS_CFG[op.planeta]
      ? PLANETAS_CFG[op.planeta]
      : RANGOS_CFG[op.rango];

  const grupo = new THREE.Group();
  escena.add(grupo);

  // --- fantasma de la mejor racha: más grande, detrás, casi invisible ---
  if (op.fantasma) {
    const fcfg =
      op.fantasma.rango === 4 && op.fantasma.planeta && PLANETAS_CFG[op.fantasma.planeta]
        ? PLANETAS_CFG[op.fantasma.planeta]
        : RANGOS_CFG[op.fantasma.rango];
    if (fcfg) {
      const fmat = crearMaterialCuerpo(fcfg, false, 0.004, false, 0.16);
      materiales.push(fmat);
      const fantasma = new THREE.Mesh(QUAD, fmat);
      fantasma.scale.setScalar(1.95);
      fantasma.position.z = -0.2;
      grupo.add(fantasma);
    }
  }

  if (op.vacio || op.rango === 1) {
    polvo = crearPolvo(!!op.vacio, op.rango);
    grupo.add(polvo);
    grupo.scale.setScalar(0.95);
  } else if (op.rango === 7) {
    const amat = crearMaterialCuerpo(AURORA_CFG, !!op.apagado, 0.004);
    materiales.push(amat);
    const aurora = new THREE.Mesh(QUAD, amat);
    aurora.scale.setScalar(1.35);
    aurora.position.z = -0.05;
    amat.blending = THREE.AdditiveBlending;
    grupo.add(aurora);
    auroraMesh = aurora;

    galaxia = crearGalaxia(op.rango);
    grupo.add(galaxia);
    grupo.scale.setScalar(1.5);
  } else if (cfg) {
    const escala = op.rango >= 5 ? 1.45 : 1.25;
    const pixel = 2 / (escala * Math.min(canvas.clientWidth || 400, canvas.clientHeight || 700));
    const mat = crearMaterialCuerpo(cfg, !!op.apagado, pixel, !!op.reposo);
    materiales.push(mat);
    const cuerpo = new THREE.Mesh(QUAD, mat);
    cuerpo.scale.setScalar(escala);
    grupo.add(cuerpo);

    for (let i = 0; i < cfg.lunas; i++) {
      const lmat = crearMaterialCuerpo(LUNA_CFG, !!op.apagado, 0.02, !!op.reposo);
      materiales.push(lmat);
      const luna = new THREE.Mesh(QUAD, lmat);
      luna.scale.setScalar(escala * (0.16 + i * 0.05));
      luna.position.z = 0.01;
      grupo.add(luna);
      orbitantes.push({
        obj: luna,
        r: escala * (0.78 + i * 0.28),
        v: 0.30 / (1 + i * 0.5),
        f: i * 2.1,
        ry: 0.30,
      });
    }

    // Rango 6 (Sistema): un sol chico y muchos planetas más chicos todavía.
    if (op.rango === 6) {
      cuerpo.scale.setScalar(escala * 0.17);
      const nombres = ['Mercurio', 'Venus', 'Tierra', 'Marte', 'Júpiter', 'Saturno', 'Neptuno'] as const;
      for (let i = 0; i < nombres.length; i++) {
        const pcfg = PLANETAS_CFG[nombres[i]];
        const pmat = crearMaterialCuerpo(pcfg, !!op.apagado, 0.008, !!op.reposo);
        materiales.push(pmat);
        const planeta = new THREE.Mesh(QUAD, pmat);
        planeta.scale.setScalar(escala * (0.045 + i * 0.011));
        grupo.add(planeta);
        orbitantes.push({
          obj: planeta,
          r: escala * (0.26 + i * 0.155),
          v: 0.30 / (1 + i * 0.55),
          f: i * 1.35,
          ry: 0.34,
        });
      }
    }
  }
  marca('ascent:particulas-fin');
  medir('ascent:escena-armado', 'ascent:particulas-inicio', 'ascent:particulas-fin');

  const esquina = op.esquina ?? 'abajo-derecha';

  let vivo = true;
  let pausado = false;
  const reloj = new THREE.Clock();
  let tiempo = Math.random() * 100;

  function ubicarOrbitantes() {
    for (const o of orbitantes) {
      o.obj.position.set(
        Math.cos(tiempo * o.v + o.f) * o.r,
        Math.sin(tiempo * o.v + o.f) * o.r * o.ry,
        0
      );
    }
  }

  function medirLienzo() {
    const w = contenedor.clientWidth || window.innerWidth;
    const h = contenedor.clientHeight || window.innerHeight;
    rend.setSize(w, h, false);
    rend.setPixelRatio(dpr());
    const asp = w / h;
    camara.left = -asp;
    camara.right = asp;
    camara.updateProjectionMatrix();
    if (esquina === 'abajo-derecha') grupo.position.set(asp * 0.8, -0.72, 0);
    else if (esquina === 'arriba-derecha') grupo.position.set(asp * 0.82, 0.72, 0);
    else grupo.position.set(0, 0, 0);
  }
  medirLienzo();

  for (const m of materiales) m.uniforms.uTime.value = tiempo;
  ubicarOrbitantes();

  function frame() {
    if (!vivo) return;
    if (!pausado) {
      tiempo += reloj.getDelta();
      for (const m of materiales) m.uniforms.uTime.value = tiempo;
      ubicarOrbitantes();
      if (galaxia) galaxia.rotation.z = tiempo * 0.022;
      if (auroraMesh) auroraMesh.rotation.z = tiempo * 0.022;
      if (polvo) polvo.rotation.z = tiempo * 0.03;
      rend.render(escena, camara);
    }
    if (op.animar !== false) requestAnimationFrame(frame);
  }

  // Primer frame ya mismo: acá es donde se compilan los shaders la primera
  // vez. De la segunda pantalla en adelante el programa ya está en caché
  // del renderer compartido y esto cuesta casi nada.
  marca('ascent:shader-inicio');
  rend.render(escena, camara);
  marca('ascent:shader-fin');
  medir('ascent:shader-compilacion', 'ascent:shader-inicio', 'ascent:shader-fin');

  if (op.animar !== false) requestAnimationFrame(frame);

  const onVis = () => {
    pausado = document.hidden;
    if (!pausado) reloj.getDelta();
  };
  document.addEventListener('visibilitychange', onVis);
  const onResize = () => medirLienzo();
  window.addEventListener('resize', onResize);

  return () => {
    vivo = false;
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('resize', onResize);
    // se sueltan las geometrías y materiales de ESTA escena, pero el
    // renderer y el canvas siguen vivos para la próxima pantalla
    escena.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && m.geometry !== QUAD) m.geometry.dispose();
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
    });
  };
}
