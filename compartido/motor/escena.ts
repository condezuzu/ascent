// EL MOTOR DE CUERPOS CELESTES — el núcleo, compartido entre la web y la app
// nativa.
//
// VIVE EN `compartido/` desde el 18/9. Antes estaba en `src/motor/` y hablaba
// con el DOM directo; ahora todo lo que depende de la plataforma se le pide a
// un `Lienzo` (ver el tipo, más abajo), y este archivo no toca ni `window` ni
// `document`. La web le arma el lienzo con un `<canvas>` (`src/motor/escena.ts`)
// y la nativa con `expo-gl`.
//
// Separarlo se verificó con `herramientas/medir-animacion.mjs`: los 8 rangos y
// 4 planetas, 8 cuadros cada uno, idénticos al byte antes y después.
import * as THREE from 'three';
import {
  VERTEX,
  FRAGMENT,
  VERTEX_PUNTOS,
  VERTEX_FUGAZ,
  FRAGMENT_FUGAZ,
  FRAGMENT_PUNTOS,
  FRAGMENT_PRESAGIO,
  FRAGMENT_PLANO,
} from './shaders';
import { RANGOS_CFG, PLANETAS_CFG, ESTRELLAS_POR_RANGO, type ConfigCuerpo } from './cuerpos';
import { paletaDe } from '@nucleo/paletas';
import { marca, medir } from '@compartido/medir';
import { ALTURA, alturaDelPulso, siguePulsando } from '@nucleo/pulso';
import { debeDibujar, ESPERA_LENTO_MS } from '@nucleo/quietud';
import { VIAJE_DE_ESQUINA_MS } from '@nucleo/animacion';
import { plataforma } from '@plataforma';
import { nivelDeNoche } from '@nucleo/noche';

/** Como se dibujan los cuerpos. Ver `FRAGMENT_PLANO` en `shaders.ts`. */
export type Estilo = 'realista' | 'plano';

export type OpcionesFondo = {
  rango: number;
  planeta?: string | null; // nombre del planeta del día (rango 4)
  apagado?: boolean; // pérdida de racha: el fondo se apaga
  vacio?: boolean; // estado vacío: el espacio antes de que se forme nada
  /**
   * SOLO EL CIELO: el campo estelar teñido por el rango, sin ningún cuerpo.
   *
   * Pedido el 23/9 para la app del teléfono. El cuerpo viajaba de esquina
   * entre pestañas y en Ranking quedaba arriba a la derecha, donde molesta:
   * la decisión es que **el cuerpo se vea solo en Inicio**. En las otras
   * cuatro pestañas queda el ambiente y nada más.
   *
   * Y de paso se lleva puesto el problema del viaje entre esquinas: si no
   * hay cuerpo, no hay nada que mover.
   *
   * NO ES LO MISMO QUE `vacio`, que dibuja una nebulosa con cuatro
   * partículas —el espacio ANTES de que se forme nada, que es un estado de
   * la cuenta—. Esto es una decisión de pantalla: el cuerpo existe, acá no
   * se muestra.
   */
  soloEstrellas?: boolean;
  reposo?: boolean; // día de descanso: cara nocturna y giro frenado
  // fantasma de la mejor racha: el objeto más grande que se alcanzó alguna vez,
  // apenas insinuado detrás del actual
  fantasma?: { rango: number; planeta?: string | null } | null;
  // presagio: los últimos días antes de subir, algo SIN FORMA detrás del
  // objeto. Ver `lib/atmosfera.ts` y FRAGMENT_PRESAGIO.
  presagio?: boolean;
  // posición del cuerpo: se recorta por una esquina, nunca centrado
  esquina?: Esquina;
  animar?: boolean; // false => un solo frame estático (reduced motion / equipos lentos)
  estilo?: Estilo;
  /** Fuerza el nivel de la cara nocturna. Solo la galeria lo usa. */
  noche?: number;
};

// El quad SIEMPRE mide 2x2 para que vP vaya de -1 a 1 y el shader dibuje el
// disco completo. El tamaño en pantalla lo da mesh.scale, nunca la geometría.
const QUAD = new THREE.PlaneGeometry(2, 2);

function colorU(hex: string) {
  return new THREE.Color(hex);
}

// LA DENSIDAD DEL LIENZO QUE SE ESTÁ ARMANDO. Los materiales de partículas la
// necesitan al crearse, y se crean adentro de `montarEscena`, que es neutral:
// no puede preguntarle al `window`. Se fija al empezar a montar con lo que
// dice el lienzo, y es la misma cuenta que `dpr()` en la web.
let densidadActual = 1;

// -------------------------------------------------------------------
// NIVEL DEL EQUIPO
// En un teléfono viejo no tiene sentido tirar 4200 partículas: de acá sale
// un multiplicador para todo lo pesado.
//
// LO DICE EL LIENZO, como la densidad. Medirlo es cosa de cada plataforma —la
// web mira `navigator.hardwareConcurrency` (ver `src/lib/equipo.ts`)— y el
// núcleo no puede preguntar eso. Se fija al empezar a montar.
// -------------------------------------------------------------------
export type Nivel = 'bajo' | 'medio' | 'alto';
let nivelActual: Nivel = 'medio';

const FACTOR: Record<Nivel, number> = { bajo: 0.3, medio: 0.6, alto: 1 };

function cuantas(base: number): number {
  return Math.max(24, Math.round(base * FACTOR[nivelActual]));
}

