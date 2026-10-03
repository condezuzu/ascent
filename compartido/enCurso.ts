/**
 * CÓMO SE LLAMA CADA EJERCICIO, para la cuenta de la pantalla bloqueada.
 *
 * ─────────────────────────────────────────────────────────────────────
 * PARA QUÉ EXISTE (25/9)
 *
 * *"El cuadro de la pantalla de bloqueo hoy es solo un timer. Hacelo mejor."*
 * Lo que falta ahí es lo único que uno mira entre serie y serie: **qué estabas
 * haciendo y por cuál vas**. Con el teléfono boca arriba en el banco, "2:58" a
 * secas te dice cuándo volver y nada sobre a qué volver.
 *
 * ─────────────────────────────────────────────────────────────────────
 * POR QUÉ SOLO LOS NOMBRES (2/10)
 *
 * Antes la pantalla del bloque anotaba acá TODO —el nombre, la serie y la
 * meta— desde un efecto, y el descanso lo leía al arrancar. El número de serie
 * dependía de cuándo corría ese efecto respecto de la suma, y cuando el orden
 * cambió la tarjeta pasó una semana diciendo "serie 4 de 3".
 *
 * La serie y la meta ahora salen del estado que el descanso ve
 * (`serieDelDescanso` en `nucleo/bloques.ts`). De la pantalla del bloque queda
 * lo único que solo ella sabe: el catálogo, o sea que `press_banca` se dice
 * "Press de banca". El hook de la sesión no conoce el catálogo y no tiene por
 * qué: su trabajo es contar series, no traducir identificadores.
 *
 * NO ES LA FUENTE DE NADA. Si nadie lo escribió, la tarjeta sale sin nombre,
 * que es exactamente lo que mostraba antes. Nada de lo que hay acá puede
 * romper un descanso.
 */

let nombres: Record<string, string> = {};

export function ponerNombres(lista: readonly { id: string; nombre: string }[]) {
  // Un catálogo que no llegó (sin señal) no borra los nombres que ya se sabían.
  if (lista.length === 0) return;
  nombres = Object.fromEntries(lista.map((e) => [e.id, e.nombre]));
}

/** El nombre, ya resuelto. `null` = sin ejercicio, o todavía no se sabe. */
export function nombreDe(id: string | null): string | null {
  return id === null ? null : (nombres[id] ?? null);
}
