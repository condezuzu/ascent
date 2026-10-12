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
import { paraGuardar, pesoValido, type EstadoBloques } from './bloques.ts';
import { aISO } from './fechas.ts';
import { modoDeBloque, type ModosDelCatalogo } from './pesoRecordado.ts';
import { pasoDelCampo } from './campoPeso.ts';
import type { Unidad } from './peso.ts';

export type Subida = { carga: Carga; peso: number; series: number; dia: string };
/**
 * `claveDeSubida(ejercicio, modo)` → su marca. POR EJERCICIO Y POR MODO
 * (12/10, migración 69): el remo con mancuernas y el remo en la máquina son dos
 * progresiones. Con una sola marca por ejercicio, hacer uno gastaba la del otro.
 */
export type Subidas = Record<string, Subida>;

export function claveDeSubida(ejercicio: string, carga: Carga): string {
  return `${ejercicio}|${carga}`;
}

const ejercicioDeClave = (clave: string) => clave.split('|')[0];

/**
 * EL DÍA DE LA MARCA ES EL DE LA SESIÓN, no el del reloj (12/10). Una sesión
 * que arranca a las 23:20 es del día en que arrancó, también para la base
 * (`logs.fecha`). Con el reloj, marcar a las 23:50 y reabrir el ejercicio a las
 * 00:05 daba el disco de más en la MISMA sesión, y terminar pasada la
 * medianoche borraba del teléfono las marcas recién puestas.
 */
export function diaDeLaSesion(inicio: string | null | undefined, ahora: Date = new Date()): string {
  const d = inicio ? new Date(inicio) : ahora;
  return aISO(Number.isNaN(d.getTime()) ? ahora : d);
}

/** Los ejercicios con peso anotado en una sesión, estén en un bloque cerrado o en el que se está haciendo. */
function conPeso(e: EstadoBloques): Set<string> {
  const r = new Set<string>();
  for (const b of paraGuardar(e)) if (b.ejercicio && (b.pesos ?? []).some((p) => pesoValido(p) !== null)) r.add(b.ejercicio);
  return r;
}

/**
 * LOS EJERCICIOS QUE DEJARON DE ESTAR tras corregir o quitar un bloque. Sus
 * marcas de hoy se sacan: marcar press de banca y después decir "eran de press
 * inclinado" dejaba la marca puesta en banca, sin botón para sacarla, y la
 * próxima banca proponía un disco de más por algo que nunca se marcó ahí.
 */
export function ejerciciosQueSeFueron(antes: EstadoBloques, despues: EstadoBloques): string[] {
  const quedan = conPeso(despues);
  return [...conPeso(antes)].filter((e) => !quedan.has(e));
}

/** Las claves de las marcas de ESE día de un ejercicio, en cualquier modo. */
export function marcasDelDia(subidas: Subidas, ejercicio: string, dia: string): string[] {
  return Object.keys(subidas).filter((clave) => ejercicioDeClave(clave) === ejercicio && subidas[clave].dia === dia);
}

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
export function subidasTrasLaSesion(subidas: Subidas, bloques: unknown, hoy: string, catalogo: ModosDelCatalogo = {}): Subidas {
  if (!Array.isArray(bloques)) return subidas;
  // EN EL MODO EN QUE SE HIZO: el bloque que no dice el suyo usa el del catálogo.
  const hechos = new Set<string>();
  for (const b of bloques) {
    const x = b as { ejercicio?: unknown; pesos?: unknown; carga?: unknown } | null;
    if (!x || typeof x.ejercicio !== 'string' || !Array.isArray(x.pesos) || x.pesos.length === 0) continue;
    const modo = modoDeBloque(x.ejercicio, x.carga, catalogo) ?? 'total';
    hechos.add(claveDeSubida(x.ejercicio, modo));
  }
  return Object.fromEntries(Object.entries(subidas).filter(([clave, s]) => !(hechos.has(clave) && s.dia < hoy)));
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
  for (const [clave, s] of Object.entries(crudo)) {
    const v = subidaValida(s);
    // Lo guardado antes de la 69 venía por ejercicio solo: se le pone su modo.
    if (v) r[claveDeSubida(ejercicioDeClave(clave), v.carga)] = v;
  }
  return r;
}

/** Las filas de `mis_subidas`, como las quiere el teléfono. */
export function subidasDeLaBase(filas: unknown): Subidas {
  if (!Array.isArray(filas)) return {};
  const r: Subidas = {};
  for (const f of filas) {
    const v = subidaValida(f);
    const ejercicio = (f as { ejercicio?: unknown } | null)?.ejercicio;
    if (v && typeof ejercicio === 'string' && ejercicio) r[claveDeSubida(ejercicio, v.carga)] = v;
  }
  return r;
}
