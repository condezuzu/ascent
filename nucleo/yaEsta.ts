import { NOMBRES_EN } from './ejerciciosEn.ts';

/**
 * ¿YA ESTÁ? (15/10). Antes de crear un ejercicio propio se busca uno que
 * signifique lo mismo aunque se llame distinto: "press plano" es Press de banca,
 * "bench press" también, "sentadillas" es Sentadilla y "prees de banca" se
 * entiende. Se compara contra el nombre de cada uno y contra el inglés del
 * catálogo, que ya trae medio diccionario gratis.
 *
 * Dos nombres son el mismo si, después de normalizarlos, tienen las mismas
 * palabras (en cualquier orden, con una letra de diferencia en las largas). No
 * alcanza con que una contenga a la otra: "press" no es "press de banca".
 */

// Lo que no cambia de qué ejercicio se habla.
const VACIAS = new Set(['de', 'del', 'con', 'en', 'la', 'el', 'los', 'las', 'a', 'al', 'y', 'un', 'una', 'the', 'with', 'on', 'of', 'for', 'to']);
// El aparato que se da por sentado: "curl" es el de barra, "fondos" los de paralelas.
const POR_DEFECTO = new Set(['barra', 'paralela', 'pie']);

// Frases antes que palabras: "peso muerto" es una sola cosa.
const FRASES: [RegExp, string][] = [
  [/\bpeso muerto\b|\bdead ?lift\b/g, 'pesomuerto'],
  [/\bpull ?-?ups?\b/g, 'dominada'],
  [/\bchin ?-?ups?\b/g, 'dominada supina'],
  [/\bpush ?-?ups?\b/g, 'flexion'],
  [/\bhip ?thrusts?\b|\bempuje de cadera\b/g, 'hipthrust'],
  [/\bpolea al pecho\b|\blat pulldown\b|\bpulldown\b/g, 'jalon pecho'],
  [/\bleg press\b/g, 'prensa'],
  [/\bpress de piernas?\b/g, 'prensa'],
  [/\bpress plano\b|\bpress de banco plano\b/g, 'press banca'],
  [/\bvuelos? laterales?\b/g, 'elevacion lateral'],
];

const SINONIMOS: Record<string, string> = {
  bench: 'banca',
  squat: 'sentadilla',
  estocada: 'zancada',
  desplante: 'zancada',
  lunge: 'zancada',
  caminadora: 'cinta',
  treadmill: 'cinta',
  bici: 'bicicleta',
  bike: 'bicicleta',
  lagartija: 'flexion',
  pantorrilla: 'gemelo',
  calf: 'gemelo',
  dip: 'fondo',
  row: 'remo',
  dumbbell: 'mancuerna',
  barbell: 'barra',
  cable: 'polea',
  machine: 'maquina',
  plank: 'plancha',
  abs: 'abdominal',
  shrug: 'encogimiento',
};

/** Una palabra sin acento, en singular y en su forma de diccionario. */
function palabra(p: string): string {
  let w = p;
  if (w.length > 5 && w.endsWith('iones')) w = w.slice(0, -2);
  else if (w.length > 4 && /(les|res|nes|des)$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s')) w = w.slice(0, -1);
  return SINONIMOS[w] ?? w;
}

/** Las palabras que dicen QUÉ ejercicio es, sin repetir. */
export function palabrasDe(nombre: string): string[] {
  let t = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [re, a] of FRASES) t = t.replace(re, a);
  const ps = t
    .split(/[\s-]+/)
    .filter((p) => p && !VACIAS.has(p))
    .map(palabra)
    .flatMap((p) => p.split(' '))
    .filter((p) => !POR_DEFECTO.has(p));
  return [...new Set(ps)];
}

/** Iguales, o con una letra de diferencia si las dos son largas ("prees" y "press" no: son cortas). */
function casiIguales(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  // Distancia de edición, cortando apenas pasa de uno.
  let i = 0;
  let j = 0;
  let cambios = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++cambios > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return cambios + (a.length - i) + (b.length - j) <= 1;
}

function mismasPalabras(a: string[], b: string[]): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  return a.every((x) => b.some((y) => casiIguales(x, y))) && b.every((y) => a.some((x) => casiIguales(x, y)));
}

/** El que ya existe y significa lo mismo, o `null`. */
export function yaEsta<E extends { id: string; nombre: string }>(nombre: string, ejercicios: E[]): E | null {
  const buscadas = palabrasDe(nombre);
  if (buscadas.length === 0) return null;
  for (const e of ejercicios) {
    const nombres = [e.nombre, NOMBRES_EN[e.id]].filter((n): n is string => !!n);
    if (nombres.some((n) => mismasPalabras(buscadas, palabrasDe(n)))) return e;
  }
  return null;
}
