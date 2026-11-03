/** Cuánto sube el arco de la barra en el medio, por encima de su borde de arriba. */
export const SUBE_EL_ARCO = 22;

/** Dónde pasa el arco en `x`, contado desde su punto más alto. La misma curva que dibuja la línea. */
export function alturaDelArco(x: number, ancho: number) {
  const d = (x - ancho / 2) / (ancho / 2);
  return SUBE_EL_ARCO * d * d;
}

/** El arco como camino de SVG, con el punto más alto en `y = 1`: la línea y lo oscuro de abajo son el mismo. */
export function caminoDelArco(ancho: number) {
  return `M0 ${SUBE_EL_ARCO + 1} Q${ancho / 2} ${1 - SUBE_EL_ARCO} ${ancho} ${SUBE_EL_ARCO + 1}`;
}
