/**
 * EL PESO QUE SE PROPONE, POR EJERCICIO Y POR MODO.
 *
 * DESDE EL 13/10/2026 ES EL MÁS PESADO DE LA ÚLTIMA SESIÓN, no su última serie.
 * Casi todos arrancan con el peso más alto y bajan a medida que se cansan:
 * proponer la última serie era proponer la más liviana, y así no se sabe si se
 * está subiendo. Es también lo que la lista muestra al lado del ejercicio.
 * DENTRO de la sesión de hoy sigue siendo la última serie: quien reabre un
 * ejercicio a los veinte minutos sigue desde donde quedó, no desde el tope.
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
 * UN BLOQUE SIN MODO USA EL DEL CATÁLOGO, no `total`: un remo con mancuernas sin
 * etiqueta no fue "en total". Acá no se adivina: sin modo y sin catálogo, el
 * bloque no dice nada.
 *
 * `como_arranca` EN LA BASE ES LA MISMA REGLA (migraciones 70 y 71) y es solo el
 * respaldo de un teléfono sin historial. Quien cambie una cambia la otra:
 * `test:db` les pasa las mismas sesiones a las dos y compara.
 *
 * Solo importa de `./`, igual que el resto de `nucleo`: `test:db` lo carga con
 * node pelado.
 */

import { cargaValida, type Carga } from './carga.ts';
import { paraGuardar, pesoValido, type EstadoBloques } from './bloques.ts';

/** ejercicio → modo → el peso a proponer, en kilos. */
export type PesosPorModo = Record<string, Partial<Record<Carga, number>>>;

/** El modo por omisión de cada ejercicio, como lo dice el catálogo. */
export type ModosDelCatalogo = Record<string, Carga>;

/** El modo de un bloque guardado: el suyo, y si no lo dice, el del catálogo. */
export function modoDeBloque(ejercicio: string, carga: unknown, catalogo: ModosDelCatalogo): Carga | null {
  return cargaValida(carga) ?? cargaValida(catalogo[ejercicio]);
}

/**
 * Los bloques de UNA SESIÓN, sumados a lo que ya se sabía: lo de esta sesión
 * pisa lo anterior. `cual` dice qué serie se queda de cada ejercicio y modo:
 * la más pesada (el historial) o la última (lo de hoy).
 */
function deUnaSesion(bloques: unknown, catalogo: ModosDelCatalogo, sobre: PesosPorModo, cual: 'pesada' | 'ultima'): PesosPorModo {
  if (!Array.isArray(bloques)) return sobre;
  const deEsta: PesosPorModo = {};
  for (const b of bloques) {
    if (!b || typeof b !== 'object') continue;
    const x = b as { ejercicio?: unknown; pesos?: unknown; carga?: unknown };
    if (typeof x.ejercicio !== 'string' || !Array.isArray(x.pesos)) continue;
    const modo = modoDeBloque(x.ejercicio, x.carga, catalogo);
    // Con peso corporal el número no existe: no hay nada que recordar.
    if (modo === null || modo === 'corporal') continue;
    const validos = x.pesos.map(pesoValido).filter((p): p is number => p !== null);
    if (validos.length === 0) continue;
    const ya = deEsta[x.ejercicio]?.[modo];
    const peso = cual === 'ultima' ? validos[validos.length - 1] : Math.max(ya ?? 0, ...validos);
    deEsta[x.ejercicio] = { ...deEsta[x.ejercicio], [modo]: peso };
  }
  const r = { ...sobre };
  for (const [ejercicio, modos] of Object.entries(deEsta)) r[ejercicio] = { ...r[ejercicio], ...modos };
  return r;
}

/** Una sesión TERMINADA: de cada ejercicio y modo, su serie más pesada. */
export function pesosDeBloques(bloques: unknown, catalogo: ModosDelCatalogo, sobre: PesosPorModo = {}): PesosPorModo {
  return deUnaSesion(bloques, catalogo, sobre, 'pesada');
}

/**
 * LO MÁS PESADO DE LA ÚLTIMA VEZ (10/10/2026), para la lista de ejercicios.
 *
 * La serie MÁS PESADA de la última sesión en que se hizo el ejercicio, con el
 * modo en que se anotó. `PesosPorModo` guarda lo mismo pero POR MODO, para el
 * campo: los dos números coinciden salvo que esa sesión haya mezclado modos.
 */
export type MaximosDeLaUltima = Record<string, { peso: number; carga: Carga }>;

/** Los bloques de UNA sesión: lo más pesado de cada ejercicio pisa lo que se sabía de antes. */
export function maximosDeBloques(bloques: unknown, catalogo: ModosDelCatalogo, sobre: MaximosDeLaUltima = {}): MaximosDeLaUltima {
  if (!Array.isArray(bloques)) return sobre;
  const deEsta: MaximosDeLaUltima = {};
  for (const b of bloques) {
    if (!b || typeof b !== 'object') continue;
    const x = b as { ejercicio?: unknown; pesos?: unknown; carga?: unknown };
    if (typeof x.ejercicio !== 'string' || !Array.isArray(x.pesos)) continue;
    const modo = modoDeBloque(x.ejercicio, x.carga, catalogo);
    if (modo === null || modo === 'corporal') continue;
    for (const crudo of x.pesos) {
      const p = pesoValido(crudo);
      if (p !== null && p > (deEsta[x.ejercicio]?.peso ?? 0)) deEsta[x.ejercicio] = { peso: p, carga: modo };
    }
  }
  return { ...sobre, ...deEsta };
}

