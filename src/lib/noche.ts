/**
 * CUÁNTO SE VE LA SUPERFICIE DE UN CUERPO.
 *
 * DE DÓNDE SALE ESTO. El humano mandó una captura de su Inicio en día de
 * descanso y dijo que ese planeta le gustaba mucho más que el de siempre: "un
 * planeta cálido con atmósfera, sin rasgos". Parecía que pedía sacar la
 * textura, y por un rato se trabajó en un estilo plano sin texturas.
 *
 * No era eso. Ese planeta ES Marte, con toda su textura puesta — lo que pasa es
 * que en día de descanso el shader lo dibuja desde su cara nocturna y multiplica
 * la superficie por 0,055. Los cráteres están; se ven al cinco por ciento.
 *
 * O sea que lo que gusta no es "sin textura": es CUERPO OSCURO CON FILO
 * LUMINOSO. Y eso no necesita reescribir nada, solo un número.
 *
 * EL PROBLEMA DE PONERLO EN TODOS LOS DÍAS. La cara nocturna hoy es una SEÑAL:
 * significa "hoy descansás". Si todos los días se vieran igual, esa señal se
 * quema. Por eso los días normales no van a 0,055 sino bastante más arriba: se
 * conserva el filo y la forma, la textura queda insinuada, y el descanso sigue
 * siendo el más apagado de los dos.
 *
 * CERO NO ES OSCURO, ES "DE DÍA". `0` apaga la cara nocturna entera y devuelve
 * la iluminación de siempre, que es lo que se venía usando. Se deja para poder
 * comparar los tres tratamientos en la galería sin tocar código.
 */

/** El día de descanso: la cara nocturna de verdad, casi sin superficie. */
export const NOCHE_DESCANSO = 0.055;

/**
 * Un día cualquiera. Provisorio hasta que el humano elija mirando la galería.
 *
 * EL BARRIDO ARRANCÓ MIRANDO PARA EL LADO EQUIVOCADO. Se sacaron 0,20 / 0,30 /
 * 0,40 pensando que el riesgo era que un día normal se pareciera al de
 * descanso. Las fotos mostraron lo contrario: a 0,20 las bandas de Júpiter ya
 * se leen claras, o sea que a 0,20 ya te fuiste del look que se buscaba. El
 * tramo interesante está ABAJO, entre 0,055 y 0,20.
 *
 * LA CONDICIÓN QUE NO SE PUEDE ROMPER, y por eso hay un test: a este número el
 * día normal y el de descanso NO pueden verse idénticos. La señal del descanso
 * la llevan el texto y la tira semanal —el planeta es ambiente, no un
 * semáforo— pero tiene que haber una diferencia perceptible sin leer.
 */
export const NOCHE_DIA = 0.15;

/** Los valores que la galería pone uno al lado del otro. */
export const NIVELES_A_PROBAR = [NOCHE_DESCANSO, 0.1, 0.15, 0.2, 0.3, 0.4] as const;

/**
 * Qué nivel le toca a un día. `suelto` permite forzarlo desde la galería;
 * en la app nunca se pasa.
 */
export function nivelDeNoche(reposo: boolean, suelto?: number): number {
  if (typeof suelto === 'number' && Number.isFinite(suelto) && suelto >= 0) return suelto;
  return reposo ? NOCHE_DESCANSO : NOCHE_DIA;
}

/**
 * ¿Se distinguen dos niveles a simple vista? El ojo no lee el brillo de forma
 * lineal, así que lo que importa es la RAZÓN entre los dos y no la resta: de
 * 0,055 a 0,10 hay casi el doble, y de 0,30 a 0,35 no hay casi nada, aunque la
 * diferencia numérica sea parecida.
 *
 * El umbral de 1,8 sale de esa misma cuenta: menos que eso y son dos grises que
 * hay que poner al lado para notar cuál es cuál, que es justo lo que una señal
 * no puede permitirse.
 */
export const RAZON_MINIMA = 1.8;

export function seDistinguen(a: number, b: number): boolean {
  const bajo = Math.min(a, b);
  const alto = Math.max(a, b);
  if (!(bajo > 0) || !Number.isFinite(alto)) return false;
  return alto / bajo >= RAZON_MINIMA;
}
