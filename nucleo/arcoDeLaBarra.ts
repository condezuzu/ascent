/** Cuánto sube el arco de la barra en el medio, por encima de su borde de arriba. */
export const SUBE_EL_ARCO = 22;

/** Dónde pasa el arco en `x`, contado desde su punto más alto. La misma curva que dibuja la línea. */
export function alturaDelArco(x: number, ancho: number) {
  const d = (x - ancho / 2) / (ancho / 2);
  return SUBE_EL_ARCO * d * d;
}

/** El arco como camino de SVG, con el punto más alto en `y = 1`. */
export function caminoDelArco(ancho: number) {
  return `M0 ${SUBE_EL_ARCO + 1} Q${ancho / 2} ${1 - SUBE_EL_ARCO} ${ancho} ${SUBE_EL_ARCO + 1}`;
}

/**
 * LO DE ABAJO DEL ARCO, EN COLUMNAS (5/11). Columnas que bajan desde el arco hasta abajo, una al lado de la
 * otra sin encimarse: todo lo de abajo del arco queda desenfocado parejo. Recortado por un círculo enorme el
 * teléfono se reiniciaba (ver trampas), y en franjas de 2 pt de alto casi no desenfocaba: se veía un
 * rectángulo. Son anchas en el medio, donde el arco es casi plano, y angostas en las puntas: en cada una el
 * arco baja `paso` como mucho, y su tope va a la altura del arco en su mitad. `top` se cuenta desde el borde de
 * arriba de la barra, donde terminan las puntas del arco.
 */
export function columnasDelArco(ancho: number, paso = 1.5) {
  const medio = ancho / 2;
  const n = Math.ceil(SUBE_EL_ARCO / paso);
  // Desde el centro, dónde el arco ya bajó k·paso.
  const bajo = (k: number) => Math.min(SUBE_EL_ARCO, k * paso);
  const bordes = Array.from({ length: n + 1 }, (_, k) => medio * Math.sqrt(bajo(k) / SUBE_EL_ARCO));
  // El tope, al medio de lo que baja el arco en esa columna: se aparta de él medio paso como mucho, para los dos lados.
  const tope = (k: number) => (bajo(k) + bajo(k + 1)) / 2 - SUBE_EL_ARCO;
  const columnas: { left: number; ancho: number; top: number }[] = [];
  for (let k = n - 1; k >= 1; k--) columnas.push({ left: medio - bordes[k + 1], ancho: bordes[k + 1] - bordes[k], top: tope(k) });
  // La del medio: el arco va de 0 en el centro a `paso` en sus bordes.
  columnas.push({ left: medio - bordes[1], ancho: 2 * bordes[1], top: bajo(1) / 2 - SUBE_EL_ARCO });
  for (let k = 1; k < n; k++) columnas.push({ left: medio + bordes[k], ancho: bordes[k + 1] - bordes[k], top: tope(k) });
  return columnas;
}
