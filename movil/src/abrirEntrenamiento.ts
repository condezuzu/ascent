import { eventos } from '@compartido/eventos';

/**
 * ABRIR STATS EN ENTRENAMIENTO, donde vive la rutina (16/10). Lo pide la fila "Hoy"
 * de Inicio. Con marca de tiempo además del evento: si Stats todavía no se montó
 * (las pestañas se montan al primer uso), lo lee al montarse.
 */
export const ABRIR_ENTRENAMIENTO = 'ascent:abrir-entrenamiento';

let pedidoEn = 0;

export function pedirEntrenamiento() {
  pedidoEn = Date.now();
  eventos.emitir(ABRIR_ENTRENAMIENTO);
}

/** ¿Se pidió hace un momento? Se consume al leerlo. */
export function seAcabaDePedir(): boolean {
  const si = Date.now() - pedidoEn < 3000;
  pedidoEn = 0;
  return si;
}
