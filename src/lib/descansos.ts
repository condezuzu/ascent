import { deISO } from './fechas';

// Configuraciones de descanso fechadas. Cada una rige desde su fecha hasta
// que aparece la siguiente: el pasado se lee con la que estaba vigente
// entonces, nunca con la de hoy.
export type ConfigDescanso = { desde: string; dias: number[] };

/** Las configuraciones tienen que venir ordenadas de más nueva a más vieja. */
export function descansosVigentes(configs: ConfigDescanso[], fecha: string): number[] {
  for (const c of configs) {
    if (c.desde <= fecha) return c.dias;
  }
  return []; // antes de la primera configuración no había descansos
}

export function esDiaDeDescanso(configs: ConfigDescanso[], fecha: string): boolean {
  return descansosVigentes(configs, fecha).includes(deISO(fecha).getDay());
}
