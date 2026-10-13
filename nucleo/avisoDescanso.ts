/**
 * EL AVISO DE FIN DE DESCANSO.
 *
 * UNA SOLA NOTIFICACIÓN (12/10/2026). El 8/10 se probó mandar tres seguidas
 * para que con el teléfono bloqueado vibrara más: vibraba más, y dejaba tres
 * avisos en el centro de notificaciones por cada descanso. Volvió a ser una.
 * Con el teléfono bloqueado, cuánto vibra una notificación lo decide iOS; lo
 * que se puede elegir es su sonido, y ese archivo viaja en la build.
 *
 * CON LA APP ABIERTA sí se puede vibrar más: tres golpes encadenados
 * (`GOLPES` / `PAUSA_MS`). iOS no deja elegir cuánto dura cada uno.
 *
 * NO IMPORTA NADA del teléfono: se prueba con node pelado.
 */

/** Con la app abierta: cuántos golpes, y cuánto se espera entre el arranque de uno y el del otro. */
export const GOLPES = 3;
export const PAUSA_MS = 600;

/**
 * Los avisos de más que programaba la versión del 8/10. Ya no se programan,
 * pero se CANCELAN siempre: un teléfono que actualiza en medio de un descanso
 * puede tener dos esperando.
 */
export function ecosViejos(id: string): string[] {
  return [`${id}-eco-1`, `${id}-eco-2`];
}

/** Pasado esto desde que terminó, avisar ya no sirve: es ruido por algo viejo. */
export const TARDE_MS = 5000;

/**
 * QUÉ HACER AL VER QUE EL DESCANSO TERMINÓ.
 *
 * - `ya`: de este descanso ya se avisó. Lo ven dos lugares —la pantalla del
 *   descanso y la notificación que llega con la app abierta— y vibra uno solo.
 * - `tarde`: terminó hace rato y recién ahora se lo mira (se volvió a la app a
 *   los cinco minutos). Vibrar tres veces por eso es molestar por nada.
 * - `avisar`: terminó recién.
 */
export function queHacerAlTerminar(fin: number, avisado: number | null, ahora: number): 'avisar' | 'ya' | 'tarde' {
  if (avisado === fin) return 'ya';
  return ahora - fin > TARDE_MS ? 'tarde' : 'avisar';
}

/**
 * CUÁNTO SE PASÓ del descanso, en segundos (12/10). Al terminar, la pantalla no
 * se queda clavada en 0:00: cuenta hacia arriba, y con eso se sabe cuánto de
 * más se descansó. Antes del final es cero.
 */
export function pasadoDe(fin: number, ahora: number): number {
  return Math.max(0, Math.floor((ahora - fin) / 1000));
}
