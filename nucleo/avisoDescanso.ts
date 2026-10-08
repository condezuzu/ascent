/**
 * EL AVISO DE FIN DE DESCANSO, MÁS LARGO (8/10/2026).
 *
 * El pedido: con el teléfono en silencio en el bolsillo, un golpe solo no se
 * siente. iOS no deja elegir cuánto dura una vibración —cada una dura lo que
 * dura, unos 0,4 s—, así que "más larga" es VARIAS SEGUIDAS:
 *
 *  - con la app abierta, tres golpes encadenados (`GOLPES` / `PAUSA_MS`);
 *  - con el teléfono bloqueado el código no corre: vibra el aviso del sistema,
 *    una vez por aviso. Entonces son TRES avisos, separados por un segundo. Los
 *    dos de más son los "ecos".
 *
 * NO IMPORTA NADA del teléfono: qué se programa y cuándo se prueba con node.
 */

/** Cuántos avisos repiten al primero. */
export const ECOS = 2;
/** Segundos entre un aviso y el siguiente. La campana dura uno: no se pisan. */
export const SEPARACION_ECO_S = 1;

/** Con la app abierta: cuántos golpes, y cuánto se espera entre el arranque de uno y el del otro. */
export const GOLPES = 3;
export const PAUSA_MS = 600;

const idDelEco = (id: string, n: number) => `${id}-eco-${n}`;

/** Todos los avisos de un descanso, para cancelarlos juntos: ninguno puede quedar sonando. */
export function idsDelAviso(id: string): string[] {
  return [id, ...Array.from({ length: ECOS }, (_, i) => idDelEco(id, i + 1))];
}

/** Qué se programa cuando al descanso le faltan `faltan` segundos. */
export function avisosDelDescanso(id: string, faltan: number): { id: string; en: number }[] {
  return idsDelAviso(id).map((uno, i) => ({ id: uno, en: faltan + i * SEPARACION_ECO_S }));
}

/** Un eco solo existe para vibrar con el teléfono bloqueado: con la app abierta no suena. */
export function esEco(id: unknown): boolean {
  return typeof id === 'string' && /-eco-\d+$/.test(id);
}
