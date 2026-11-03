import * as THREE from 'three';
import { paletaDe } from '@nucleo/paletas';
import { FRAGMENT_BANDA, VERTEX_BANDA } from './shaders';

/**
 * UN CIELO DE VERDAD (2/11, la propuesta de la sección 14 de la galería, solo en la nativa). Miles de
 * estrellas muy tenues y unas pocas brillantes, que es la ley de magnitudes y lo que da profundidad, en
 * tres capas que se mueven distinto, más una banda de polvo en diagonal, muy por debajo del piso de
 * lectura.
 *
 * SIN TEXTURAS NI RENDER TARGETS, porque `expo-gl` no tiene `texStorage2D` y three lo pide para las dos
 * cosas. La banda es una malla con el color en cada vértice: es ruido de baja frecuencia, se interpola
 * bien, y dibujarla no cuesta nada por píxel.
 */

const ruidoDe = (semilla: number) => {
  const h = (x: number, y: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + semilla) * 43758.5453;
    return s - Math.floor(s);
  };
  const v = (x: number, y: number) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const f = x - i;
    const g = y - j;
    const a = f * f * (3 - 2 * f);
    const b = g * g * (3 - 2 * g);
    return (h(i, j) * (1 - a) + h(i + 1, j) * a) * (1 - b) + (h(i, j + 1) * (1 - a) + h(i + 1, j + 1) * a) * b;
  };
  return (x: number, y: number, octavas: number) => {
    let t = 0;
    let m = 0.5;
    let s = 1;
    for (let k = 0; k < octavas; k++) {
      t += v(x * s, y * s) * m;
      m *= 0.5;
      s *= 2.03;
    }
    return t;
  };
};

/** Siempre el mismo cielo para el mismo rango: volver a una pantalla no cambia las estrellas de lugar. */
const azarDe = (semilla: number) => {
  let x = semilla * 9301 + 49297;
  return () => (x = (x * 9301 + 49297) % 233280) / 233280;
};

// Las temperaturas de las estrellas de verdad: azules, blancas, y pocas anaranjadas.
const TEMPERATURAS: [string, number][] = [['#a9bfff', 0.1], ['#cad7ff', 0.2], ['#f4f6ff', 0.34], ['#fff6ec', 0.2], ['#ffdcb8', 0.12], ['#ffc08c', 0.04]];
const temperaturaDe = (u: number) => {
  let a = 0;
  for (const [c, p] of TEMPERATURAS) {
    a += p;
    if (u <= a) return c;
  }
  return TEMPERATURAS[2][0];
};

const luminancia = (c: THREE.Color) => {
  // `THREE.Color` ya trabaja en lineal: es la cuenta de WCAG sin el paso de sRGB.
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};

export type MaterialDePuntos = (opciones: { titila: boolean; nitida: boolean }) => THREE.ShaderMaterial;

// La banda y las capas: de atrás para adelante. Cuánto se corre cada una al cambiar de pestaña.
const DE_CUANTO = [0.28, 0.58, 1];
// Cuánto se corre lo de adelante por cada pestaña: 16 puntos en una pantalla de 844.
const PARALAJE_POR_PESTANA = 16 / 422;
// Más grande que lo que se ve, para que correrse no descubra el borde.
const MARGEN_X = 1.16;
const MARGEN_Y = 1.08;
const COLUMNAS = 48;
const FILAS = 104;

