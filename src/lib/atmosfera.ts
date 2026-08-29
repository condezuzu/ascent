import { numeroDeRango } from './reglas.ts';

/**
 * CUÁNTO DEL FONDO SE TE DEJA VER, Y CUÁNDO SE INSINÚA LO QUE VIENE.
 *
 * El motor nunca estuvo escondido por lento —el import son 1 ms y montar la
 * escena 24— sino por una constante: el velo de Inicio era 0.55 el primer día
 * y 0.55 el día ochenta. Había un render abajo y nadie lo veía cambiar.
 *
 * Acá el velo pasa a depender del rango: **cuanto más alto, más se abre la
 * app**. No es decoración. Es la única forma de contestar "nadie se entera de
 * que hay rangos" SIN romper la regla de que el rango no se nombra (§7): no se
 * dice nada, se muestra más. Y como se abre de a poco a lo largo de meses, lo
 * que se percibe no es un cambio de estilo sino que el lugar se volvió más
 * grande.
 *
 * Y VA EN LOS DOS SENTIDOS. Si perdés la racha y bajás de rango, el velo se
 * vuelve a cerrar. Duele más que ver bajar un número, y es lo coherente con
 * §11: el sistema se dispersa, no explota. Por eso la caída es más lenta que
 * la subida —siete segundos contra dos y medio— y nunca un corte: cortar
 * sería un error de dibujo, cerrarse despacio es una consecuencia.
 *
 * LA LEGIBILIDAD NO SE NEGOCIA. Que el velo global suba no puede hacer que un
 * texto se lea peor. Por eso cada bloque de texto lleva su propio fondito
 * local en CSS (`.sobre-fondo`), constante en todos los rangos: lo que se abre
 * es el aire vacío entre los bloques, nunca lo que hay debajo de una palabra.
 *
 * NO IMPORTA NADA salvo `reglas.ts`, igual que `llegada.ts`: así `test:db` lo
 * carga con node pelado y prueba las cuentas de verdad.
 */

// El velo del primer rango y el del último. La distancia entre los dos es
// TODO el recorrido visible de la escalera, así que el número de abajo no es
// arbitrario: con menos de ~0.18 de diferencia el cambio no se percibe, y con
// más de ~0.25 los rangos brillantes (Sol, agujero negro) lastiman de noche.
const VELO_PISO = 0.58; // rango 1
const VELO_TECHO = 0.38; // rango 8

/** Cuánto velo le toca a un rango. Entre VELO_PISO y VELO_TECHO, lineal. */
export function veloDeRango(rango: number): number {
  const n = Math.min(8, Math.max(1, Math.round(rango)));
  const t = (n - 1) / 7;
  return Number((VELO_PISO + (VELO_TECHO - VELO_PISO) * t).toFixed(3));
}

/**
 * Cuánto tarda el velo en moverse.
 *
 * Asimétrico a propósito. Subir llega y se asienta; bajar es un cierre, y un
 * cierre rápido se lee como un error de la app en vez de como una pérdida.
 */
export const MS_ABRIR = 2600;
export const MS_CERRAR = 7000;

/**
 * Cuánto dura el viaje del velo. Recibe RANGOS, no velos, a propósito: en
 * velos "subir" es que el número BAJE —más rango, menos velo— y esa
 * inversión es una invitación a poner el signo al revés sin que nadie lo note,
 * porque el error se vería solo como una animación con la duración del otro
 * caso.
 */
export function msDeTransicion(rangoAntes: number, rangoAhora: number): number {
  return rangoAhora > rangoAntes ? MS_ABRIR : MS_CERRAR;
}

// -------------------------------------------------------------------
// EL PRESAGIO — "hay algo adelante" sin decir qué
// -------------------------------------------------------------------

/**
 * Días antes de subir en que se insinúa lo que viene.
 *
 * Tres y no diez: si estuviera siempre, dejaría de ser un aviso y pasaría a
 * ser parte del decorado. Apareciendo solo al final marca DOS cosas con un
 * solo elemento —que hay algo más adelante, y que estás cerca— sin decir ni
 * qué es ni cuántos días faltan.
 */
export const DIAS_DE_PRESAGIO = 3;

/** Cuántos días de racha faltan para el rango siguiente. `null` en el último. */
export function faltanParaSubir(racha: number): number | null {
  const n = numeroDeRango(racha);
  if (n >= 8) return null; // no hay nada después del agujero negro
  return n * 10 - Math.max(0, racha);
}

/**
 * Si corresponde mostrar el presagio.
 *
 * IMPORTANTE PARA QUIEN LO DIBUJE: el presagio NO PUEDE TENER FORMA. Mostrar
 * el objeto del rango que viene sería decir cuál es, que es exactamente lo que
 * §7 prohíbe y lo que arruina el juego. Es una presencia sin resolver: más
 * grande, detrás, sin contorno.
 */
export function hayPresagio(racha: number): boolean {
  const faltan = faltanParaSubir(racha);
  return faltan !== null && faltan > 0 && faltan <= DIAS_DE_PRESAGIO;
}
