/**
 * "LA PRÓXIMA, MÁS" (10/10/2026).
 *
 * La app no anota repeticiones —una serie es un toque—, así que no puede saber
 * sola si un peso ya quedó chico. Lo que sí sabe es CUÁNDO PREGUNTARLO: llegaste
 * a la meta y todas las series fueron con el mismo peso. Ahí ofrece el toque; si
 * lo das, la vez siguiente propone ese peso con un disco más.
 *
 * La marca dice lo que se HIZO (peso, modo, series, día), no lo que hay que
 * hacer: el disco lo suma quien la lee, en la unidad de la persona. Vive en la
 * base (migración 65) y en la copia del teléfono, para el subsuelo sin señal.
 *
 * NO IMPORTA NADA del teléfono: se prueba con node pelado.
 */

import { cargaValida, llevaNumero, type Carga } from './carga.ts';
import { pesoValido, type EstadoBloques } from './bloques.ts';
import { pasoDelCampo } from './campoPeso.ts';
import type { Unidad } from './peso.ts';

export type Subida = { carga: Carga; peso: number; series: number; dia: string };
/** ejercicio → su marca. */
export type Subidas = Record<string, Subida>;

/**
 * QUÉ SE PUEDE MARCAR AHORA en el bloque en curso; `null` si no corresponde
 * ofrecerlo. Meta cumplida y TODAS las series con el mismo peso: con una sola
 * distinta —o una sin anotar— ya no se sabe cuál es "el peso" que quedó chico.
 */
export function loQueSePuedeSubir(e: EstadoBloques, modo: Carga | null): { peso: number; series: number } | null {
  if (!e.ejercicio || !modo || !llevaNumero(modo)) return null;
  if (e.hechas < 1 || e.hechas < e.meta) return null;
  const pesos = (e.pesos ?? []).slice(0, e.hechas).map(pesoValido);
  if (pesos.length < e.hechas) return null;
  const primero = pesos[0];
  if (primero === null || !pesos.every((p) => p === primero)) return null;
  return { peso: primero, series: e.hechas };
}

/**
 * EL PESO QUE SE PROPONE con una marca puesta: el marcado más un disco. `null`
 * si la marca no aplica, y ahí se propone lo de siempre.
 *
 * - del mismo modo: 30 por mancuerna no dice nada de la barra;
 * - de un día ANTERIOR: la de hoy es para la próxima vez, no para el bloque que
 *   se abre de nuevo dentro de la misma sesión;
 * - y el último peso recordado tiene que seguir siendo el marcado: si después
 *   se hizo otra cosa, la marca quedó vieja aunque la copia todavía la tenga.
 */
export function pesoConSubida(
  s: Subida | undefined,
  modo: Carga,
  recordado: number | null,
  hoy: string,
  unidad: Unidad,
  /**
   * Hoy ya se hizo ese ejercicio con peso: LA MARCA YA SE USÓ (12/10). Sin
   * esto, quien no se animaba al disco de más y hacía el primer bloque con el
   * peso de siempre recibía el disco de más OTRA VEZ en cada bloque nuevo de
   * la misma sesión — y si no miraba, el `+` anotaba series con un peso que no
   * hizo. Un dato falso, sin aviso.
   */
  yaSeHizoHoy = false
): number | null {
  if (yaSeHizoHoy) return null;
  if (!s || s.carga !== modo || !(s.dia < hoy) || recordado !== s.peso) return null;
  return pasoDelCampo(s.peso, unidad, 1) ?? null;
}

/** Si en la sesión de hoy ya hay un bloque CERRADO de ese ejercicio con algún peso anotado. */
export function seHizoHoy(e: EstadoBloques, ejercicio: string): boolean {
  return e.cerrados.some((b) => b.ejercicio === ejercicio && (b.pesos ?? []).some((p) => pesoValido(p) !== null));
}

/**
 * AL TERMINAR UNA SESIÓN: las marcas de días anteriores de los ejercicios que
 * se hicieron hoy con peso ya se usaron. Es la misma regla con la que la base
 * decide cuáles siguen valiendo (`mis_subidas`).
 */
export function subidasTrasLaSesion(subidas: Subidas, bloques: unknown, hoy: string): Subidas {
  if (!Array.isArray(bloques)) return subidas;
  const hechos = new Set<string>();
  for (const b of bloques) {
    const x = b as { ejercicio?: unknown; pesos?: unknown } | null;
    if (x && typeof x.ejercicio === 'string' && Array.isArray(x.pesos) && x.pesos.length > 0) hechos.add(x.ejercicio);
  }
  return Object.fromEntries(Object.entries(subidas).filter(([ejercicio, s]) => !(hechos.has(ejercicio) && s.dia < hoy)));
}

/** Una marca con cualquier forma (de la base o del teléfono), o `null`. */
export function subidaValida(crudo: unknown): Subida | null {
  const x = crudo as { carga?: unknown; peso?: unknown; series?: unknown; dia?: unknown } | null;
  if (!x || typeof x !== 'object') return null;
  const carga = cargaValida(x.carga);
  // La base manda el `numeric` como texto: `pesoValido` ya lo entiende.
  const peso = pesoValido(x.peso);
  const series = Number(x.series);
  if (!carga || !llevaNumero(carga) || peso === null) return null;
  if (!Number.isInteger(series) || series < 1 || typeof x.dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.dia)) return null;
  return { carga, peso, series, dia: x.dia };
}

/** Lo guardado en el teléfono, de vuelta: lo que no tenga la forma, afuera. */
export function leerSubidas(crudo: unknown): Subidas {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return {};
  const r: Subidas = {};
  for (const [ejercicio, s] of Object.entries(crudo)) {
    const v = subidaValida(s);
    if (v) r[ejercicio] = v;
  }
  return r;
}

/** Las filas de `mis_subidas`, como las quiere el teléfono. */
export function subidasDeLaBase(filas: unknown): Subidas {
  if (!Array.isArray(filas)) return {};
  return leerSubidas(Object.fromEntries(filas.map((f) => [String((f as { ejercicio?: unknown } | null)?.ejercicio ?? ''), f])));
}
