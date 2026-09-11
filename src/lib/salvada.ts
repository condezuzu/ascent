/**
 * LA FORMA DE "TE SALVASTE": el objeto se deshace y vuelve a armarse.
 *
 * QUÉ PASA EN PANTALLA. Las partículas del cuerpo celeste se sueltan hacia
 * afuera y la luz baja: eso es la racha viniéndose abajo. Se queda suelto un
 * instante —el momento en que parece perdida— y después algo lo junta de nuevo
 * y da un fulgor cuando la forma se cierra.
 *
 * POR QUÉ ASÍ Y NO UN DESTELLO. El pedido era "que la luna haga algo", y lo
 * que tiene que contar el gesto no es "bien hecho" sino "esto se estaba
 * rompiendo y no se rompió". Un destello dice premio; deshacerse y volver dice
 * rescate. Y es el mismo vocabulario que ya tiene la app: la subida de rango
 * son estas mismas partículas reorganizándose, así que el objeto se deshace
 * como algo que la app ya sabe hacer.
 *
 * LA CURVA VIVE ACÁ, SEPARADA DEL MOTOR, por la misma razón que la del pulso:
 * es una función pura del tiempo, se prueba con números y sin navegador, y es
 * exactamente donde ya me equivoqué una vez. El bucle de animación recibe el
 * tiempo del COMIENZO del cuadro, que puede ser ANTERIOR al `performance.now()`
 * de un instante antes —medido: -3 ms—, así que todas estas funciones tienen
 * que dar el estado de reposo para un tiempo negativo. Si no, el primer cuadro
 * dibuja algo imposible.
 */

/** El objeto se suelta. Rápido: es lo que se lee como "se está rompiendo". */
export const DESARME_MS = 520;
/** Y se queda suelto. Corto, pero tiene que existir: sin pausa no hay susto. */
export const SUELTO_MS = 240;
/** La vuelta es la parte larga: juntarse cuesta más que romperse. */
export const VUELTA_MS = 840;

export const DURACION_MS = DESARME_MS + SUELTO_MS + VUELTA_MS;

/** Cuánto baja la luz con el objeto suelto, en proporción al reposo. */
export const CAIDA = 0.62;
/** Y cuánto sube en el fulgor de cerrarse. */
export const FULGOR = 0.55;

/** Dónde arranca la vuelta. */
const VUELVE_EN = DESARME_MS + SUELTO_MS;

/**
 * Cuánto está desarmado el objeto a los `t` milisegundos, de 0 (entero) a 1
 * (suelto del todo).
 *
 * Vale 0 exacto antes de empezar y después de terminar: el objeto queda como
 * estaba, sin residuo.
 */
export function desarmeEn(t: number): number {
  if (!Number.isFinite(t) || t <= 0) return 0;
  if (t >= DURACION_MS) return 0;
  if (t < DESARME_MS) {
    // Se suelta de golpe y frena: lo contrario de la vuelta.
    const x = t / DESARME_MS;
    return 1 - (1 - x) * (1 - x);
  }
  if (t < VUELVE_EN) return 1;
  // La vuelta: entra fuerte y se acomoda despacio, para que el final no sea
  // un frenazo sino un asentarse.
  const x = (t - VUELVE_EN) / VUELTA_MS;
  return Math.pow(1 - x, 3);
}

/**
 * El brillo a los `t` milisegundos, donde 1 es el reposo. Baja mientras está
 * suelto y pasa de 1 en el fulgor.
 *
 * El fulgor va al FINAL de la vuelta y no al principio: tiene que coincidir
 * con el momento en que la forma se cierra, que es lo que se está contando. Y
 * entra y sale por cero —es media campana— para que no haya escalón ni al
 * empezar ni al terminar.
 */
export function brilloEn(t: number): number {
  if (!Number.isFinite(t) || t <= 0) return 1;
  if (t >= DURACION_MS) return 1;
  let b = 1 - CAIDA * desarmeEn(t);
  if (t > VUELVE_EN) {
    const x = (t - VUELVE_EN) / VUELTA_MS;
    if (x > 0.55) b += FULGOR * Math.sin(((x - 0.55) / 0.45) * Math.PI);
  }
  return b;
}

/**
 * Si todavía queda animación por dibujar. Se pregunta por el TIEMPO y no por
 * el desarme: el desarme vale 0 en el primer cuadro Y en el último, así que
 * usarlo como condición confunde el arranque con el final. Ese fue el bug del
 * pulso y no se repite.
 */
export function sigueSalvando(t: number): boolean {
  return t < DURACION_MS;
}

/**
 * HACIA DÓNDE SE SUELTA CADA PARTÍCULA, una sola vez al empezar.
 *
 * CADA UNA SALE POR SU PROPIO RADIO, y eso es todo el gesto. La primera
 * versión las mandaba en direcciones al azar y se veía mal por una razón que
 * solo se entiende mirándola: una nube que se agita en todas las direcciones se
 * lee como la MISMA nube un poco más grande. Lo que dice "esto se está
 * rompiendo" es que el centro SE VACÍE. Saliendo por donde estaba, la esfera se
 * convierte en una cáscara rota.
 *
 * ESTÁ ACÁ Y NO EN EL MOTOR porque es aritmética, y la aritmética es la parte
 * que se puede equivocar sin que se note. Y esta vez no es una frase: el
 * navegador sin cabeza corre `requestAnimationFrame` a UN cuadro por segundo
 * —medido: 3 cuadros en 3641 ms—, así que ninguna captura de pantalla puede
 * ver esta animación. Si la cuenta no se prueba con números, no se prueba.
 *
 * `azar` se inyecta para poder probarla; en la app es `Math.random`.
 */
export function dispersionDesde(base: Float32Array, azar: () => number = Math.random): Float32Array {
  const fuera = new Float32Array(base.length);
  for (let i = 0; i < base.length; i += 3) {
    const x = base[i];
    const y = base[i + 1];
    const z = base[i + 2];
    // Una partícula justo en el centro no tiene "su" dirección: se la manda
    // para arriba en vez de dividir por cero.
    const r = Math.hypot(x, y, z);
    const ux = r === 0 ? 0 : x / r;
    const uy = r === 0 ? 1 : y / r;
    const uz = r === 0 ? 0 : z / r;
    // Distancias muy repartidas: unas pocas se van lejos y el resto se abre
    // apenas. Todas iguales sería una explosión de dibujo animado.
    const d = 0.3 + Math.pow(azar(), 1.6) * 1.25;
    fuera[i] = ux * d;
    fuera[i + 1] = uy * d * 0.85;
    fuera[i + 2] = uz * d * 0.4;
  }
  return fuera;
}

/**
 * Dónde está cada partícula a los `t` milisegundos. Escribe en `destino` en
 * vez de devolver un arreglo nuevo: esto corre sesenta veces por segundo y
 * reservar memoria en cada cuadro es exactamente lo que hace tironear una
 * animación.
 *
 * En reposo copia `base` EXACTO y no `base + fuera * 0`: multiplicar por cero
 * deja ceros negativos y pizcas de error de coma flotante, y el objeto quedaría
 * para siempre un poquito distinto de como empezó.
 */
export function posicionesEn(
  base: Float32Array,
  fuera: Float32Array,
  t: number,
  destino: Float32Array
): void {
  const d = desarmeEn(t);
  if (d === 0) {
    destino.set(base);
    return;
  }
  for (let i = 0; i < base.length; i++) destino[i] = base[i] + fuera[i] * d;
}
