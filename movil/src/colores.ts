/**
 * LOS COLORES DE LA APP NATIVA, con nombre.
 *
 * Mientras eran dos pantallas, los hex sueltos alcanzaban. Con el bloque son
 * cinco componentes más, y un gris escrito a mano en cada uno es un gris que
 * se desparrama en cinco tonos parecidos. Son los mismos papeles que las
 * variables de la web (`--tinta`, `--sub`, `--apagado`, `--linea`…).
 *
 * TODAVÍA NO SIGUE EL RANGO: la paleta por rango que tiñe la web entra con el
 * motor. Hasta entonces, la del primero.
 */
export const C = {
  fondo: '#05060a',
  hoja: '#0b0d13',
  tinta: '#e8ecf6',
  sub: '#8a93a8',
  apagado: '#4a5163',
  linea: '#1d2230',
  lineaFuerte: '#2a3040',
  principal: '#7e8ca8',
  claro: '#c4c2ba',
  error: '#e8705f',
};

/**
 * Un color de la paleta con transparencia. Los colores vienen en hex y React
 * Native no tiene `color-mix`: esto es el `color-mix(in srgb, X N%,
 * transparent)` de la web. Estaba copiado en cuatro archivos (18/9).
 */
export function conAlfa(hex: string, alfa: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}
