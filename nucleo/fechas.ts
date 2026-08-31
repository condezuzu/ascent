import { T } from './textos.ts';

// Todas las fechas de la app son fechas locales en formato YYYY-MM-DD.
// Nunca usar toISOString() para "hoy": corta el día en UTC, no en el huso del usuario.

export function hoyISO(): string {
  return aISO(new Date());
}

export function aISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function deISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function restarDias(iso: string, dias: number): string {
  const d = deISO(iso);
  d.setDate(d.getDate() - dias);
  return aISO(d);
}

export const DIAS_SEMANA = T.fechas.diasCortos;
export const DIAS_SEMANA_LARGO = T.fechas.diasLargos;
export const MESES = T.fechas.meses;

export function fechaLinda(iso: string): string {
  const d = deISO(iso);
  return T.fechas.delMes(d.getDate(), MESES[d.getMonth()]);
}

// "1 día" / "2 días". La racha arranca en 1 todo el tiempo, así que el
// singular aparece seguido y un "1 días" canta enseguida.
export function enDias(n: number): string {
  return T.fechas.enDias(n);
}
