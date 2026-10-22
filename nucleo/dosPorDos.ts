import { pesoValido, repsDe } from './bloques.ts';
import type { SesionConPesos } from './rutina.ts';

/**
 * CUÁNDO SUBIR EL PESO: LA REGLA 2 POR 2 DE LA NSCA (21/10, a pedido). Reemplaza al criterio de
 * antes —"todas las series al mismo peso, dos veces seguidas"—, que no sabía de repeticiones y
 * avisaba de más.
 *
 * Avisa cuando, en las dos últimas sesiones de ese ejercicio, la ÚLTIMA serie tuvo al menos 2
 * repeticiones más que el objetivo de la rutina. El aumento sugerido sale del peso de esa serie:
 * de 2 a 5 % en el tren superior y de 5 a 10 % en el inferior.
 *
 * Sin objetivo en la rutina, o sin las repeticiones de la última serie anotadas en alguna de
 * las dos sesiones, NO AVISA: la regla no se puede aplicar, y adivinar es lo que daba falsos
 * positivos.
 */
export type SubirPeso = { peso: number; desde: number; hasta: number; porcentaje: [number, number] };

/** Los grupos del tren inferior; el resto es superior. */
const INFERIOR = new Set(['piernas']);

export function porcentajesDeSubida(grupo: string | null | undefined): [number, number] {
  return INFERIOR.has(grupo ?? '') ? [5, 10] : [2, 5];
}

/** La última serie de ese ejercicio en esa sesión: sus repeticiones y su peso (los dos, o null). */
function ultimaSerie(s: SesionConPesos, ejercicio: string): { reps: number | null; peso: number | null } | null {
  let ultima: { reps: number | null; peso: number | null } | null = null;
  for (const b of s.bloques) {
    if (b?.ejercicio !== ejercicio) continue;
    const n = Number(b.series) > 0 ? Math.round(Number(b.series)) : 0;
    if (n === 0) continue;
    const reps = repsDe(b.reps, n);
    ultima = { reps: reps[n - 1], peso: pesoValido(b.pesos?.[n - 1]) };
  }
  return ultima;
}

export function dosPorDos(
  sesiones: SesionConPesos[],
  ejercicio: string,
  objetivo: number | null | undefined,
  grupo: string | null | undefined,
  hoyISO: string
): SubirPeso | null {
  if (!objetivo || objetivo < 1) return null;
  const suyas = sesiones
    .filter((s) => s.fecha < hoyISO && s.bloques.some((b) => b?.ejercicio === ejercicio))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  const dos = suyas.slice(-2).map((s) => ultimaSerie(s, ejercicio));
  if (dos.length < 2 || dos.some((u) => !u || u.reps === null || u.reps < objetivo + 2)) return null;
  const peso = dos[1]?.peso;
  if (!peso) return null;
  const porcentaje = porcentajesDeSubida(grupo);
  return { peso, desde: pesoValido(peso * (1 + porcentaje[0] / 100))!, hasta: pesoValido(peso * (1 + porcentaje[1] / 100))!, porcentaje };
}

/** El rango para decir, redondeado a lo que se puede cargar: media en kilos, una en libras; adentro del rango. */
export function rangoParaMostrar(s: SubirPeso, unidad: 'kg' | 'lb'): [number, number] {
  const LB = 2.2046226218;
  if (unidad === 'lb') return [Math.ceil(s.desde * LB) / LB, Math.max(Math.ceil(s.desde * LB), Math.floor(s.hasta * LB)) / LB];
  const desde = Math.ceil(s.desde * 2) / 2;
  return [desde, Math.max(desde, Math.floor(s.hasta * 2) / 2)];
}
