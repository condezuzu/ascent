/**
 * EL AVISO DE FIN DE DESCANSO.
 *
 * UNA SOLA NOTIFICACIÓN (12/10/2026). El 8/10 se probó mandar tres seguidas
 * para que con el teléfono bloqueado vibrara más: vibraba más, y dejaba tres
 * avisos en el centro de notificaciones por cada descanso. Volvió a ser una.
 * Con el teléfono bloqueado, cuánto vibra una notificación lo decide iOS; lo
 * que se puede elegir es su sonido, y ese archivo viaja en la build.
 *
 * CON LA APP ABIERTA sí se puede vibrar más: desde el 20/10, como un despertador
 * (`DESPERTADOR`). iOS no deja elegir cuánto dura cada golpe.
 *
 * NO IMPORTA NADA del teléfono: se prueba con node pelado.
 */

/**
 * CON LA APP ABIERTA, COMO UN DESPERTADOR (20/10, a pedido): tres tandas de tres golpes,
 * unos cinco segundos. Antes eran tres golpes sueltos, que con el teléfono en el banco se
 * pierden. Los tiempos van de arranque a arranque: en iOS cada golpe dura ~0,4 s.
 */
export const DESPERTADOR = { tandas: 3, golpes: 3, entreGolpes: 450, entreTandas: 1000 } as const;
/** Lo que dura un golpe donde se puede elegir (Android). */
export const GOLPE_MS = 300;

/**
 * El patrón para `Vibration.vibrate`. En iOS los números son esperas entre el arranque de un
 * golpe y el del siguiente; en Android alternan espera y duración.
 */
export function patronDespertador(ios: boolean): number[] {
  const esperas: number[] = [];
  for (let t = 0; t < DESPERTADOR.tandas; t++) {
    for (let g = 0; g < DESPERTADOR.golpes; g++) {
      if (t === 0 && g === 0) continue;
      esperas.push(g === 0 ? DESPERTADOR.entreTandas : DESPERTADOR.entreGolpes);
    }
  }
  return ios ? [0, ...esperas] : [0, GOLPE_MS, ...esperas.flatMap((e) => [e - GOLPE_MS, GOLPE_MS])];
}

/** Lo que dura el despertador entero, hasta el arranque del último golpe. */
export function duracionDelDespertador(): number {
  return patronDespertador(true).reduce((a, b) => a + b, 0);
}

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
