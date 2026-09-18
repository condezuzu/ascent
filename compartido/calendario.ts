import type { Cliente } from '@cliente';
import { aISO, enDias } from '@nucleo/fechas';
import { esDiaDeDescanso, type ConfigDescanso } from '@nucleo/descansos';
import { T } from '@nucleo/textos';

/**
 * EL CALENDARIO DE STATS, pedido y armado una sola vez para las dos apps.
 *
 * Vivía adentro de `CalendarioDias` de la web; se sacó acá al portar Stats a la
 * app nativa (18/9). Copiado, se separa.
 *
 * Los descansos se muestran con la configuración que regía CADA día, no con
 * la de hoy: si no, un mes viejo se vería con la rutina actual, que es mentira.
 */

export type EstadoDeDia = 'hecho' | 'vacio' | 'descanso' | 'futuro';
export type CeldaDeDia = { fecha: string; dia: number; estado: EstadoDeDia };

export type DatosDelMes = {
  conLog: Set<string>;
  /** Los días marcados a mano como descanso: filas de `logs` con `es_descanso`. */
  descansoAMano: Set<string>;
  configs: ConfigDescanso[];
};

export async function cargarMes(supabase: Cliente, uid: string, anio: number, mes: number): Promise<DatosDelMes> {
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const desde = aISO(new Date(anio, mes, 1));
  const hasta = aISO(new Date(anio, mes, diasEnMes));
  const [{ data }, { data: cfgs }] = await Promise.all([
    supabase.from('logs').select('fecha, es_descanso').eq('user_id', uid).gte('fecha', desde).lte('fecha', hasta),
    supabase.from('descansos').select('desde, dias').order('desde', { ascending: false }),
  ]);
  return {
    conLog: new Set((data ?? []).filter((l) => !l.es_descanso).map((l) => l.fecha as string)),
    descansoAMano: new Set((data ?? []).filter((l) => l.es_descanso).map((l) => l.fecha as string)),
    configs: (cfgs ?? []) as ConfigDescanso[],
  };
}

/** Las celdas del mes, cada una con su estado. */
export function celdasDelMes(anio: number, mes: number, hoy: string, datos: DatosDelMes): CeldaDeDia[] {
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const celdas: CeldaDeDia[] = [];
  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = aISO(new Date(anio, mes, d));
    let estado: EstadoDeDia;
    if (fecha > hoy) estado = 'futuro';
    else if (datos.conLog.has(fecha)) estado = 'hecho';
    else if (datos.descansoAMano.has(fecha) || esDiaDeDescanso(datos.configs, fecha)) estado = 'descanso';
    else estado = 'vacio';
    celdas.push({ fecha, dia: d, estado });
  }
  return celdas;
}

/**
 * El mes al que se pasa con `delta`, o `null` si todavía no pasó: no tiene
 * sentido navegar a meses que todavía no existen.
 */
export function moverMes(anio: number, mes: number, delta: number, hoy: string) {
  const d = new Date(anio, mes + delta, 1);
  if (aISO(d) > hoy) return null;
  return { anio: d.getFullYear(), mes: d.getMonth() };
}

/**
 * Recalcula la racha desde cero. El RPC recalcula y aplica la pérdida en la
 * misma transacción: el número que se muestra es el final, no rebota al
 * recargar. Devuelve el texto para mostrar y si salió bien.
 */
export async function recalcularRacha(supabase: Cliente): Promise<{ ok: boolean; texto: string }> {
  const { data, error } = await supabase.rpc('recalcular_desde_cero');
  if (error) return { ok: false, texto: T.calendario.recalcularError };
  const r = data as { racha: number; perdida: boolean };
  return {
    ok: true,
    texto: r.perdida ? T.calendario.recalculoCortado(enDias(r.racha)) : T.calendario.recalculoListo(enDias(r.racha)),
  };
}
