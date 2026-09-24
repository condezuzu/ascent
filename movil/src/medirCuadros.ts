import { anotar } from '@compartido/bitacora';

/**
 * CUÁNTOS CUADROS POR SEGUNDO, EN EL TELÉFONO DE VERDAD.
 *
 * POR QUÉ ACÁ Y NO EN UN SCRIPT. Los medidores que ya hay (`medir-lag.mjs` y
 * compañía) corren Chromium con la CPU frenada, y lo dicen ellos mismos: son un
 * PISO, no una medición. Un iPhone tiene otra GPU, otra memoria y térmica, y
 * además dos de los tres tirones que se pidió revisar —deslizar entre pestañas
 * y el globo de la medalla— solo existen en la app nativa, que esos scripts no
 * abren. Lo único que puede contestar la pregunta es el aparato.
 *
 * QUÉ MIDE, Y QUÉ NO. Esto es un bucle de `requestAnimationFrame`, así que
 * mide **el hilo de JavaScript**: cada hueco largo entre cuadros es JS que
 * tardó. Es justo lo que hace falta acá —el deslizamiento entre pestañas lo
 * mueve un `PanResponder`, que es JS— pero conviene saber lo que NO ve: una
 * animación con `useNativeDriver` corre del lado nativo y puede ir perfecta
 * con este bucle trabado, o al revés. O sea que un número feo acá es un
 * problema de verdad; uno lindo no garantiza que se vea bien.
 *
 * EL PROMEDIO NO ALCANZA y por eso no se guarda solo. Un segundo trabado
 * repartido entre veinte buenos da un promedio de 55 y se ve horrible: lo que
 * se siente es EL PEOR CUADRO y cuántos se pasaron del presupuesto. Los tres
 * números van juntos.
 *
 * Y NI ASÍ ALCANZA: TAMBIÉN HACE FALTA CUÁNDO (26/9). La primera medición en
 * el teléfono dio 57,3 cuadros por segundo, 16 largos (1,4 %) y el peor de 104
 * ms, y con eso no se puede decidir nada: dieciséis largos repartidos parejo
 * en veinte segundos serían algo que pasa todo el tiempo y hay que arreglar;
 * los mismos dieciséis amontonados en los dos primeros son el arranque —salir
 * de Ajustes, Inicio pidiendo sus datos— y no hay nada que arreglar.
 *
 * Son los mismos tres números. Lo único que cambia es que ahora se anota el
 * SEGUNDO en que cayó cada largo, y cuántos fueron mientras la medición todavía
 * se estaba acomodando.
 *
 * SE ANOTA EN LA BITÁCORA, que es lo que ya se puede compartir desde
 * Diagnóstico: medir en el gimnasio y leer el número en casa es el mismo
 * problema que resolvió el resto de esa pantalla.
 */

/** 60 Hz. Un cuadro que pasa de acá ya no llegó a tiempo. */
const PRESUPUESTO_MS = 1000 / 60;

/**
 * Un cuadro "largo": más del doble del presupuesto. No se cuenta desde 16,7
 * porque a 60 Hz el reloj tiembla solo y contaría ruido; 33 ms es un cuadro
 * perdido de verdad, que a la vista es un tirón.
 */
const LARGO_MS = PRESUPUESTO_MS * 2;

/**
 * Los primeros segundos de una medición son el arranque, no la app: se apretó
 * un botón, se cerró Ajustes, la pantalla de abajo volvió a pedir sus datos.
 * No se descartan —esconder cuadros es la forma más fácil de mentir con una
 * medición— pero se cuentan aparte.
 */
const ARRANQUE_S = 3;

export type Medicion = {
  /** Cuántos cuadros se vieron. */
  cuadros: number;
  /** Cuánto duró la medición, en milisegundos. */
  ms: number;
  /** Cuadros por segundo, promedio. */
  fps: number;
  /** El hueco más largo entre dos cuadros. Es lo que se siente. */
  peor: number;
  /** Cuántos cuadros tardaron más del doble del presupuesto. */
  largos: number;
  /** Qué porcentaje del total son esos. */
  porcentajeLargos: number;
  /** En qué segundo cayó cada largo, para saber si son el arranque o no. */
  cuando: number[];
  /** Cuántos de esos largos fueron en los primeros `ARRANQUE_S` segundos. */
  enElArranque: number;
};

let corriendo = false;

/** ¿Hay una medición andando? Para que el botón no arranque dos. */
export function midiendo(): boolean {
  return corriendo;
}

/**
 * Mide durante `segundos` y deja el resultado en la bitácora.
 *
 * NO DIBUJA NADA MIENTRAS MIDE, a propósito: un contador en pantalla sería un
 * `setState` por cuadro, o sea el medidor midiéndose a sí mismo.
 *
 * Devuelve la medición por si quien llama la quiere mostrar al final.
 */
export function medirCuadros(segundos = 20, comoSeLlama = 'cuadros'): Promise<Medicion | null> {
  if (corriendo) return Promise.resolve(null);
  corriendo = true;

  return new Promise((listo) => {
    const arranque = Date.now();
    let anterior = arranque;
    let cuadros = 0;
    let peor = 0;
    let largos = 0;
    const cuando: number[] = [];

    const paso = () => {
      const ahora = Date.now();
      const hueco = ahora - anterior;
      anterior = ahora;
      // EL PRIMER CUADRO NO CUENTA: su hueco incluye todo lo que pasó entre
      // apretar el botón y que el bucle arranque, que no es un cuadro lento.
      if (cuadros > 0) {
        if (hueco > peor) peor = hueco;
        if (hueco > LARGO_MS) {
          largos++;
          // Con un decimal alcanza y el renglón de la bitácora entra: lo que
          // se mira es si están todos juntos al principio o repartidos.
          cuando.push(Math.round(((ahora - arranque) / 1000) * 10) / 10);
        }
      }
      cuadros++;

      const ms = ahora - arranque;
      if (ms < segundos * 1000) {
        requestAnimationFrame(paso);
        return;
      }

      corriendo = false;
      const enElArranque = cuando.filter((s) => s <= ARRANQUE_S).length;
      const medicion: Medicion = {
        cuadros,
        ms,
        fps: Math.round((cuadros / ms) * 1000 * 10) / 10,
        peor,
        largos,
        porcentajeLargos: cuadros > 1 ? Math.round((largos / (cuadros - 1)) * 1000) / 10 : 0,
        cuando,
        enElArranque,
      };
      void anotar(comoSeLlama, {
        fps: medicion.fps,
        peor: `${medicion.peor} ms`,
        largos: `${medicion.largos} (${medicion.porcentajeLargos}%)`,
        // LOS PRIMEROS DOCE Y NO TODOS: es un renglón de una bitácora que se
        // lee en un teléfono, y doce ya dicen si están amontonados o no.
        cuando: cuando.slice(0, 12).join(' ') + (cuando.length > 12 ? ' …' : ''),
        enElArranque: `${enElArranque} de ${largos} en los primeros ${ARRANQUE_S} s`,
        cuadros: medicion.cuadros,
        segundos: Math.round(ms / 100) / 10,
      });
      listo(medicion);
    };

    requestAnimationFrame(paso);
  });
}
