import { T } from './textos.ts';

/**
 * Lo que devuelve `registrar_dia` cuando la guarda de las 20 horas frena el
 * registro por un cambio de zona horaria (§12b).
 */
export type Bloqueo = { bloqueado: true; pendiente: string; hasta: string };

export function estaBloqueado(r: unknown): r is Bloqueo {
  return !!r && typeof r === 'object' && (r as { bloqueado?: boolean }).bloqueado === true;
}

/**
 * El mensaje que ve el usuario. Tiene que decir dos cosas y las dos importan:
 * **que el día no se perdió** y **cuándo entra**.
 *
 * Un rechazo sin explicación se lee como que la app está rota, y encima justo
 * cuando lo que está en juego es la racha, que es lo único que no se perdona
 * (§11). "No se pudo registrar" sería exactamente eso.
 */
export function textoDeBloqueo(hasta: string): string {
  const cuando = new Date(hasta);
  const faltan = Math.max(0, Math.round((cuando.getTime() - Date.now()) / 60000));
  const hora = cuando.toLocaleTimeString(T.general.locale, { hour: '2-digit', minute: '2-digit' });

  if (faltan > 60 * 20) {
    // desfasaje raro de reloj: mejor no prometer una hora que no se entiende
    return T.bloqueo.sinHora;
  }
  if (faltan > 90) {
    return T.bloqueo.aLaHora(hora);
  }
  return T.bloqueo.enMinutos(faltan);
}
