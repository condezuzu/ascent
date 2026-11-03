/**
 * CUÁNDO SE APLICA UNA OTA YA BAJADA (3/11): al volver a la app, no al irse.
 *
 * Del 21/10 al 3/11 se aplicaba al pasar al fondo. Se cambió creyendo que por eso fallaban al arrancar
 * las OTA de la 1.1.0 (10), y la causa resultó otra: salían sin la configuración de Supabase (ver
 * `revisarPaquete` en `supabase/huella.mjs`). Quedó al volver, lo aprobado: la nueva arranca con la
 * entrada delante de quien vuelve.
 *
 * Irse es pasar por `background`. `inactive` solo (el centro de control, una llamada que se rechaza) no
 * cuenta: reiniciar ahí sería hacerlo delante de quien la estaba usando.
 */
export function alCambiarDeEstado(salio: boolean, estado: string): { salio: boolean; aplicar: boolean } {
  if (estado === 'background') return { salio: true, aplicar: false };
  if (estado === 'active' && salio) return { salio: false, aplicar: true };
  return { salio, aplicar: false };
}
