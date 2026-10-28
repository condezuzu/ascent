import { restarDias } from './fechas.ts';
import { descansosVigentes, type ConfigDescanso } from './reglas.ts';

/** Un renglón de `rutina_semanas` (migración 97): desde cuándo vale y qué días entrena; null es sin rutina. */
export type SemanaDeRutina = { desde: string; entrena: number[] | null };

/**
 * LOS DÍAS FALTADOS (26/10; desde el 28/10, desde que se empezó a usar la app y siempre a la
 * vista en Stats). Los días desde \`desde\` hasta ayer en que tocaba entrenar y no hay día
 * registrado. Qué tocaba lo dice la rutina vigente ese día; sin rutina guardada, los días de
 * descanso de Ajustes (las configuraciones fechadas, las mismas de la racha). Un día salvado con
 * una vida cuenta: no se fue. Hoy no, que todavía se puede.
 */
export function diasFaltados(
  semanas: SemanaDeRutina[],
  descansos: ConfigDescanso[],
  registrados: ReadonlySet<string>,
  desde: string,
  hoy: string,
): number {
  const orden = [...semanas].sort((a, b) => (a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0));
  let n = 0;
  let i = -1;
  for (let f = desde; f < hoy; f = restarDias(f, -1)) {
    while (i + 1 < orden.length && orden[i + 1].desde <= f) i++;
    if (registrados.has(f)) continue;
    // El día de la semana de la fecha, sin pasar por el huso del teléfono.
    const [y, m, d] = f.split('-').map(Number);
    const dia = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const entrena = i >= 0 ? orden[i].entrena : null;
    if (entrena ? entrena.includes(dia) : !descansosVigentes(descansos, f).includes(dia)) n++;
  }
  return n;
}