const ESTRELLAS_TOPE = 1400;
const GALAXIA_BASE = 4200;

export function crearMaterialCuerpo(
  cfg: ConfigCuerpo,
  apagado: boolean,
  pixel: number,
  reposo = false,
  atenua = 1,
  // EL ESTILO PLANO comparte TODOS los uniforms con el realista y solo cambia
  // el fragmento. Asi se pueden mirar uno al lado del otro sin duplicar el
  // armado de la escena, y el camino de siempre no se toca: si nunca se pide
  // 'plano', esto es exactamente el codigo de antes.
  estilo: Estilo = 'realista',
  noche = 0
) {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: estilo === 'plano' ? FRAGMENT_PLANO : FRAGMENT,
    // Un programa por modo: ver `MODO` en shaders.ts.
    defines: { MODO: cfg.modo },
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
      uModo: { value: cfg.modo }, // solo lo lee FRAGMENT_PLANO
      uCero: { value: 0 },
      uCrateres: { value: cfg.crateres },
      uCasquetes: { value: cfg.casquetes },
      uContinentes: { value: cfg.continentes },
      uPuntos: { value: cfg.puntos },
      uMares: { value: cfg.mares },
      uManchas: { value: cfg.manchas },
      uRayos: { value: cfg.rayos },
      uReposo: { value: reposo ? 1 : 0 },
      uNoche: { value: noche },
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
// LA NEBULOSA, MÁS SATURADA. Los mismos cuatro colores, con el tinte subido:
// el plano de fondo aportaba luminosidad pero casi nada de color, así que el
// polvo se leía como un manchón gris en vez de como gas. El polvo espacial de
// verdad no es gris —tiene violetas, azules y un cálido— y esta paleta ya lo
// decía; lo que faltaba era que se notara.
const NEBULOSA: [string, string, string, string] = ['#241540', '#2f45a8', '#8f5fe0', '#f0a06a'];

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

/**
 * `asp` es ancho / alto del lienzo: la cámara ve x entre -asp y asp, y entre
 * -1 y 1.
 */
function crearEstrellas(cantidad: number, rango: number, planeta: string | null | undefined, asp: number): THREE.Points {
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
  // EN LO QUE SE VE (19/9). Se repartían en un cuadrado de -2 a 2, y la
  // cámara de un teléfono parado ve x de -0,46 a 0,46: caía adentro UNA DE
  // CADA NUEVE (46 de las 400 del rango 1). "Casi no se ven, y no están por
  // toda la pantalla" era eso. Ahora van en lo que la cámara ve, con un poco
  // de margen para la deriva.
  const ancho = Math.max(0.3, asp) * 1.1;
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 2 * ancho;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 2 * 1.08;
    pos[i * 3 + 2] = -1 - Math.random() * 2;
    // MÁS BRILLO, SIN MÁS TAMAÑO. "Las veo pero están muy apagadas": era
    // `0.3 + azar² · 0.9`, y elevar al cuadrado amontona casi todas contra el
    // piso de 0,3. Ahora el piso sube y la curva se afloja, así que la mayoría
    // queda en la mitad de arriba del rango en vez de en el sótano.
    //
    // El brillo es GRATIS y el tamaño no: lo que cuesta en un teléfono flojo es
    // el área que hay que pintar, no el valor del color que se pinta. Por eso
    // se toca esto y no `tam`.
    // Y un piso más alto (19/9): detrás del velo de la interfaz, las tenues no
    // llegaban a verse.
    const b = 0.6 + Math.pow(Math.random(), 1.4) * 0.9;
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
  return new THREE.Points(geo, materialPuntos(true));
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
    // LAS ESTRELLAS LLEGAN HASTA DONDE LLEGA EL GAS. Con 2,2 el exponente
    // amontonaba casi todo contra el núcleo —la mediana caía en el 22% del
    // radio— y los brazos de gas quedaban vacíos: un manchón de puntos en el
    // medio y una espiral de humo alrededor, que es parte de por qué "parece
    // una mancha". El núcleo sigue siendo denso, pero ahora los brazos tienen
    // estrellas adentro.
    const t = Math.pow(Math.random(), 1.35);
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

/**
 * UNA ESTRELLA FUGAZ DE VEZ EN CUANDO (19/9).
 *
 * Cruza en diagonal hacia abajo por la parte de arriba de la pantalla, en un
 * segundo, y vuelve a pasar entre 9 y 24 segundos después. Detrás del planeta
 * (z entre las estrellas y el cuerpo). Solo con movimiento: con "reducir
 * movimiento" o el fondo quieto no hay cuadros, y no pasa.
 *
 * Es un quad estirado con un shader que se afina hacia la cola, no una línea
 * de WebGL: las líneas tienen un píxel de ancho y sin suavizado.
 */
function crearFugaz(rango: number, planeta?: string | null) {
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_FUGAZ,
    fragmentShader: FRAGMENT_FUGAZ,
    uniforms: {
      uTime: { value: 0 },
      uAlfa: { value: 0 },
      uColor: { value: new THREE.Color('#eef2ff').lerp(new THREE.Color(paletaDe(rango, planeta).claro), 0.25) },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.visible = false;
  const DURA = 1.0;
  let proxima = 4 + Math.random() * 8;
  let desde = 0;
  let inicio = new THREE.Vector2();
  let dir = new THREE.Vector2();
  let recorre = 0.8;

  return {
    mesh,
    actualizar(tiempo: number, asp: number) {
      if (!mesh.visible) {
        if (tiempo < proxima) return;
        // Arranca arriba, de un costado, y baja hacia el otro.
        const haciaIzq = Math.random() < 0.5;
        inicio = new THREE.Vector2((Math.random() * 0.8 + 0.1) * asp * (haciaIzq ? 1 : -1), 0.35 + Math.random() * 0.55);
        const ang = (haciaIzq ? Math.PI : 0) + (haciaIzq ? 1 : -1) * (0.35 + Math.random() * 0.3);
        dir = new THREE.Vector2(Math.cos(ang), Math.sin(ang));
        recorre = 0.6 + Math.random() * 0.5;
        mesh.rotation.z = Math.atan2(dir.y, dir.x);
        mesh.scale.set(0.28 + Math.random() * 0.14, 0.012, 1);
        mesh.position.z = -0.5;
        desde = tiempo;
        mesh.visible = true;
      }
      const t = (tiempo - desde) / DURA;
      if (t >= 1) {
        mesh.visible = false;
        material.uniforms.uAlfa.value = 0;
        proxima = tiempo + 9 + Math.random() * 15;
        return;
      }
      // La cabeza avanza; el quad va centrado medio largo detrás de ella.
      const cabeza = inicio.clone().add(dir.clone().multiplyScalar(recorre * t));
      const centro = cabeza.clone().sub(dir.clone().multiplyScalar(mesh.scale.x / 2));
      mesh.position.x = centro.x;
      mesh.position.y = centro.y;
      material.uniforms.uAlfa.value = Math.sin(Math.PI * t) * 0.9;
    },
  };
}

// Material de partículas redondas y suaves. PointsMaterial dibuja cuadrados
// duros; con shader propio cada partícula lleva su tamaño y su brillo.
// `titila`: solo las estrellas (19/9). La galaxia y el polvo son miles de
// partículas juntas, y titilando se verían como ruido.
function materialPuntos(titila = false): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX_PUNTOS,
    fragmentShader: FRAGMENT_PUNTOS,
    uniforms: {
      uTime: { value: 0 },
      uDpr: { value: densidadActual },
      uTitila: { value: titila ? 1 : 0 },
      // La lente del agujero negro. Arranca apagada (radio 0) y solo el rango 8
      // la enciende; el resto de los rangos ni entra en esa rama del shader.
      uLenteC: { value: new THREE.Vector2(0, 0) },
      uLenteR: { value: 0 },
    },
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
    // MENOS BLANCO. Eran el 12% en `#eaf0ff` mezclado apenas un 35% hacia el
    // violeta, y con mezcla aditiva esos blancos se apilaban en un velo
    // blancuzco: la nube leía como bruma gris en vez de gas con color. Ahora
    // son el 4% y van mucho más hacia el violeta de la paleta.
    //
    // El lugar que dejan se lo lleva el cálido (`paleta[3]`, el naranja), que
    // es lo que hace que una nebulosa se vea como una nebulosa y no como humo.
    if (t < 0.42) c = paleta[1].clone().lerp(paleta[2], Math.random());
    else if (t < 0.72) c = paleta[2].clone().lerp(paleta[0], Math.random() * 0.6);
    else if (t < 0.96) c = paleta[3].clone().lerp(paleta[2], Math.random() * 0.5);
    else c = new THREE.Color('#eaf0ff').lerp(paleta[2], 0.45 + Math.random() * 0.3);
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
/** Dónde se recorta el cuerpo. Nunca centrado en las pantallas con contenido. */
export type Esquina = 'abajo-derecha' | 'arriba-derecha' | 'centro';

export type Montaje = {
  soltar: () => void;
  pulso: () => void;
  /**
   * Detiene el dibujo sin soltar nada, y lo reanuda.
   *
   * Lo usa la app nativa, donde el contexto de GL vive en la raíz y la escena
   * de Inicio se GUARDA al cambiar de pestaña: soltarla borraría los
   * programas de la GPU y al volver habría que compilarlos de nuevo (medido:
   * 6 shaders y 3 programas por cada vuelta a Inicio). La web no lo usa —ahí
   * cada pantalla monta y suelta su escena—.
   */
  pausar: (si: boolean) => void;
  /**
   * MUEVE EL CUERPO A OTRA ESQUINA, viajando (23/9).
   *
   * Antes la esquina era parte de la identidad de la escena: cambiarla la
   * armaba de nuevo, y el cuerpo aparecía en el otro lado de un cuadro para el
   * otro. Entre Inicio (abajo) y Ranking (arriba) eso es un salto de media
   * pantalla, y se ve como un corte.
   *
   * NO SIGUE AL DEDO a propósito: el gesto mueve las pantallas, no el fondo. El
   * fondo es de todas, y atarlo al dedo lo convertiría en parte de una.
   */
  mover: (esquina: Esquina) => void;
  /**
   * EL FONDO ESTÁ TAPADO: dibujar menos, porque no se ve (25/9).
   *
   * DE DÓNDE SALE, y es de lo más claro que dio medir: con el fondo prendido,
   * la app entera va al mismo ritmo haciendo cualquier cosa —deslizar entre
   * pestañas, abrir una foto, o NADA—. O sea que el costo no es de ninguna
   * transición: es un piso que está abajo de todo, y es el motor dibujando a
   * sesenta cuadros por segundo. Apagándolo, las mismas transiciones pasan de
   * diez cuadros por segundo a sesenta.
   *
   * Y DESDE QUE EL CUERPO ESTÁ SIEMPRE (25/9) ese piso se paga en las cinco
   * pestañas, no en una. Fuera de Inicio el fondo va desenfocado a propósito:
   * se está gastando la GPU en animar con todo detalle algo que está detrás de
   * un vidrio esmerilado.
   *
   * QUÉ HACE: baja al escalón LENTO de `nucleo/quietud.ts` —doce cuadros por
   * segundo, o algo más si hay algo moviéndose— sin importar cuánto hace que
   * se tocó la pantalla. No congela: congelar de golpe se ve, y además el
   * viaje del cuerpo entre esquinas ocurre justamente mientras está tapado.
   *
   * NO LO USA LA WEB, donde el desenfoque es CSS y cada pantalla monta y
   * suelta su escena. Sin llamarlo, nada cambia.
   */
  tapar: (si: boolean) => void;
  /**
   * Se cumple cuando el primer cuadro ya se dibujó: los shaders compilaron.
   * Hasta ahí el canvas está vacío, y la pantalla sigue mostrando el fondo de
   * CSS. La web espera esto para el fundido de entrada.
   */
  listo: Promise<void>;
};

/**
 * DÓNDE DIBUJA EL MOTOR: lo único de la escena que depende de la plataforma.
 *
 * El motor se comparte entre la web y la app nativa, y lo que cambia entre
 * las dos es muy poco y está todo acá: de dónde sale el tamaño, cómo se pide
 * el próximo cuadro, cómo se entera de que alguien tocó la pantalla. La web
 * lo resuelve con el DOM (`src/motor/escena.ts`); la nativa, con `expo-gl`.
 *
 * Todo lo demás —shaders, cuerpos, partículas, quietud, pulso— es igual en
 * las dos, y ESA es la razón de compartirlo: un segundo motor arrancaría
 * idéntico y en tres meses serían dos productos.
 */
export type Lienzo = {
  renderer: THREE.WebGLRenderer;
  /** Tamaño en puntos (no en píxeles físicos) de donde se dibuja. */
  tamano: () => { w: number; h: number };
  /** Píxeles físicos por punto, con el tope ya aplicado. */
  densidad: () => number;
  /** Cuánto se le puede pedir al aparato: decide cuántas partículas. */
  nivel: () => Nivel;
  /** Pide el próximo cuadro. `fn` recibe la hora del cuadro, en el reloj de `performance.now`. */
  cuadro: (fn: (t: number) => void) => void;
  /**
   * Después de cada `render`. En la web no hace nada: el navegador presenta
   * solo. `expo-gl` no, y sin esto el cuadro se dibuja y no se ve.
   */
  presentar: () => void;
  /** Avisa cuando hay una señal de que alguien está mirando. Devuelve cómo dejar de escuchar. */
  alDespertar: (fn: () => void) => () => void;
  /** Avisa cuando cambia el tamaño. Devuelve cómo dejar de escuchar. */
  alCambiarDeTamano: (fn: () => void) => () => void;
};

/**
 * EL NÚCLEO: arma la escena del rango sobre un lienzo cualquiera y devuelve
 * cómo soltarla. El renderer es compartido: no se destruye, se reusa en la
 * próxima pantalla.
 *
 * NO TOCA NI `window` NI `document`: todo lo que depende de la plataforma se
 * le pide a `l`. Así es como la app nativa usa este mismo archivo.
 */
export function montarEscena(l: Lienzo, op: OpcionesFondo): Montaje {
  const rend = l.renderer;
  densidadActual = l.densidad();
  nivelActual = l.nivel();

  const escena = new THREE.Scene();
  const camara = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camara.position.z = 2;

  const materiales: THREE.ShaderMaterial[] = [];
  // `s` es la escala de frente: atrás se achica un poco y adelante crece, para
  // que se lea la distancia (ver `ubicarOrbitantes`).
  const orbitantes: { obj: THREE.Object3D; r: number; v: number; f: number; ry: number; s: number }[] = [];
  let galaxia: THREE.Points | null = null;
  let auroraMesh: THREE.Mesh | null = null;
  let polvo: THREE.Points | null = null;

  marca('ascent:particulas-inicio');
  // --- campo estelar (el ambiente permanente, teñido por el rango) ---
  const cajaInicial = l.tamano();
  // MÁS ESTRELLAS CUANDO NO HAY CUERPO (24/9, a pedido: "quedan muy vacías").
  //
  // Ranking, Álbum, Stats y Ajustes piden `soloEstrellas`, y hasta ahora usaban
  // el mismo campo que Inicio — pensado para acompañar a un planeta que ocupa
  // media pantalla. Sin el planeta, ese mismo campo se lee como un cielo casi
  // vacío: lo que era el ambiente pasó a ser todo lo que hay.
  //
  // Y NO CUESTA: sin cuerpo no se construye ni el planeta, ni la atmósfera, ni
  // la nebulosa, ni el fantasma, así que la GPU tiene de sobra. El tope de
  // `ESTRELLAS_TOPE` sigue mandando arriba de todo.
  const estrellas = crearEstrellas(
    (ESTRELLAS_POR_RANGO[op.rango] ?? 150) * (op.soloEstrellas ? 1.8 : 1),
    op.rango,
    op.planeta,
    (cajaInicial.w || 390) / (cajaInicial.h || 844)
  );
  materiales.push(estrellas.material as THREE.ShaderMaterial);
  escena.add(estrellas);
  const fugaz = crearFugaz(op.rango, op.planeta);
  escena.add(fugaz.mesh);

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
  if (op.soloEstrellas) {
    // Sin cuerpo no hay presagio ni fantasma: las dos son marcas SOBRE el
    // cuerpo, y solas se leerían como una mancha en el cielo.
  } else if (op.presagio) {
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

  if (op.soloEstrellas) {
    // NADA EN EL GRUPO. No es que se esconda: no se construye, así que no
    // se compilan sus shaders ni se dibuja cada cuadro.
  } else if (op.vacio || op.rango === 1) {
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
    aurora.scale.setScalar(1.05);
    aurora.position.z = -0.05;
    amat.blending = THREE.AdditiveBlending;
    grupo.add(aurora);
    auroraMesh = aurora;

    galaxia = crearGalaxia(op.rango);
    materiales.push(galaxia.material as THREE.ShaderMaterial);
    grupo.add(galaxia);
    grupo.scale.setScalar(1.5);
  } else if (cfg) {
    // LOS CUERPOS CONVIVEN CON EL CIELO, NO LO REEMPLAZAN.
    //
    // Eran 1,45 de rango 5 para arriba y 1,25 abajo: a ese tamaño el planeta y
    // el sol ocupaban la mitad inferior de la pantalla y se cortaban contra los
    // dos bordes. El efecto secundario es el que se reportó —"en Marte veo
    // menos estrellas que en polvo"—: las estrellas están, hay más que en polvo
    // (560 contra 400), pero el cuerpo las tapa. En polvo no hay ningún objeto
    // grande, así que la pantalla entera es cielo.
    //
    // Y hay un segundo efecto peor: un cuerpo enorme cortado por el borde de
    // abajo cae justo donde viven los botones anclados.
    //
    // Se achican los dos escalones manteniendo la diferencia entre ellos: un
    // rango alto sigue teniendo un cuerpo más grande, pero le deja cielo
    // alrededor. El presupuesto de relleno también baja, que no estorba.
    const escala = op.rango >= 5 ? 1.0 : 0.88;
    const caja = l.tamano();
    const pixel = 2 / (escala * Math.min(caja.w || 400, caja.h || 700));
    const noche = nivelDeNoche(!!op.reposo, op.noche);
    const mat = crearMaterialCuerpo(cfg, !!op.apagado, pixel, !!op.reposo, 1, op.estilo, noche);
    materiales.push(mat);
    const cuerpo = new THREE.Mesh(QUAD, mat);
    cuerpo.scale.setScalar(escala);
    grupo.add(cuerpo);

    for (let i = 0; i < cfg.lunas; i++) {
      const lmat = crearMaterialCuerpo(LUNA_CFG, !!op.apagado, 0.02, !!op.reposo, 1, op.estilo, noche);
      materiales.push(lmat);
      const luna = new THREE.Mesh(QUAD, lmat);
      const tamLuna = escala * (0.16 + i * 0.05);
      luna.scale.setScalar(tamLuna);
      grupo.add(luna);
      orbitantes.push({
        obj: luna,
        // POR FUERA DEL PLANETA (19/9). Era 0.78 con el planeta de radio 1: la
        // luna giraba ADENTRO del disco y por eso siempre se la veía encima.
        // Ahora el radio pasa el borde del planeta más el de la luna, así que
        // cruza de adelante a atrás en los costados, fuera del disco, y el
        // cambio no se ve.
        r: escala * (1.3 + i * 0.28),
        s: tamLuna,
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
        // LOS PLANETAS DEL SISTEMA SE HABÍAN QUEDADO AFUERA DE LA CARA
        // NOCTURNA, y por eso el rango 6 "parecía un juego viejo": el cuerpo
        // grande y las lunas recibían `estilo` y `noche`, y estos siete se
        // creaban con cuatro argumentos, así que salían iluminados de día,
        // con la textura y las bandas a full. Saturno con diez bandas al 0,5
        // de contraste, del tamaño de una moneda, es la cebra que se reportó.
        //
        // Con `noche` puestos son lo que pide el norte del motor: cuerpos
        // oscuros con el filo encendido. A este tamaño además es lo único que
        // se puede leer — la textura de un planeta de 40 píxeles no se ve, se
        // ensucia.
        const pmat = crearMaterialCuerpo(pcfg, !!op.apagado, 0.008, !!op.reposo, 1, op.estilo, noche);
        materiales.push(pmat);
        const planeta = new THREE.Mesh(QUAD, pmat);
        planeta.scale.setScalar(escala * (0.045 + i * 0.011));
        grupo.add(planeta);
        orbitantes.push({
          obj: planeta,
          s: escala * (0.045 + i * 0.011),
          r: escala * (0.26 + i * 0.155),
          v: 0.30 / (1 + i * 0.55),
          f: i * 1.35,
          ry: 0.34,
        });
      }
    }
  }
  // LA LENTE, si el cuerpo es el agujero negro.
  //
  // El 0.46 es el radio del horizonte DENTRO del quad, y tiene que seguir al
  // `const float R` del fragmento del cuerpo: el quad mide 2 de lado y `vP` va
  // de -1 a 1, así que en mundo mide lo mismo multiplicado por la escala. Si
  // alguna vez se toca allá, se toca acá.
  const lenteR = op.rango === 8 && !op.soloEstrellas ? 0.46 : 0;
  const uEstrellas = (estrellas.material as THREE.ShaderMaterial).uniforms;
  uEstrellas.uLenteR.value = lenteR;

  marca('ascent:particulas-fin');
  medir('ascent:escena-armado', 'ascent:particulas-inicio', 'ascent:particulas-fin');

  let esquinaAhora: Esquina = op.esquina ?? 'abajo-derecha';
  /** El viaje en curso: de dónde, hacia dónde, y cuándo empezó. */
  let viaje: { x0: number; y0: number; x1: number; y1: number; t0: number } | null = null;

  let vivo = true;
  let pausado = false;
  // Aparte de `pausado`, que lo maneja la visibilidad de la app: este lo
  // maneja quien montó la escena (`pausar`). Con uno solo, volver a la app
  // reanudaría una escena que la pantalla había guardado a propósito.
  let pausadoPorFuera = false;
  // Cuándo fue la última señal de que hay alguien del otro lado, y cuándo se
  // dibujó el último cuadro DE VERDAD. Con esos dos números `debeDibujar`
  // decide el escalón; ver `nucleo/quietud.ts`.
  let ultimoToque = performance.now();
  let ultimoCuadro = 0;
  // ¿Está el fondo detrás del desenfoque? Ver `tapar` en el tipo de arriba.
  let tapado = false;
  const despertar = () => {
    ultimoToque = performance.now();
  };
  const reloj = new THREE.Clock();
  let tiempo = Math.random() * 100;

  // LA ÓRBITA TIENE PROFUNDIDAD (19/9). Antes era un óvalo plano con la luna
  // siempre en z = 0.01, o sea siempre adelante del planeta: "no orbita, pasa
  // por delante". La órbita se ve inclinada desde arriba, así que la mitad de
  // ARRIBA del óvalo es la que queda del otro lado: ahí va detrás del planeta.
  // Lo transparente se dibuja de atrás para adelante según z (así ordena
  // three.js), y el disco del planeta la tapa sola. Un poco más chica atrás y
  // más grande adelante: es lo que hace que se lea como una vuelta.
  function ubicarOrbitantes() {
    for (const o of orbitantes) {
      const a = tiempo * o.v + o.f;
      const lejos = Math.sin(a); // 1 = lo más atrás, -1 = lo más adelante
      o.obj.position.set(Math.cos(a) * o.r, lejos * o.r * o.ry, -lejos * 0.05);
      o.obj.scale.setScalar(o.s * (1 - 0.08 * lejos));
    }
  }

  function medirLienzo() {
    const { w, h } = l.tamano();
    rend.setSize(w, h, false);
    rend.setPixelRatio(l.densidad());
    const asp = w / h;
    camara.left = -asp;
    camara.right = asp;
    camara.updateProjectionMatrix();
    ubicarGrupo();
  }

  /**
   * Dónde va el cuerpo según la esquina. El ancho entra en la cuenta porque la
   * cámara es ortográfica y el borde derecho está en `asp`.
   */
  function destinoDe(e: Esquina, asp: number) {
    if (e === 'abajo-derecha') return { x: asp * 0.8, y: -0.72 };
    if (e === 'arriba-derecha') return { x: asp * 0.82, y: 0.72 };
    return { x: 0, y: 0 };
  }

  /** Pone el cuerpo donde va AHORA, sin viaje: al armar y al cambiar de tamaño. */
  function ubicarGrupo() {
    const { w, h } = l.tamano();
    const d = destinoDe(esquinaAhora, w / h);
    // Si está viajando, el viaje manda: mover el lienzo en medio de la
    // transición no puede teletransportarlo.
    if (viaje) return;
    grupo.position.set(d.x, d.y, 0);
  }
  medirLienzo();

  for (const m of materiales) m.uniforms.uTime.value = tiempo;
  // También acá, y no solo en el bucle: el primer cuadro se dibuja desde
  // `compileAsync` y el bucle puede no haber corrido todavía.
  if (lenteR > 0) (uEstrellas.uLenteC.value as THREE.Vector2).set(grupo.position.x, grupo.position.y);
  ubicarOrbitantes();

  function frame() {
    if (!vivo) return;
    // El pedido del próximo cuadro va PRIMERO. Estando abajo, cualquier
    // salida temprana de las de abajo cortaba el bucle para siempre y el
    // fondo no volvía ni tocando la pantalla.
    if (op.animar !== false) l.cuadro(frame);
    if (pausado || pausadoPorFuera) return;

    // EL BUCLE SIGUE VIVO EN EL ESCALÓN 'QUIETO', sin dibujar. Cancelar el
    // rAF y rearmarlo al despertar ahorraría una llamada a función por
    // cuadro —nada, al lado de un dibujo de WebGL— y a cambio abriría la
    // puerta a que un despertar se pierda y el fondo quede muerto. No vale.
    const ahora = performance.now();
    // Lunas, los planetas del Sistema o una fugaz cruzando: se mueven rápido,
    // y el escalón lento a doce cuadros los mostraba a saltos (ver quietud).
    // EL VIAJE CUENTA COMO MOVIMIENTO: sin esto, el escalón lento de
    // `debeDibujar` deja la transición en tres cuadros y se ve peor que el
    // salto que vino a arreglar.
    if (viaje) {
      const t = Math.min(1, (ahora - viaje.t0) / VIAJE_DE_ESQUINA_MS);
      // La misma curva que el resto de la app: sale y se asienta.
      const suave = 1 - Math.pow(1 - t, 3);
      grupo.position.x = viaje.x0 + (viaje.x1 - viaje.x0) * suave;
      grupo.position.y = viaje.y0 + (viaje.y1 - viaje.y0) * suave;
      if (t >= 1) viaje = null;
    }
    const hayMovimiento = orbitantes.length > 0 || fugaz.mesh.visible || viaje !== null;
    // TAPADO = COMO SI HICIERA RATO QUE NADIE TOCA. No es un tercer camino: es
    // el escalón lento que ya existe, pedido por otra razón. Así hay una sola
    // regla de cuántos cuadros se dibujan y vive en `nucleo/quietud.ts`.
    const sinTocar = tapado ? ESPERA_LENTO_MS : ahora - ultimoToque;
    if (!debeDibujar(sinTocar, ahora - ultimoCuadro, hayMovimiento)) return;
    ultimoCuadro = ahora;

    // `getDelta` se llama SOLO cuando se dibuja, así que trae el tiempo real
    // desde el cuadro anterior. Por eso bajar de escalón no enlentece el
    // movimiento: se dibuja menos seguido, pero cada dibujo avanza lo que
    // corresponde.
    tiempo += reloj.getDelta();
    for (const m of materiales) m.uniforms.uTime.value = tiempo;
    // El centro de la lente viaja con el cuerpo: si se queda fijo, al cambiar
    // de esquina las estrellas se curvan alrededor de un agujero que ya no
    // está ahí.
    if (lenteR > 0) (uEstrellas.uLenteC.value as THREE.Vector2).set(grupo.position.x, grupo.position.y);
    ubicarOrbitantes();
    fugaz.actualizar(tiempo, camara.right);
    if (galaxia) galaxia.rotation.z = tiempo * 0.022;
    if (auroraMesh) auroraMesh.rotation.z = tiempo * 0.022;
    if (polvo) polvo.rotation.z = tiempo * 0.03;
    rend.render(escena, camara);
    l.presentar();
  }

  // EL PRIMER CUADRO ESPERA A QUE LOS SHADERS ESTÉN COMPILADOS, sin bloquear.
  //
  // Antes se dibujaba ya mismo, y la primera vez eso compila: el hilo queda
  // tomado hasta que el compilador termina. En Chrome de Windows (Direct3D)
  // eran 134-140 s con la página congelada (18/9), y la caché del navegador
  // se invalida con cada versión: le pasaba a cada persona en cada deploy.
  // `compileAsync` pregunta si terminó sin esperar (KHR_parallel_shader_compile)
  // y mientras tanto se ve el fondo de CSS, que es para lo que está.
  //
  // Sin esa extensión —expo-gl no la tiene— resuelve a los 10 ms y el primer
  // cuadro compila como antes. En el iPhone eso se midió bien.
  //
  // De la segunda pantalla en adelante el programa ya está en caché del
  // renderer compartido y esto resuelve casi en el acto.
  // El timer de respaldo del primer cuadro (ver abajo). Vive acá arriba para
  // que `soltar()` lo pueda cancelar si la escena se suelta antes de dibujar.
  let respaldoPrimerCuadro: ReturnType<typeof setTimeout> | undefined;
  marca('ascent:shader-inicio');
  // EL PRIMER CUADRO SE DIBUJA UNA SOLA VEZ, PASE LO QUE PASE CON `compileAsync`.
  //
  // `compileAsync` de three sondea `program.isReady()` dentro de un `setTimeout`
  // (no hay KHR_parallel_shader_compile en expo-gl, así que el sondeo cae a los
  // 10 ms). Si en esa ventana un material perdió su programa —`soltar()` de
  // acá abajo hace `material.dispose()`, que borra `currentProgram`; también un
  // hueco `undefined` en un array de materiales— ese `program` queda `undefined`
  // y `program.isReady()` TIRA. Y como tira DENTRO de un setTimeout, NO es un
  // rechazo de la promesa: ningún `.catch` lo agarra, la promesa queda colgada
  // para siempre, el `.then` no corre y el primer cuadro no se dibuja. En un
  // teléfono lento y frío eso es el fondo en negro —y `listo` sin resolver deja
  // el fundido de entrada de la web colgado. La three nativa NO tiene guarda:
  // depende de que ningún material del arreglo esté sin programa cuando dispara
  // el timer. La guarda la ponemos nosotros.
  //
  // `arrancar()` dibuja el primer cuadro y resuelve `listo` UNA vez
  // (idempotente), y lo llaman tres caminos: el `.then` normal, un plazo de
  // respaldo por si el sondeo se colgó, y el `catch` del tiro sincrónico de
  // `compile()`. Barato: un timer que casi siempre se cancela solo, contra un
  // fondo en negro para siempre.
  let arrancado = false;
  let resolverListo!: () => void;
  const listo = new Promise<void>((r) => {
    resolverListo = r;
  });
  function arrancar() {
    if (arrancado || !vivo) return;
    arrancado = true;
    try {
      rend.render(escena, camara);
      l.presentar();
      marca('ascent:shader-fin');
      medir('ascent:shader-compilacion', 'ascent:shader-inicio', 'ascent:shader-fin');
      if (op.animar !== false) l.cuadro(frame);
    } finally {
      // Se resuelve SIEMPRE, aun si el render tira: la web espera este `listo`
      // para el fundido de entrada y colgarlo es peor que un cuadro feo.
      resolverListo();
    }
  }
  // El respaldo: si a los 400 ms `compileAsync` no arrancó (sondeo colgado por
  // el tiro de arriba, o la compilación muy lenta), se dibuja igual. Compilar en
  // el hilo es un tirón de una vez; el negro es para siempre. Se cancela solo en
  // cuanto arranca por el camino normal, y también en `soltar()`.
  respaldoPrimerCuadro = setTimeout(arrancar, 400);
  try {
    rend
      .compileAsync(escena, camara)
      .then(() => {
        clearTimeout(respaldoPrimerCuadro);
        arrancar();
      })
      .catch(() => {
        // Un rechazo "normal" de la promesa (no el tiro del setTimeout, que
        // esto no ve) igual no puede dejar el fondo en negro.
        clearTimeout(respaldoPrimerCuadro);
        arrancar();
      });
  } catch {
    // `compile()` corre sincrónico DENTRO de `compileAsync`, antes de devolver
    // la promesa: si un material es `undefined`, tira acá, no en el setTimeout.
    clearTimeout(respaldoPrimerCuadro);
    arrancar();
  }

  // El motor no anima con la app atrás: son sesenta cuadros por segundo de
  // GPU para algo que nadie está mirando.
  const dejarDeMirar = plataforma.ciclo.alCambiar((visible) => {
    pausado = !visible;
    // Se descarta el delta acumulado: si no, al volver el primer cuadro
    // adelanta de golpe todo el tiempo que estuvo pausado.
    if (visible) {
      reloj.getDelta();
      // Volver a la app es la señal más clara que hay de que alguien está
      // mirando: se arranca de nuevo en el escalón de arriba.
      despertar();
    }
  });

  // LO QUE DESPIERTA AL MOTOR: cuáles son las señales lo decide el lienzo.
  const dejarDeEscuchar = l.alDespertar(despertar);
  // Al cambiar de tamaño también se despierta: `medirLienzo` reconfigura el
  // lienzo pero no lo pinta, y quieto quedaría estirado hasta el próximo toque.
  const dejarDeMedir = l.alCambiarDeTamano(() => {
    medirLienzo();
    despertar();
  });

  /**
   * EL IMPACTO. Sube `uAtenua` y lo deja volver.
   *
   * La FORMA de la curva vive en `nucleo/pulso.ts` y está probada con números:
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
    // EL PULSO TIENE QUE DESPERTAR AL MOTOR. Esta función mueve uniforms pero
    // NO dibuja: el dibujo lo hace el bucle. Con el bucle en 'quieto' —una
    // subida de rango que llega con el teléfono apoyado— el brillo cambiaba y
    // no se veía nada.
    despertar();
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
        l.cuadro(paso);
      } else {
        // Se vuelve al valor EXACTO de reposo y no a `base * 1`: si no, cada
        // pulso deja su pizca de error de coma flotante.
        for (const m of materiales) {
          if (m.uniforms.uAtenua) m.uniforms.uAtenua.value = baseDe(m);
        }
        pulsando = 0;
      }
    };
    l.cuadro(paso);
  }

  /**
   * EL CUERPO VIAJA A OTRA ESQUINA en vez de saltar (23/9). Entre Inicio
   * (abajo) y Ranking (arriba) el salto es de media pantalla y se ve como un
   * corte. No sigue al dedo a propósito: el gesto mueve las pantallas, y el
   * fondo es de todas.
   */
  const mover = (e: Esquina) => {
    if (e === esquinaAhora) return;
    esquinaAhora = e;
    const { w, h } = l.tamano();
    const d = destinoDe(e, w / h);
    viaje = { x0: grupo.position.x, y0: grupo.position.y, x1: d.x, y1: d.y, t0: performance.now() };
    // Despertar: en el escalón quieto, el viaje no se dibujaría hasta que
    // alguien tocara la pantalla.
    despertar();
  };

  const soltar = () => {
    vivo = false;
    // Antes de disponer los materiales: si el respaldo del primer cuadro sigue
    // pendiente, se cancela. `arrancar()` ya se protege con `!vivo`, pero no
    // dejar timers vivos apuntando a una escena muerta es más limpio.
    if (respaldoPrimerCuadro) clearTimeout(respaldoPrimerCuadro);
    dejarDeMirar();
    dejarDeMedir();
    dejarDeEscuchar();
    // se sueltan las geometrías y materiales de ESTA escena, pero el
    // renderer y el canvas siguen vivos para la próxima pantalla
    escena.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && m.geometry !== QUAD) m.geometry.dispose();
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
    });
  };

  const pausar = (si: boolean) => {
    if (pausadoPorFuera === si) return;
    pausadoPorFuera = si;
    if (!si) {
      // Igual que al volver a la app: se descarta el tiempo que estuvo
      // guardada —si no, el primer cuadro adelanta todo de golpe— y se
      // arranca en el escalón de arriba, porque alguien acaba de llegar.
      reloj.getDelta();
      despertar();
    }
  };

  const tapar = (si: boolean) => {
    if (tapado === si) return;
    tapado = si;
    // Al destaparse se despierta: si no, volver a Inicio dejaría el cuerpo a
    // doce cuadros hasta que alguien tocara la pantalla.
    if (!si) despertar();
  };

  return { soltar, pulso, pausar, mover, tapar, listo };
}
