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
 *
 * PISO DE 4,5:1 (30/10): todo lo que se lee llega ahí sobre el fondo y sobre la hoja, y lo
 * pinea la sección 321 de test:db. Lo que no se lee, y va atrás a propósito, es `tenue`.
 */
export const C = {
  fondo: '#05060a',
  hoja: '#0b0d13',
  tinta: '#e8ecf6',
  sub: '#aab2c4',
  apagado: '#9098ab',
  tenue: '#4a5163',
  // El texto que se apoya directo sobre el motor, sin caja: con `HALO`.
  sobreMotor: '#c2c9d8',
  // Lo que Inicio deja leer con el planeta detrás, en reposo. El anillo del agujero negro pasa de
  // 150 en cada canal: el velo a la mitad no alcanza, y entero taparía el planeta.
  placa: 'rgba(5, 6, 10, 0.66)',
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

/** Un botón que no se puede tocar. Más bajo y su texto pierde el piso de 4,5:1. */
export const DESHABILITADO = 0.7;

/** Lo que separa un texto del motor cuando el planeta le pasa por detrás. */
export const HALO = {
  textShadowColor: 'rgba(5, 6, 10, 0.95)',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 7,
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
