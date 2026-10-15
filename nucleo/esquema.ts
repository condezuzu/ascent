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
  /** Corregir y borrar el peso de un día: la tabla solo tenía lectura. */
  corregirPeso: 45,
  /** El atajo "Tuyos" del selector: los ejercicios que cada persona repite. */
  tusEjercicios: 44,
  /**
   * Las medallas de un amigo. El percentil se calcula con el peso corporal, que
   * de otra persona no se ve nunca: lo deja escrito el dueño y el amigo lo lee.
   */
  medallasDeAmigo: 46,
  /** Las medallas de varios amigos en una sola consulta, para el ranking. */
  medallasDeMuchos: 52,
  /** La racha de cada día en el log, para el "día 41" del álbum. */
  diaDeRacha: 57,
  /** El modo de carga "peso corporal": la base lo valida en checks y funciones. */
  cargaCorporal: 58,
  /** La rutina que ve un amigo, y el interruptor para esconderla. */
  rutinaDeAmigo: 64,
  /** "La próxima, más": marcar que un peso quedó chico, y que se proponga un disco más. */
  subirPeso: 65,
  /** Entrenar con otro (de a dos), y saber si un amigo escondió su rutina. */
  entrenarConOtro: 67,
  /** "Avisar cuando entreno" nace prendido: recién ahí tiene sentido avisarlo. */
  avisoDeEntrenoPrendido: 68,
  /** Corregir un día en una sola transacción, en vez de borrar y volver a poner. */
  corregirDiaDeUna: 74,
  /** Las rutinas guardadas: varias por cuenta, una activa. */
  rutinas: 75,
  /** Ejercicios propios y cardio (se mide en minutos). */
  ejerciciosPropios: 76,
  /** Avisos push: te quieren agregar, quieren unirse a tu entrenamiento. */
  avisosRemotos: 77,
  /** Los amigos de un amigo, en su perfil. */
  amigosDeAmigos: 78,
  /** Las vidas vuelven todas juntas al cerrarse el ciclo de 30 días. */
  vidasDeUna: 79,
  /** Los ejercicios propios los ve solo quien los creó (la app no depende de esto). */
  propiosSoloMios: 80,
  /** La marca de actividad acepta hasta una hora adelante (descanso a mano, cinta larga). */
  marcaDeUnaHora: 81,
  /** La marca de actividad se puede achicar ("Listo" en la cinta, el descanso cortado). */
  bajarMarca: 82,
  /** Darse de baja aunque un amigo haya usado tus ejercicios propios (la app no depende de esto). */
  bajaConPropios: 83,
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
