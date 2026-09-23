/**
 * QUÉ SE ESTÁ HACIENDO AHORA MISMO: el ejercicio y en qué serie va.
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
 * POR QUÉ UN MÓDULO SUELTO Y NO UN ARGUMENTO MÁS
 *
 * El que sabe el NOMBRE del ejercicio es la pantalla del bloque, que es la
 * única que tiene el catálogo cargado; el que enciende la cuenta de la pantalla
 * bloqueada es `descanso.ts`, al guardar el descanso. Entre los dos hay un hook
 * (`useSesion`) que no conoce el catálogo y no tiene por qué: su trabajo es
 * contar series, no traducir identificadores a nombres.
 *
 * Pasarlo como argumento obligaría a subir el catálogo hasta Inicio y bajarlo
 * de nuevo por tres capas, para un dato que solo se lee en un lugar. Es el
 * mismo patrón que `pedidoDeFondo` y `loVisible`, y por el mismo motivo.
 *
 * NO ES LA FUENTE DE NADA. Si nadie lo escribió, la tarjeta muestra el
 * temporizador solo, que es exactamente lo que mostraba antes. Nada de lo que
 * hay acá puede romper un descanso.
 */

export type EnCurso = {
  /** El nombre, ya resuelto. `null` = todavía no se eligió ejercicio. */
  ejercicio: string | null;
  /** La serie que se acaba de hacer, contando desde uno. */
  serie: number;
  /** Cuántas se propuso la persona en este bloque. */
  meta: number;
};

let actual: EnCurso | null = null;

export function ponerEnCurso(e: EnCurso) {
  actual = e;
}

export function leerEnCurso(): EnCurso | null {
  return actual;
}

/** Al terminar la sesión: lo de recién deja de ser cierto. */
export function olvidarEnCurso() {
  actual = null;
}
