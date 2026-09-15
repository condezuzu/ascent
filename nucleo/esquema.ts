/**
 * QUÉ MIGRACIÓN NECESITA CADA COSA.
 *
 * EL BUG QUE ESTO ARREGLA. El campo de peso se mostró antes de que corriera la
 * migración 36. La función vieja de guardar bloques no daba error: tiraba los
 * pesos en silencio. Se veían, se escribían, y no se guardaba nada. Una
 * interfaz que no sabe si su migración está es una interfaz que puede mentir.
 *
 * LA REGLA: si algo depende de una migración, pregunta `disponible(...)` y se
 * esconde solo mientras la versión de la base no llegue. Hay un test que
 * falla si una pantalla llama a una función de la base creada en la migración
 * 35 o después sin pasar por acá.
 *
 * ANTES ESTO SE HACÍA A MANO: una constante en `false` que alguien tenía que
 * acordarse de cambiar. Funciona para algo que se prende una vez; no para cada
 * migración.
 */

export const REQUIERE = {
  /** El aviso de las 20:30: las suscripciones push. */
  avisoDiario: 35,
  /** Guardar el peso de cada serie, y el último peso usado. */
  pesoPorSerie: 36,
  /** El cierre por inactividad: marcar actividad desde el teléfono. */
  cierrePorInactividad: 37,
  /** Qué significa el número del peso: el modo en cada bloque y la pregunta de la primera vez. */
  cargaDelPeso: 38,
  /** Revisar los pesos anotados antes de que existieran los modos. */
  revisarCargas: 39,
  /** El aviso de estancamiento a las 2 semanas: la base rechazaba el 2. */
  umbralDeDosSemanas: 40,
} as const;

export type Funcion = keyof typeof REQUIERE;

/**
 * Si se puede mostrar. `null` —todavía no se sabe— es NO: esconder un rato de
 * más es un campo que aparece un segundo tarde; mostrar de más es perder lo
 * que alguien escribió.
 */
export function disponible(funcion: Funcion, version: number | null): boolean {
  return version !== null && version >= REQUIERE[funcion];
}
