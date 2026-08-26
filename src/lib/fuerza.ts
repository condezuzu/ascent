import { deKilos, type Unidad } from '@/lib/peso';
import { deISO, MESES } from '@/lib/fechas';
import type { Marca } from '@/lib/tipos';
import { T } from '../textos.ts';

// El 1RM es la otra cuenta que también corre en SQL (`un_rm`): vive en
// `reglas.ts` y el test compara las dos implementaciones.
export { unRM } from '@/lib/reglas';

/**
 * Los tres que entran al DOTS, en el orden en que se dicen. La marca de cuáles
 * son vive en la base (`ejercicios.cuenta_dots`); esto es solo la sigla y el
 * orden para mostrarlos.
 */
export const SIGLA: Record<string, string> = {
  sentadilla: 'SQ',
  press_banca: 'BP',
  peso_muerto: 'DL',
};

/**
 * La línea de la pantalla principal: `SQ 140 · BP 100 · DL 180 kg` (§16.8).
 *
 * Devuelve null si no hay ninguna de las tres, para que al que no usa el
 * módulo la pantalla le quede exactamente como estaba. Con una o dos también
 * se muestra: esconderla hasta tener las tres deja sin nada a quien recién
 * empieza a cargar.
 *
 * La unidad va una sola vez al final y no por número: la línea existe para
 * leerse de un vistazo, y repetir "kg" tres veces la vuelve un párrafo.
 */
export function lineaDeMarcas(marcas: Marca[], unidad: Unidad): string | null {
  const tres = marcas
    .filter((m) => m.cuenta_dots && SIGLA[m.ejercicio])
    .map((m) => `${SIGLA[m.ejercicio]} ${redondear(deKilos(m.kg, unidad))}`);
  if (tres.length === 0) return null;
  return `${tres.join(' · ')} ${unidad}`;
}

/** Sin decimal cuando no hace falta: "140", no "140.0". */
export function redondear(valor: number): string {
  const r = Math.round(valor * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function pesoLindo(kg: number, unidad: Unidad): string {
  return `${redondear(deKilos(kg, unidad))} ${unidad}`;
}

/**
 * La fecha SIEMPRE va al lado del número (§16.5): un PR de hace dos años
 * sigue siendo un PR, y quien lo mira tiene derecho a saber que es de hace
 * dos años. Se muestra con año, que es justo lo que delata a los viejos.
 */
export function fechaDeMarca(iso: string): string {
  const d = deISO(iso);
  return T.marca.fechaLarga(d.getDate(), MESES[d.getMonth()].slice(0, 3), d.getFullYear());
}

/**
 * Cómo se cargó la marca. "Estimado" suena a traducción y a formulario; lo
 * que la persona hizo fue levantar un peso una cantidad de veces, y así se
 * dice (§6 del repaso: primero lo que LEVANTASTE).
 */
export function origenDeMarca(m: { peso: number; reps: number; es_real: boolean }): string {
  if (m.es_real || m.reps === 1) return T.marca.deUnaVez;
  return T.marca.nVeces(m.reps);
}