/**
 * YA PUEDES SUBIR EL PESO (15/10): el ejercicio que en su última sesión se hizo
 * con TODAS las series al mismo peso (dos o más), y ese peso fue también el más
 * pesado de la vez anterior, en el mismo modo. Dos veces seguidas igual y
 * entero: está para subir. Las sesiones, de la más vieja a la más nueva.
 */
export function listosParaSubir(sesiones: unknown, catalogo: ModosDelCatalogo): MaximosDeLaUltima {
  if (!Array.isArray(sesiones)) return {};
  type Vez = { iguales: number | null; maximo: number; carga: Carga };
  const veces: Record<string, Vez[]> = {};
  for (const s of sesiones) {
    const bloques = (s as { bloques?: unknown } | null)?.bloques;
    if (!Array.isArray(bloques)) continue;
    // Dos bloques del mismo ejercicio en una sesión cuentan juntos.
    const deEsta: Record<string, { pesos: (number | null)[]; carga: Carga; mezcla: boolean }> = {};
    for (const b of bloques) {
      if (!b || typeof b !== 'object') continue;
      const x = b as { ejercicio?: unknown; pesos?: unknown; carga?: unknown };
      if (typeof x.ejercicio !== 'string' || !Array.isArray(x.pesos)) continue;
      const modo = modoDeBloque(x.ejercicio, x.carga, catalogo);
      if (modo === null || modo === 'corporal') continue;
      const ya = deEsta[x.ejercicio];
      const pesos = x.pesos.map(pesoValido);
      deEsta[x.ejercicio] = ya ? { pesos: [...ya.pesos, ...pesos], carga: ya.carga, mezcla: ya.mezcla || ya.carga !== modo } : { pesos, carga: modo, mezcla: false };
    }
    for (const [ejercicio, d] of Object.entries(deEsta)) {
      const validos = d.pesos.filter((p): p is number => p !== null);
      if (validos.length === 0) continue;
      const enteras = !d.mezcla && d.pesos.length >= 2 && validos.length === d.pesos.length && validos.every((p) => p === validos[0]);
      (veces[ejercicio] ??= []).push({ iguales: enteras ? validos[0] : null, maximo: Math.max(...validos), carga: d.carga });
    }
  }
  const r: MaximosDeLaUltima = {};
  for (const [ejercicio, v] of Object.entries(veces)) {
    const ultima = v[v.length - 1];
    const antes = v[v.length - 2];
    if (antes && ultima.iguales !== null && antes.carga === ultima.carga && antes.maximo === ultima.iguales) {
      r[ejercicio] = { peso: ultima.iguales, carga: ultima.carga };
    }
  }
  return r;
}

/**
 * Al terminar una sesión, sin esperar a la base (cacería del 15/10): la vez anterior de
 * cada ejercicio es lo más pesado de la copia (`maximosDeAntes`). Lo que esta sesión hizo
 * con peso se decide de nuevo; lo demás queda como estaba.
 */
export function paraSubirTrasLaSesion(antes: MaximosDeLaUltima, maximosDeAntes: MaximosDeLaUltima, bloques: unknown, catalogo: ModosDelCatalogo): MaximosDeLaUltima {
  const previa = Object.entries(maximosDeAntes).map(([ejercicio, m]) => ({ ejercicio, pesos: [m.peso], carga: m.carga }));
  const nuevos = listosParaSubir([{ bloques: previa }, { bloques }], catalogo);
  const r = { ...antes };
  for (const ej of Object.keys(maximosDeBloques(bloques, catalogo))) delete r[ej];
  return { ...r, ...nuevos };
}

export function maximosDelHistorial(sesiones: unknown, catalogo: ModosDelCatalogo): MaximosDeLaUltima {
  if (!Array.isArray(sesiones)) return {};
  return sesiones.reduce<MaximosDeLaUltima>(
    (r, s) => maximosDeBloques((s as { bloques?: unknown } | null)?.bloques, catalogo, r),
    {}
  );
}

export function leerMaximos(crudo: unknown): MaximosDeLaUltima {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return {};
  const r: MaximosDeLaUltima = {};
  for (const [ejercicio, m] of Object.entries(crudo)) {
    const peso = pesoValido((m as { peso?: unknown } | null)?.peso);
    const carga = cargaValida((m as { carga?: unknown } | null)?.carga);
    if (peso !== null && carga !== null && carga !== 'corporal') r[ejercicio] = { peso, carga };
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
 * EL PESO A PROPONER para ese ejercicio en ese modo. Primero lo de hoy —la
 * última serie del bloque en curso y de los cerrados—, después la copia del
 * historial, que trae lo más pesado de la última sesión.
 */
export function ultimoPesoEnModo(
  enCurso: EstadoBloques,
  copia: PesosPorModo,
  ejercicio: string,
  modo: Carga,
  catalogo: ModosDelCatalogo
): number | null {
  if (modo === 'corporal') return null;
  const deHoy = deUnaSesion(paraGuardar(enCurso), catalogo, {}, 'ultima');
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
