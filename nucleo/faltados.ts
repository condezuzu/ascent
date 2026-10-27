import { restarDias } from './fechas.ts';

/** Un renglón de `rutina_semanas` (migración 97): desde cuándo vale y qué días entrena; null es sin rutina. */
export type SemanaDeRutina = { desde: string; entrena: number[] | null };

/**
 * LOS DÍAS FALTADOS DEL AÑO (26/10, en Stats, donde estaba el ✓ de «Vidas al máximo»): los
 * días de este año, hasta ayer, que la rutina vigente ese día decía de entrenar y no tienen
 * día registrado. Los de descanso de la rutina no cuentan, y tampoco los días sin rutina
 * guardada. Un día salvado con una vida sí cuenta: no se fue. Hoy no, que todavía se puede.
 */
export function diasFaltados(semanas: SemanaDeRutina[], registrados: ReadonlySet<string>, hoy: string): number {
  const orden = [...semanas].sort((a, b) => (a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0));
  let n = 0;
  let i = -1;
  for (let f = `${hoy.slice(0, 4)}-01-01`; f < hoy; f = restarDias(f, -1)) {
    while (i + 1 < orden.length && orden[i + 1].desde <= f) i++;
    const entrena = i >= 0 ? orden[i].entrena : null;
    // El día de la semana de la fecha, sin pasar por el huso del teléfono.
    const [y, m, d] = f.split('-').map(Number);
    if (entrena?.includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay()) && !registrados.has(f)) n++;
  }
  return n;
}
