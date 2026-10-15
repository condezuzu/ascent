/**
 * CUÁNTO SE DESENFOCA EL FONDO, de 0 a 1.
 *
 * ─────────────────────────────────────────────────────────────────────
 * DE DÓNDE SALE (25/9)
 *
 * *"Hoy al volver a Inicio el planeta aparece de la nada. Quiero que el planeta
 * esté SIEMPRE, y que en las otras pestañas se vea borroso. Que el desenfoque
 * baje gradualmente mientras deslizo hacia Inicio, siguiendo el dedo."*
 *
 * Las dos mitades del pedido son la misma cosa. El planeta "aparecía de la
 * nada" porque en las otras cuatro pestañas NO EXISTÍA: pedían `soloEstrellas`,
 * o sea cielo sin cuerpo, y eso es otra escena —otra clave, otro montaje—. Al
 * volver a Inicio había que construirlo de nuevo, y construirlo es lo que se
 * veía. Con el cuerpo siempre puesto no hay nada que construir: lo único que
 * cambia es cuánto se lo ve.
 *
 * ─────────────────────────────────────────────────────────────────────
 * POR QUÉ UN MÓDULO SUELTO Y NO UN CONTEXTO
 *
 * El que sabe cuánto se movió el dedo es `Pestanas`; el que dibuja el fondo es
 * `FondoRaiz`, que vive DOS NIVELES MÁS ARRIBA, detrás del stack entero. No hay
 * un padre común al que subirle el estado sin volver a dibujar la app entera en
 * cada cuadro del gesto — que es exactamente lo que este archivo evita. Es el
 * mismo patrón que `pedidoDeFondo.ts`, y por el mismo motivo.
 *
 * ─────────────────────────────────────────────────────────────────────
 * SE AVISA EN PASOS ENTEROS, NO EN CADA PÍXEL
 *
 * Un gesto manda sesenta eventos por segundo. Avisar en cada uno sería un
 * `setState` por cuadro en la raíz de la app, y el desenfoque se dibuja en
 * píxeles enteros igual: de 0 a 1 hay `PASOS` valores distintos y ninguno más.
 * Así el gesto entero cuesta una docena de dibujos en vez de doscientos.
 */

/** En cuántos escalones se parte el camino. Uno por píxel de desenfoque. */
const PASOS = 14;

let nivel = 0;
const oyentes = new Set<(n: number) => void>();

/** Redondeado al escalón: es lo único que se puede ver. */
function escalonar(n: number): number {
  const acotado = Math.min(1, Math.max(0, n));
  return Math.round(acotado * PASOS) / PASOS;
}

export function ponerDesenfoque(n: number) {
  const nuevo = escalonar(n);
  if (nuevo === nivel) return;
  nivel = nuevo;
  for (const fn of [...oyentes]) fn(nivel);
}

export function escucharDesenfoque(fn: (n: number) => void): () => void {
  oyentes.add(fn);
  fn(nivel);
  return () => {
    oyentes.delete(fn);
  };
}

// ─────────────────────────────────────────────────────────────────────
// LO QUE TAPA TODO (15/10)
//
// Una pantalla opaca encima —el descanso, la subida de rango— no deja ver el
// fondo, y el motor seguía dibujando detrás: medido en el sustituto del
// teléfono, era casi todo el trabajo de la app durante un descanso. Mientras
// alguna esté abierta, el fondo se pausa. Cada una se anota con su propio
// símbolo: dos encima no se pisan al cerrarse.
const tapan = new Set<symbol>();
const oyentesDeTapa = new Set<(si: boolean) => void>();

export function taparElFondo(quien: symbol, si: boolean) {
  const antes = tapan.size > 0;
  if (si) tapan.add(quien);
  else tapan.delete(quien);
  const ahora = tapan.size > 0;
  if (ahora !== antes) for (const fn of [...oyentesDeTapa]) fn(ahora);
}

export function escucharTapa(fn: (si: boolean) => void): () => void {
  oyentesDeTapa.add(fn);
  fn(tapan.size > 0);
  return () => {
    oyentesDeTapa.delete(fn);
  };
}
