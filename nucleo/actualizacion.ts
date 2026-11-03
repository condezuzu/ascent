/**
 * CUÁNDO SE APLICA UNA OTA YA BAJADA (3/11): al volver a la app, no al irse.
 *
 * Del 21/10 al 3/11 se aplicaba al pasar al fondo, y en la 1.1.0 (10) las OTA fallaban al arrancar:
 * recargada en el fondo, la app no llega a dibujar nada, y expo-updates lo cuenta como un arranque que
 * falló. Vuelve a lo anterior y no reintenta esa OTA nunca. Es lo que mejor encaja con `update:insights`;
 * el error real no se pudo leer.
 *
 * Irse es pasar por `background`. `inactive` solo (el centro de control, una llamada que se rechaza) no
 * cuenta: reiniciar ahí sería hacerlo delante de quien la estaba usando.
 */
export function alCambiarDeEstado(salio: boolean, estado: string): { salio: boolean; aplicar: boolean } {
  if (estado === 'background') return { salio: true, aplicar: false };
  if (estado === 'active' && salio) return { salio: false, aplicar: true };
  return { salio, aplicar: false };
}
