/** Cuánto sube el arco de la barra en el medio, por encima de su borde de arriba. */
export const SUBE_EL_ARCO = 22;

/** Dónde pasa el arco en `x`, contado desde su punto más alto. La misma curva que dibuja la línea. */
export function alturaDelArco(x: number, ancho: number) {
  const d = (x - ancho / 2) / (ancho / 2);
  return SUBE_EL_ARCO * d * d;
}

/** El radio del círculo cuyo borde es ese arco: es lo que recorta lo borroso. */
export function radioDelArco(ancho: number) {
  return (ancho * ancho) / 4 / (2 * SUBE_EL_ARCO) + SUBE_EL_ARCO / 2;
}