export function crearFirmamento({ rango, planeta, asp, factor, materialDePuntos }: { rango: number; planeta?: string | null; asp: number; factor: number; materialDePuntos: MaterialDePuntos }) {
  const pal = paletaDe(rango, planeta);
  const azar = azarDe(11 + rango);
  const ruido = ruidoDe(3.7 + rango);
  const densidadDe = 0.75 + rango * 0.09;
  const anchoMundo = asp * MARGEN_X;

  // La banda, en diagonal: de `u, v` entre 0 y 1 a cuánto polvo hay ahí.
  const seno = Math.sin(-0.62);
  const coseno = Math.cos(-0.62);
  const densidad = (u: number, v: number) => {
    const nx = u - 0.5;
    const ny = (v - 0.5) * 2;
    const d = nx * seno + ny * coseno + (ruido(nx * 1.6 + 4, ny * 1.6, 3) - 0.5) * 0.5;
    return Math.exp(-(d * d) / 0.11);
  };

  const colorBajo = new THREE.Color(pal.apagado);
  const colorAlto = new THREE.Color(pal.principal);
  // Una paleta clara no puede subir más que una oscura: es lo que sostiene el piso en el Sol.
  const tope = Math.min(1, 0.1 / (0.46 * Math.max(0.001, luminancia(colorAlto))));
  const cantidad = (COLUMNAS + 1) * (FILAS + 1);
  const pos = new Float32Array(cantidad * 3);
  const col = new Float32Array(cantidad * 4);
  const mezcla = new THREE.Color();
  for (let f = 0; f <= FILAS; f++) {
    for (let c = 0; c <= COLUMNAS; c++) {
      const u = c / COLUMNAS;
      const v = f / FILAS;
      const i = f * (COLUMNAS + 1) + c;
      pos[i * 3] = (u * 2 - 1) * anchoMundo;
      pos[i * 3 + 1] = (1 - v * 2) * MARGEN_Y;
      pos[i * 3 + 2] = 0;
      const d = densidad(u, v);
      const nx = u * 2.3;
      const ny = v * 4.6;
      const n = ruido(nx + 1.3, ny, 4);
      const polvo = ruido(nx * 2.4 + 9, ny * 2.4, 3);
      const k = Math.max(0, d * (0.3 + n * 0.95) - d * Math.pow(polvo, 2.4) * 0.8);
      mezcla.copy(colorBajo).lerp(colorAlto, Math.min(1, n * 1.1));
      col[i * 4] = mezcla.r;
      col[i * 4 + 1] = mezcla.g;
      col[i * 4 + 2] = mezcla.b;
      col[i * 4 + 3] = Math.min(1, (k * 118 * tope) / 255);
    }
  }
  const indices = new Uint16Array(COLUMNAS * FILAS * 6);
  let n = 0;
  for (let f = 0; f < FILAS; f++) {
    for (let c = 0; c < COLUMNAS; c++) {
      const a = f * (COLUMNAS + 1) + c;
      const b = a + COLUMNAS + 1;
      indices.set([a, b, a + 1, a + 1, b, b + 1], n);
      n += 6;
    }
  }
  const geoBanda = new THREE.BufferGeometry();
  geoBanda.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geoBanda.setAttribute('colorA', new THREE.BufferAttribute(col, 4));
  geoBanda.setIndex(new THREE.BufferAttribute(indices, 1));
  const banda = new THREE.Mesh(
    geoBanda,
    new THREE.ShaderMaterial({ vertexShader: VERTEX_BANDA, fragmentShader: FRAGMENT_BANDA, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  );
  banda.position.z = -3.4;
  banda.frustumCulled = false;

  const capa = (total: number, enBanda: number, tamMin: number, tamMax: number, aMin: number, aMax: number, curva: number, z: number, nitida: boolean, titila: boolean) => {
    const posiciones: number[] = [];
    const colores: number[] = [];
    const tamanos: number[] = [];
    const brillos: number[] = [];
    const color = new THREE.Color();
    let hechas = 0;
    let vueltas = 0;
    const meta = Math.round(total * densidadDe * factor);
    while (hechas < meta && vueltas++ < meta * 8) {
      const u = azar();
      const v = azar();
      if (azar() > 0.28 + densidad(u, v) * enBanda) continue;
      const m = Math.pow(azar(), curva);
      posiciones.push((u * 2 - 1) * anchoMundo, (1 - v * 2) * MARGEN_Y, z);
      color.set(temperaturaDe(azar()));
      colores.push(color.r, color.g, color.b);
      tamanos.push(tamMin + m * (tamMax - tamMin));
      brillos.push(aMin + m * (aMax - aMin));
      hechas++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(posiciones), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colores), 3));
    geo.setAttribute('tamano', new THREE.BufferAttribute(new Float32Array(tamanos), 1));
    geo.setAttribute('brillo', new THREE.BufferAttribute(new Float32Array(brillos), 1));
    const puntos = new THREE.Points(geo, materialDePuntos({ titila, nitida }));
    puntos.frustumCulled = false;
    return puntos;
  };

  // Tamaños en puntos de pantalla: el diámetro con el que se pinta cada estrella.
  const lejos = capa(3000, 1.3, 1.6, 2.4, 0.07, 0.5, 3, -3.2, true, false);
  const medio = capa(300, 0.9, 2, 3.2, 0.28, 0.9, 2.6, -3, true, true);
  // Las de adelante llevan halo: el material suave reparte el brillo en un núcleo y una caída.
  const cerca = capa(22, 0.3, 7, 11, 0.7, 1, 1.4, -2.8, false, true);
  const capas = [lejos, medio, cerca];

  return {
    objetos: [banda, ...capas],
    materiales: capas.map((c) => c.material as THREE.ShaderMaterial),
    correr(pestanas: number) {
      const x = -pestanas * PARALAJE_POR_PESTANA;
      banda.position.x = x * DE_CUANTO[0];
      capas.forEach((c, i) => {
        c.position.x = x * DE_CUANTO[i];
      });
    },
  };
}
