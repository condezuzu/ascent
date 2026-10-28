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
  // El punto de "en vivo": quien está entrenando ahora (Ranking, la entrada).
  vivo: '#5fd08a',
  // EL AVISO DE LA VIDA, CON COLORES FIJOS (19/10): no cambian con el rango.
  // El azul de «Fui. Corregir día»: 8:1 sobre el cuadro.
  link: '#6aa8ff',
  // El borde de «Guardar vida»: 3,6:1 sobre el cuadro, para que se lea como botón.
  bordeBoton: '#626b80',
  // El frío del día congelado.
  hielo: '#8fc4f0',
  // El corazón dado, en la foto abierta: el número va en `fondo` encima, a más de 4,5:1.
  corazon: '#ef6f7f',
  // La mecha de la invitación que llega (29/10): se quema de oscuro a claro, con la chispa en la punta.
  mechaOscura: '#b8562a',
  mecha: '#e8913a',
  chispaClara: '#ffd38a',
  chispa: '#fff3d6',
  // El reflejo que cruza «Aceptar».
  brillo: '#ffffff',
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
