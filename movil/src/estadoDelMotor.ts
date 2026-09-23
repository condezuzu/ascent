/**
 * QUÉ PASÓ CON EL MOTOR DEL FONDO, para poder leerlo en Diagnóstico.
 *
 * DE DÓNDE SALE. En la web la galería ya avisa cuándo el motor no arrancó y
 * por qué (`nucleo/fondo.ts` → `porQueNoHayMotor`), porque quedarse mirando un
 * cielo sin ningún cuerpo es indistinguible de un bug. En el teléfono ese
 * aviso no existía y hace más falta: acá no hay consola, no hay `/galeria`, y
 * la única pantalla que cuenta qué está viendo la app es Diagnóstico.
 *
 * NO SE REUSA `porQueNoHayMotor` A PROPÓSITO. Sus cuatro motivos son del
 * navegador: dos de ellos —"equipo flojo" y "no hay WebGL"— no pueden pasar
 * acá. En el teléfono el equipo nunca se lee como flojo (no hay de dónde: ver
 * `FondoRaiz`, que le pasa `null`) y el contexto lo da `expo-gl`, que no es el
 * navegador. Traer los cuatro sería mostrar dos respuestas imposibles.
 *
 * Lo que sí puede pasar son estos cinco, y son los que se dicen.
 *
 * ES UNA VARIABLE DE MÓDULO Y NO UN ESTADO. Lo escribe la raíz y lo lee una
 * pantalla que está cinco niveles más abajo y que la mayoría de las veces ni
 * siquiera está montada; un contexto para esto obligaría a redibujar el árbol
 * entero cada vez que el motor cambia de fase. Diagnóstico ya refresca todo lo
 * suyo al abrirse, así que lo lee ahí. Es el mismo trato que
 * `comoLeyoLosPasos()`.
 */

export type EstadoDelMotor =
  /** Ninguna pantalla pidió fondo todavía: no se creó ni el lienzo. */
  | 'sin-pedido'
  /** La preferencia dice "nunca". El motor ni se importa. */
  | 'apagado'
  /** Se pidió y el lienzo existe; three todavía no terminó de evaluarse. */
  | 'arrancando'
  /** Hay renderer: el fondo está dibujando. */
  | 'andando'
  /** Se pidió, se pudo, y el renderer salió nulo. El único que es un error. */
  | 'no-arranco';

let actual: EstadoDelMotor = 'sin-pedido';

export function ponerEstadoDelMotor(e: EstadoDelMotor) {
  actual = e;
}

export function comoAnduvoElMotor(): EstadoDelMotor {
  return actual;
}
