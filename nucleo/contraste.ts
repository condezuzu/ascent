/**
 * CONTRASTE ENTRE DOS COLORES, con la fórmula de WCAG 2 (18/10). La usa el botón «Fui,
 * corregí el día» del aviso de la vida: su fondo es el `principal` del rango, que va del
 * violeta oscuro al amarillo, y ningún color de texto fijo se lee en todos.
 */

function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** De 1 (iguales) a 21 (negro y blanco). Colores en `#rrggbb`. */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** De los colores de texto posibles, el que más contrasta con ese fondo. */
export function textoSobre(fondo: string, opciones: readonly string[]): string {
  return opciones.reduce((mejor, c) => (contraste(c, fondo) > contraste(mejor, fondo) ? c : mejor));
}
