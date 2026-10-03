/**
 * EL ÚLTIMO PESO, POR EJERCICIO Y POR MODO.
 *
 * EL PROBLEMA (1/10, del gimnasio): el remo se hace un día con mancuernas a 20
 * y otro en la máquina a 50. Al elegir el ejercicio la app ya proponía el
 * último peso del modo recordado, pero al CAMBIAR de modo en el bloque el
 * número se quedaba: "50 por mancuerna" es proponer el doble de lo que se
 * levanta.
 *
 * LA REGLA: el peso que se propone es el último que se usó con ESE ejercicio en
 * ESE modo, y sale de un solo lugar —esta cuenta— tanto al elegir el ejercicio
 * como al cambiar de modo. Antes había dos caminos (la base al arrancar, nada al
 * cambiar) y por eso discrepaban.
 *
 * DE DÓNDE SALE, en este orden:
 *   1. lo que se hizo HOY, que está en el teléfono aunque no haya subido;
 *   2. la copia del historial que guarda el teléfono (`compartido/pesosRecordados`),
 *      que es lo que anda en el subsuelo sin señal.
 *
 * UN BLOQUE SIN MODO USA EL DEL CATÁLOGO, no `total`. `como_arranca` en la base
 * lo lee como `total`; hoy no cambia nada —desde la migración 38 todo bloque con
 * pesos lleva su modo— pero un remo con mancuernas sin etiqueta no fue "en
 * total". Acá no se adivina: sin modo y sin catálogo, el bloque no dice nada.
 *
 * Solo importa de `./`, igual que el resto de `nucleo`: `test:db` lo carga con
 * node pelado.
 */

import { cargaValida, type Carga } from './carga.ts';
import { paraGuardar, pesoValido, type EstadoBloques } from './bloques.ts';

/** ejercicio → modo → el último peso anotado, en kilos. */
export type PesosPorModo = Record<string, Partial<Record<Carga, number>>>;

/** El modo por omisión de cada ejercicio, como lo dice el catálogo. */
export type ModosDelCatalogo = Record<string, Carga>;

/** El modo de un bloque guardado: el suyo, y si no lo dice, el del catálogo. */
export function modoDeBloque(ejercicio: string, carga: unknown, catalogo: ModosDelCatalogo): Carga | null {
  return cargaValida(carga) ?? cargaValida(catalogo[ejercicio]);
}

/**
 * Suma una lista de bloques, EN ORDEN, a lo que ya se sabía: el que viene
 * después gana. De cada bloque cuenta su última serie con peso.
 */
export function pesosDeBloques(bloques: unknown, catalogo: ModosDelCatalogo, sobre: PesosPorModo = {}): PesosPorModo {
  if (!Array.isArray(bloques)) return sobre;
  let r = sobre;
  for (const b of bloques) {
    if (!b || typeof b !== 'object') continue;
    const x = b as { ejercicio?: unknown; pesos?: unknown; carga?: unknown };
    if (typeof x.ejercicio !== 'string' || !Array.isArray(x.pesos)) continue;
    const modo = modoDeBloque(x.ejercicio, x.carga, catalogo);
    // Con peso corporal el número no existe: no hay nada que recordar.
    if (modo === null || modo === 'corporal') continue;
    const ultimo = [...x.pesos].reverse().map(pesoValido).find((p) => p !== null);
    if (ultimo === undefined || ultimo === null) continue;
    r = { ...r, [x.ejercicio]: { ...r[x.ejercicio], [modo]: ultimo } };
  }
  return r;
}

/** El historial entero: las sesiones de la más vieja a la más nueva. */
export function pesosDelHistorial(sesiones: unknown, catalogo: ModosDelCatalogo): PesosPorModo {
  if (!Array.isArray(sesiones)) return {};
  return sesiones.reduce<PesosPorModo>(
    (r, s) => pesosDeBloques((s as { bloques?: unknown } | null)?.bloques, catalogo, r),
    {}
  );
}

/**
 * EL PESO A PROPONER: el último de ese ejercicio en ese modo. Primero lo de
 * hoy —el bloque en curso y los cerrados—, después la copia del historial.
 */
export function ultimoPesoEnModo(
  enCurso: EstadoBloques,
  copia: PesosPorModo,
  ejercicio: string,
  modo: Carga,
  catalogo: ModosDelCatalogo
): number | null {
  if (modo === 'corporal') return null;
  const deHoy = pesosDeBloques(paraGuardar(enCurso), catalogo);
  return deHoy[ejercicio]?.[modo] ?? copia[ejercicio]?.[modo] ?? null;
}

/** El modo que se está viendo en el bloque en curso, si se puede saber. */
export function modoDelBloqueEnCurso(e: EstadoBloques, catalogo: ModosDelCatalogo): Carga | null {
  return e.ejercicio === null ? null : modoDeBloque(e.ejercicio, e.carga, catalogo);
}

/** Lo guardado en el teléfono, de vuelta: lo que no tenga la forma, afuera. */
export function leerPesosPorModo(crudo: unknown): PesosPorModo {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return {};
  const r: PesosPorModo = {};
  for (const [ejercicio, modos] of Object.entries(crudo)) {
    if (!modos || typeof modos !== 'object') continue;
    const limpio: Partial<Record<Carga, number>> = {};
    for (const [modo, kg] of Object.entries(modos)) {
      const c = cargaValida(modo);
      const v = pesoValido(kg);
      if (c !== null && v !== null) limpio[c] = v;
    }
    if (Object.keys(limpio).length > 0) r[ejercicio] = limpio;
  }
  return r;
}

export function leerModosDelCatalogo(crudo: unknown): ModosDelCatalogo {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return {};
  const r: ModosDelCatalogo = {};
  for (const [ejercicio, modo] of Object.entries(crudo)) {
    const c = cargaValida(modo);
    if (c !== null) r[ejercicio] = c;
  }
  return r;
}
