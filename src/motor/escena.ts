import * as THREE from 'three';
import {
  VERTEX,
  FRAGMENT,
  VERTEX_PUNTOS,
  FRAGMENT_PUNTOS,
  FRAGMENT_PRESAGIO,
} from './shaders';
import { RANGOS_CFG, PLANETAS_CFG, ESTRELLAS_POR_RANGO, type ConfigCuerpo } from './cuerpos';
import { paletaDe } from '@/lib/paletas';
import { marca, medir } from '@/lib/medir';
import { ALTURA, alturaDelPulso, siguePulsando } from '@/lib/pulso';
import { plataforma } from '@/plataforma';

export type OpcionesFondo = {
  rango: number;
  planeta?: string | null; // nombre del planeta del día (rango 4)
  apagado?: boolean; // pérdida de racha: el fondo se apaga
  vacio?: boolean; // estado vacío: el espacio antes de que se forme nada
  reposo?: boolean; // día de descanso: cara nocturna y giro frenado
  // fantasma de la mejor racha: el objeto más grande que se alcanzó alguna vez,
  // apenas insinuado detrás del actual
  fantasma?: { rango: number; planeta?: string | null } | null;
  // presagio: los últimos días antes de subir, algo SIN FORMA detrás del
  // objeto. Ver `lib/atmosfera.ts` y FRAGMENT_PRESAGIO.
  presagio?: boolean;
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

// Nebulosa del rango 1. Lleva paleta propia y NO la del rango: la tabla de
// paletas manda en la interfaz, pero un polvo gris plano se ve pobre. Acá
// van azules, violetas y un cálido mezclándose, como una nebulosa de verdad.
const NEBULOSA: [string, string, string, string] = ['#1b1235', '#2c3d86', '#7d5cc4', '#e0946a'];

const NEBULOSA_CFG: ConfigCuerpo = {
  paleta: NEBULOSA,
  bandas: 0, contraste: 0, turbulencia: 1.4, tormenta: 0, tormentaPos: [0, 0],
  anillo: false, anilloVertical: false, crateres: 0, casquetes: 0,
  continentes: 0, puntos: 0, mares: 0, manchas: 0, rayos: 0, lunas: 0, modo: 5,
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
  const tam = new Float32Array(n);
  const bri = new Float32Array(n);
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
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
    // unas pocas estrellas bastante más grandes que el resto
    const grande = Math.random() < 0.04;
    tam[i] = grande ? 3.4 + Math.random() * 2.2 : 1.0 + Math.pow(Math.random(), 2.5) * 1.9;
    bri[i] = b * (grande ? 1.3 : 1.0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('tamano', new THREE.BufferAttribute(tam, 1));
  geo.setAttribute('brillo', new THREE.BufferAttribute(bri, 1));
  return new THREE.Points(geo, materialPuntos());
}

// Galaxia espiral en partículas (rango 7): densa en el núcleo, con brazos
// que se abren y variedad de color entre el centro caliente y los bordes.
function crearGalaxia(rango: number): THREE.Points {
  const n = cuantas(GALAXIA_BASE);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const tam = new Float32Array(n);
  const bri = new Float32Array(n);
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
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
    const grande = Math.random() < 0.05;
    tam[i] = grande ? 3.0 + Math.random() * 2.0 : 1.0 + Math.pow(Math.random(), 2.2) * 1.8;
    bri[i] = (0.35 + Math.pow(Math.random(), 3) * 1.2) * (1.25 - t * 0.5);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('tamano', new THREE.BufferAttribute(tam, 1));
  geo.setAttribute('brillo', new THREE.BufferAttribute(bri, 1));
  return new THREE.Points(geo, materialPuntos());
}

// Material de partículas redondas y suaves. PointsMaterial dibuja cuadrados
// duros; con shader propio cada partícula lleva su tamaño y su brillo.
function materialPuntos(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX_PUNTOS,
    fragmentShader: FRAGMENT_PUNTOS,
    uniforms: { uTime: { value: 0 }, uDpr: { value: dpr() } },
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/**
 * El material del presagio.
 *
 * Lo pinta la paleta del rango ACTUAL, nunca la del siguiente: el color del
 * Sol es amarillo y usarlo antes de llegar contaría el final. Lo único que
 * tiene derecho a decir es "hay algo".
 */
function materialPresagio(rango: number, planeta?: string | null): THREE.ShaderMaterial {
  const pal = paletaDe(rango, planeta);
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT_PRESAGIO,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: colorU(pal.claro) },
      // Calibrado mirando capturas, no a ojo sobre el código. Con 0.2 no se
      // veía NADA —y un presagio que no se percibe no es sutil, es un presagio
      // que no existe—; con 0.75 se convertía en un halo y el halo es una
      // forma. 0.5 se nota sin poder decir qué es, que es exactamente el
      // encargo.
      uFuerza: { value: 0.5 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/**
 * Polvo (rango 1) o estado vacío.
 *
 * No son puntos sueltos: es una nube. La densidad es despareja a propósito
 * —hay grumos y hay vacíos— y el color mezcla azules, violetas y un cálido,
 * porque un gris plano se ve pobre.
 */
function crearPolvo(vacio: boolean): THREE.Points {
  const n = vacio ? 8 : cuantas(700);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const tam = new Float32Array(n);
  const bri = new Float32Array(n);

  const paleta = NEBULOSA.map((h) => new THREE.Color(h));
  // núcleos de condensación: alrededor de estos se junta el gas
  const grumos = Array.from({ length: 5 }, () => ({
    x: (Math.random() - 0.5) * 0.8,
    y: (Math.random() - 0.5) * 0.6,
    r: 0.10 + Math.random() * 0.20,
  }));

  for (let i = 0; i < n; i++) {
    let x: number, y: number;
    if (!vacio && Math.random() < 0.68) {
      // la mayoría cae dentro de un grumo: eso arma las zonas cargadas
      const g = grumos[Math.floor(Math.random() * grumos.length)];
      const a = Math.random() * Math.PI * 2;
      const d = Math.pow(Math.random(), 0.7) * g.r;
      x = g.x + Math.cos(a) * d;
      y = g.y + Math.sin(a) * d * 0.8;
    } else {
      // el resto queda suelto por el medio, dejando zonas casi vacías
      const a = Math.random() * Math.PI * 2;
      const d = vacio ? 0.42 + Math.random() * 0.22 : Math.pow(Math.random(), 0.5) * 0.62;
      x = Math.cos(a) * d;
      y = Math.sin(a) * d * 0.78;
    }
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = 0;

    // tamaños muy variados, con unas pocas mucho más grandes que el resto
    const grande = Math.random() < 0.06;
    tam[i] = grande ? 4.5 + Math.random() * 4 : 1.1 + Math.pow(Math.random(), 2.2) * 2.6;
    bri[i] = grande ? 0.85 + Math.random() * 0.5 : 0.18 + Math.pow(Math.random(), 2) * 0.75;

    // color: casi todas azul-violeta, unas pocas cálidas, algunas casi blancas
    const t = Math.random();
    let c: THREE.Color;
    if (t < 0.42) c = paleta[1].clone().lerp(paleta[2], Math.random());
    else if (t < 0.74) c = paleta[2].clone().lerp(paleta[0], Math.random() * 0.6);
    else if (t < 0.88) c = paleta[3].clone().lerp(paleta[2], Math.random() * 0.5);
    else c = new THREE.Color('#eaf0ff').lerp(paleta[2], Math.random() * 0.35);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('tamano', new THREE.BufferAttribute(tam, 1));
  geo.setAttribute('brillo', new THREE.BufferAttribute(bri, 1));
  return new THREE.Points(geo, materialPuntos());
}

/**
 * Arma la escena del rango dentro de `contenedor` y devuelve una función
 * para soltarla. El renderer y el canvas son compartidos: no se destruyen,
 * se reusan en la próxima pantalla.
 */
/**
 * Lo que devuelve montar el fondo: cómo soltarlo, y cómo hacerlo reaccionar.
 *
 * `pulso()` es el impacto de registrar el día (§ el momento 2): la luz del
 * cuerpo sube y vuelve. Va acá adentro y no en CSS porque lo que tiene que
 * brillar es el objeto RENDERIZADO, no una capa encima: un destello dibujado
 * arriba se ve pegado, y todo el punto del gesto es que el día se sumó AL
 * cuerpo.
 */
export type Montaje = {
  soltar: () => void;
  pulso: () => void;
};

export function montarFondo(contenedor: HTMLElement, op: OpcionesFondo): Montaje | null {
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
  materiales.push(estrellas.material as THREE.ShaderMaterial);
  escena.add(estrellas);

  const cfg =
    op.rango === 4 && op.planeta && PLANETAS_CFG[op.planeta]
      ? PLANETAS_CFG[op.planeta]
      : RANGOS_CFG[op.rango];

  const grupo = new THREE.Group();
  escena.add(grupo);

  // --- el presagio: los últimos días antes de subir ---
  //
  // VA ANTES DEL FANTASMA Y LO REEMPLAZA. Los dos ocupan el mismo lugar —más
  // grande, detrás, tenue— y pueden coincidir de verdad: alguien que tuvo 50
  // de racha, la perdió y va por 28 tiene fantasma (su mejor) y presagio (le
  // faltan 2). Dos manchas detrás del objeto no se leen como dos cosas, se
  // leen como una mancha sucia. Gana el presagio porque habla del día de hoy;
  // el fantasma habla de un récord que no se va a mover en estos dos días.
  if (op.presagio) {
    const pmat = materialPresagio(op.rango, op.planeta);
    materiales.push(pmat);
    const presagio = new THREE.Mesh(QUAD, pmat);
    // Más chico que el 2.6 del primer intento: con el campo tan abierto, el
    // centro caía fuera de la pantalla —el cuerpo vive en una esquina— y lo
    // único que llegaba a verse era la cola del degradado.
    presagio.scale.setScalar(2.0);
    presagio.position.z = -0.3;
    grupo.add(presagio);
  } else if (op.fantasma) {
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
    // el gas primero, las partículas encima: juntos leen como una nube
    const nmat = crearMaterialCuerpo(NEBULOSA_CFG, !!op.apagado, 0.004);
    nmat.blending = THREE.AdditiveBlending;
    materiales.push(nmat);
    const nebulosa = new THREE.Mesh(QUAD, nmat);
    nebulosa.scale.setScalar(1.5);
    nebulosa.position.z = -0.1;
    grupo.add(nebulosa);

    polvo = crearPolvo(!!op.vacio);
    materiales.push(polvo.material as THREE.ShaderMaterial);
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
    materiales.push(galaxia.material as THREE.ShaderMaterial);
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

  // El motor no anima con la app atrás: son sesenta cuadros por segundo de
  // GPU para algo que nadie está mirando.
  const dejarDeMirar = plataforma.ciclo.alCambiar((visible) => {
    pausado = !visible;
    // Se descarta el delta acumulado: si no, al volver el primer cuadro
    // adelanta de golpe todo el tiempo que estuvo pausado.
    if (visible) reloj.getDelta();
  });
  const onResize = () => medirLienzo();
  window.addEventListener('resize', onResize);

  /**
   * EL IMPACTO. Sube `uAtenua` y lo deja volver.
   *
   * La FORMA de la curva vive en `lib/pulso.ts` y está probada con números:
   * acá quedó solo la parte que necesita el motor —sobre qué materiales
   * aplicarla y cómo volver al reposo exacto—, porque la parte que se puede
   * equivocar sin que se note es la aritmética, y esa ya no está acá.
   *
   * Se toca `uAtenua`, que ya existía para el fantasma de la mejor racha. Un
   * uniform nuevo habría sido otro parámetro más en un shader que ya tiene
   * veinte, para hacer exactamente lo mismo.
   */
  let pulsando = 0;

  /** El brillo de reposo de cada material, para poder volver EXACTO. */
  function baseDe(m: THREE.ShaderMaterial): number {
    if (m.userData.atenuaBase === undefined) {
      m.userData.atenuaBase = m.uniforms.uAtenua?.value ?? 1;
    }
    return m.userData.atenuaBase as number;
  }

  function pulso() {
    // Deja rastro SIEMPRE, incluso cuando no se anima: si no, "el pulso no se
    // ve" tiene dos causas —no llegó el aviso, o llegó y el motor está en modo
    // sin animación— y desde afuera se ven exactamente iguales. Me pasó.
    marca('ascent:pulso');
    if (op.animar === false) return;
    const yaEstaba = pulsando;
    // Si ya hay uno corriendo se reinicia en vez de sumarse: dos toques
    // seguidos no pueden dejar el objeto el doble de brillante.
    pulsando = performance.now();
    if (yaEstaba) return;

    const paso = (ahora: number) => {
      if (!vivo) return;
      const t = ahora - pulsando;
      const f = alturaDelPulso(t);
      for (const m of materiales) {
        if (!m.uniforms.uAtenua) continue;
        m.uniforms.uAtenua.value = baseDe(m) * (1 + ALTURA * f);
      }
      if (siguePulsando(t)) {
        requestAnimationFrame(paso);
      } else {
        // Se vuelve al valor EXACTO de reposo y no a `base * 1`: si no, cada
        // pulso deja su pizca de error de coma flotante.
        for (const m of materiales) {
          if (m.uniforms.uAtenua) m.uniforms.uAtenua.value = baseDe(m);
        }
        pulsando = 0;
      }
    };
    requestAnimationFrame(paso);
  }

  const soltar = () => {
    vivo = false;
    dejarDeMirar();
    window.removeEventListener('resize', onResize);
    // se sueltan las geometrías y materiales de ESTA escena, pero el
    // renderer y el canvas siguen vivos para la próxima pantalla
    escena.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && m.geometry !== QUAD) m.geometry.dispose();
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
    });
  };

  return { soltar, pulso };
}
