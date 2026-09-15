import { deISO } from './fechas.ts';
import { descansosVigentes } from './reglas.ts';

// Qué configuración rige en una fecha es la misma cuenta que hace la base
// (`descansos_vigentes`), así que vive en `reglas.ts` y el test compara las
// dos. Acá queda lo que solo sabe el cliente: qué día de la semana es.
export { descansosVigentes, type ConfigDescanso } from './reglas.ts';
import type { ConfigDescanso } from './reglas.ts';

export function esDiaDeDescanso(configs: ConfigDescanso[], fecha: string): boolean {
  return descansosVigentes(configs, fecha).includes(deISO(fecha).getDay());
}
