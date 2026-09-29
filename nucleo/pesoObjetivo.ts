/**
 * EL OBJETIVO DE PESO — UN NÚMERO, NO UNA DIRECCIÓN.
 *
 * Se pone un peso al que se quiere llegar (85 kg). La dirección —subir o bajar—
 * sale sola de dónde estás hoy: uno pone 85 y tiene que subir, otro pone 70 y
 * tiene que bajar. El color de cada cambio sale de si te ACERCÁS o te ALEJÁS de
 * ese número, no de si el número sube o baja (subir no es bueno ni malo: depende
 * de tu objetivo).
 *
 * VIVE EN EL APARATO, no en la base, igual que la meta de pasos: es cómo querés
 * mirar tu peso, no un dato que se comparta ni que nadie más lea. Así no hace
 * falta migración.
 */

export const CLAVE_OBJETIVO_PESO = 'ascent:objetivo-peso';

/**
 * CUÁN CERCA CUENTA COMO LLEGAR: un kilo. Y no es un número al azar. El peso
 * corporal se mueve entre medio kilo y un kilo largo entre la mañana y la noche
 * —agua, comida, sal—, así que un margen más fino que eso te haría "llegar" un
 * día y "salir" al otro por ruido de la balanza, no por progreso. A un kilo, la
 * diferencia que queda ES ese ruido: a efectos prácticos ya estás en tu número.
 */
export const MARGEN_LLEGADA_KG = 1;

/** Los mismos límites que un peso de la base (20 a 400 kg). */
export function objetivoValido(kg: number): boolean {
  return Number.isFinite(kg) && kg >= 20 && kg <= 400;
}

/** Lo guardado (en kg), o `null` si no hay o está roto: sin objetivo no se pinta nada. */
export function leerObjetivo(crudo: string | null | undefined): number | null {
  const n = Number(crudo);
  if (!Number.isFinite(n)) return null;
  return objetivoValido(n) ? Math.round(n * 100) / 100 : null;
}

/** ¿El peso de hoy ya está en el objetivo (dentro del margen)? */
export function llego(kg: number, objetivo: number | null): boolean {
  return objetivo !== null && Math.abs(kg - objetivo) <= MARGEN_LLEGADA_KG;
}

export type Rumbo = 'sin-objetivo' | 'llegado' | 'acerca' | 'aleja' | 'igual';

/**
 * EL RUMBO DE UN PASO: de `anterior` a `valor`, respecto del objetivo.
 *
 * - Sin objetivo → nada de color (`sin-objetivo`).
 * - El paso deja el peso DENTRO del margen → `llegado` (el momento lindo).
 * - Se acercó al objetivo → `acerca`; se alejó → `aleja`; igual → `igual`.
 *
 * Es simétrico a propósito: si el objetivo es subir, acercarse es subir; si es
 * bajar, acercarse es bajar. La app no sabe —ni le importa— cuál de las dos es.
 */
export function rumboDelPaso(valor: number, anterior: number, objetivo: number | null): Rumbo {
  if (objetivo === null) return 'sin-objetivo';
  if (Math.abs(valor - objetivo) <= MARGEN_LLEGADA_KG) return 'llegado';
  const d = Math.abs(valor - objetivo);
  const dAnt = Math.abs(anterior - objetivo);
  if (d < dAnt) return 'acerca';
  if (d > dAnt) return 'aleja';
  return 'igual';
}
