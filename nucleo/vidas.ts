/**
 * QUÉ HAY QUE CONTARLE AL USUARIO SOBRE SUS VIDAS.
 *
 * EL BUG QUE ESTO ARREGLA, y vale escribirlo porque el error de razonamiento
 * fue mío: el aviso salía de `verificar_perdida`, que reporta los días que
 * cubrió **solo en la llamada que los cubrió**. El comentario del componente
 * decía que eso era una ventaja —"no hace falta guardar si ya se mostró,
 * porque el hecho no se repite"— y era falso: el hecho no se repite, pero el
 * REPORTE es de una sola llamada. Hay por lo menos tres formas de perdérselo:
 * la llamada pasa con una sesión corriendo y el aviso no se dibuja en ese
 * estado, la pantalla se vuelve a montar, o cualquier otra llamada llega
 * primero.
 *
 * El día queda cubierto igual —la racha está bien y la vida gastada— y lo
 * único que se pierde es que te enteres, que es justo lo que hace que la
 * mecánica exista.
 *
 * LA REGLA, AHORA: el aviso sale del ESTADO y no del evento. La base dice qué
 * días están cubiertos; el teléfono se acuerda de cuál fue el último que
 * anunció. Se puede preguntar mil veces y la respuesta es la misma.
 *
 * NO IMPORTA NADA: son fechas ISO y comparación de strings, que para
 * `AAAA-MM-DD` es comparación cronológica.
 */

/**
 * Los días cubiertos que todavía no se anunciaron, del más viejo al más
 * nuevo.
 *
 * `vista` es la última fecha ya anunciada en ESTE aparato. Sin marca —cuenta
 * nueva, o el primer aviso— se anuncia todo lo que haya.
 */
export function vidasSinVer(ultimas: string[], vista: string | null): string[] {
  return ultimas.filter((f) => !vista || f > vista).sort();
}

/**
 * Hasta dónde marcar como visto después de mostrar el aviso.
 *
 * Es el máximo de TODO lo que vino, no solo de lo que se anunció: si la base
 * dice que hay un día cubierto más viejo que la marca, ya se anunció alguna
 * vez y no tiene que volver.
 */
export function hastaDondeVisto(ultimas: string[], vista: string | null): string | null {
  const todas = vista ? [...ultimas, vista] : [...ultimas];
  if (todas.length === 0) return vista;
  return todas.sort()[todas.length - 1];
}

/**
 * EL PRECIO DE GUARDARLA: en cuánto queda la racha si se devuelve la vida.
 *
 * ES LA MISMA CUENTA QUE HACE LA BASE —`greatest(0, racha_actual - 10)` en
 * `verificar_perdida`— y está repetida acá a propósito: la ventana tiene que
 * decir el número ANTES de cobrarlo, y para eso no puede esperar a que la base
 * conteste. Que sean dos copias de la misma regla es exactamente el riesgo que
 * corre esto, y por eso hay un test que las compara contra la base de verdad.
 *
 * DIEZ Y NO TODO: la racha se dispersa, no explota. Volver a cero convierte
 * cualquier falta en empezar de nuevo, y ahí la única estrategia razonable es
 * abandonar.
 */
export const CASTIGO_DE_PERDIDA = 10;

export function rachaSiSeDevuelve(racha: number): number {
  return Math.max(0, racha - CASTIGO_DE_PERDIDA);
}
