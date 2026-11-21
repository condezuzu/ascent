// Las cuentas de la sección de músculos, IGUALES EN MOSS Y EN ASCENT (spec/musculos-compartido.md, sección 4).
// Este archivo se copia tal cual en las dos apps: no importa nada y sus casos están en
// puntajeMuscular.casos.json, que corren las pruebas de las dos. Si lo cambias, cámbialo en las dos.

/** Una serie de trabajo (sin las de entrada en calor). `rir`: las repeticiones que quedaban; «al fallo» es 0. */
export type SerieHecha = { reps: number | null; rir?: number | null };
/** Un ejercicio hecho: sus músculos según el catálogo compartido y sus series de trabajo. */
export type EjercicioHecho = {
  principal: readonly string[];
  ayuda: readonly string[];
  /** La parte que trabaja más, solo donde hay ensayos de crecimiento (tricepsLarga, pechoAlto). */
  parte?: string;
  /** Las repeticiones del objetivo, si la rutina las tiene. */
  objetivo?: number | null;
  series: readonly SerieHecha[];
};

// ------------------------------------------------------------ qué se cuenta

/** La semana son los últimos 7 días, contando hoy: con el lunes, cada semana arrancaría con el cuerpo gris. */
export const DIAS_DE_LA_SEMANA = 7;
/** El 1RM de referencia de un ejercicio sale de sus series de las últimas 18 semanas antes de ahora. */
export const DIAS_DEL_E1RM = 126;
/** La serie de trabajo empieza en el 60 % del 1RM estimado: lo de menos es entrada en calor. */
export const DE_TRABAJO = 0.6;

const diaUTC = (clave: string) => {
  const [a, m, d] = clave.split('-').map(Number);
  return Date.UTC(a, m - 1, d) / 86_400_000;
};
/** Si un día (clave AAAA-MM-DD) está en los últimos 7 días, contando hoy. */
export const dentroDeLaSemana = (fecha: string, hoy: string) => {
  const n = diaUTC(hoy) - diaUTC(fecha);
  return n >= 0 && n < DIAS_DE_LA_SEMANA;
};

/**
 * El 1RM estimado con Epley, de 1 a 10 repeticiones (más, se equivoca mucho: Reynolds 2006). Con una repetición, el
 * peso: es lo levantado. Sin peso o fuera de rango, null.
 */
export const e1rm = (peso: number, reps: number | null) => (reps != null && peso > 0 && reps >= 1 && reps <= 10 ? (reps === 1 ? peso : peso * (1 + reps / 30)) : null);

/** El mejor 1RM estimado de unas series (las del ejercicio en los últimos DIAS_DEL_E1RM días); sin ninguna, null. */
export function mejorE1rm(series: readonly { peso: number; reps: number | null }[]): number | null {
  let mejor: number | null = null;
  for (const x of series) {
    const v = e1rm(x.peso, x.reps);
    if (v !== null && (mejor === null || v > mejor)) mejor = v;
  }
  return mejor;
}

/** Si una serie es de trabajo: con el 60 % del 1RM de referencia o más. Sin repeticiones, sin peso o sin 1RM, cuenta. */
export const esDeTrabajo = (s: { peso: number; reps: number | null }, unoRM: number | null) => s.reps === null || !unoRM || s.peso <= 0 || s.peso >= DE_TRABAJO * unoRM;

/** Hasta este RIR, la serie es dura. */
export const RIR_DURA = 3;
/** Lo que cuenta el músculo que ayuda (el conteo fraccionado de Pelland 2026). */
export const CUENTA_LA_AYUDA = 0.5;
/** El rango de referencia, en series duras por semana: una convención donde se junta la evidencia. */
export const RANGO = { desde: 10, hasta: 20 } as const;
export const PUNTAJE_TOPE = 200;
/** «En su punto»: el puntaje de 10 y de 20 series. */
export const FRANJA = { desde: 70, hasta: 130 } as const;

/**
 * Si una serie cuenta como dura: con RIR, de 0 a 3. Sin RIR, si llegó a las repeticiones del objetivo; sin
 * objetivo, cuenta (se supone que la serie de trabajo fue cerca del fallo).
 */
export function esDura(s: SerieHecha, objetivo?: number | null): boolean {
  if (s.rir != null) return s.rir <= RIR_DURA;
  if (objetivo != null && s.reps != null) return s.reps >= objetivo;
  return true;
}

export type DelMusculo = { series: number; partes: Record<string, number> };

/** Las series duras de cada músculo: el principal cuenta 1 y el que ayuda 0,5; la parte, aparte. */
export function seriesPorMusculo(ejercicios: readonly EjercicioHecho[]): Map<string, DelMusculo> {
  const r = new Map<string, DelMusculo>();
  const sumar = (m: string, n: number, parte?: string) => {
    const x = r.get(m) ?? { series: 0, partes: {} };
    x.series += n;
    if (parte) x.partes[parte] = (x.partes[parte] ?? 0) + n;
    r.set(m, x);
  };
  for (const e of ejercicios) {
    const duras = e.series.filter((s) => esDura(s, e.objetivo)).length;
    if (!duras) continue;
    e.principal.forEach((m) => sumar(m, duras, e.parte));
    e.ayuda.forEach((m) => sumar(m, duras * CUENTA_LA_AYUDA));
  }
  return r;
}

/** El puntaje por tramos: de 0 a 10 series, 7 por serie; de ahí, 6 por serie (15 = 100), con tope 200. */
export function puntaje(series: number): number {
  const s = Math.max(0, series);
  const p = s <= RANGO.desde ? s * 7 : FRANJA.desde + (s - RANGO.desde) * 6;
  return Math.min(PUNTAJE_TOPE, Math.round(p));
}

export type EstadoDelPuntaje = 'sinEntrenar' | 'poco' | 'enSuPunto' | 'mucho';

export function estadoDelPuntaje(p: number): EstadoDelPuntaje {
  if (p <= 0) return 'sinEntrenar';
  if (p < FRANJA.desde) return 'poco';
  return p <= FRANJA.hasta ? 'enSuPunto' : 'mucho';
}

// ------------------------------------------------------------------ la nota de la rutina

/** Los músculos grandes, para la frecuencia (Schoenfeld 2016). */
export const MUSCULOS_GRANDES = ['pecho', 'dorsales', 'hombros', 'cuadriceps', 'isquios', 'gluteos'] as const;
/** Cada músculo grande, dos veces por semana o más. */
export const VECES_POR_SEMANA = 2;

export type DiaDeLaRutina = readonly EjercicioHecho[];
/** Lo que mejoraría la rutina en un músculo, con sus series de la semana (redondeadas a media). */
export type Mejora = { musculo: string; que: 'frecuencia' | 'pocasSeries' | 'muchasSeries'; series: number };
export type NotaDeLaRutina = { nota: 'muyBuena' | 'buena' | 'mejorable'; mejoras: Mejora[] };

/**
 * La nota de una semana de rutina: por cada músculo grande, si va dos veces o más y si sus series caen en el
 * rango. Los cortes de la nota (90 % y 60 % de lo que cumple) son una convención. Hasta dos mejoras, de dos
 * músculos, los que menos cumplen.
 */
export function notaDeLaRutina(dias: readonly DiaDeLaRutina[]): NotaDeLaRutina {
  const series = seriesPorMusculo(dias.flat());
  const veces = (m: string) => dias.filter((d) => d.some((e) => e.principal.includes(m) && e.series.length > 0)).length;
  let cumple = 0;
  const faltas: (Mejora & { peso: number })[] = [];
  for (const m of MUSCULOS_GRANDES) {
    const n = series.get(m)?.series ?? 0;
    const v = veces(m);
    const enRango = n >= RANGO.desde && n <= RANGO.hasta;
    const frecuente = v >= VECES_POR_SEMANA;
    cumple += Number(enRango) + Number(frecuente);
    const s = Math.round(n * 2) / 2;
    if (!enRango) faltas.push({ musculo: m, que: n < RANGO.desde ? 'pocasSeries' : 'muchasSeries', series: s, peso: 2 - Number(frecuente) });
    if (!frecuente) faltas.push({ musculo: m, que: 'frecuencia', series: s, peso: 2 - Number(enRango) });
  }
  const parte = cumple / (MUSCULOS_GRANDES.length * 2);
  const nota = parte >= 0.9 ? 'muyBuena' : parte >= 0.6 ? 'buena' : 'mejorable';
  const mejoras = faltas
    .sort((a, b) => b.peso - a.peso || MUSCULOS_GRANDES.indexOf(a.musculo as never) - MUSCULOS_GRANDES.indexOf(b.musculo as never))
    // Una por músculo: dos mejoras del mismo dicen menos que una de cada uno.
    .filter((f, i, todas) => todas.findIndex((x) => x.musculo === f.musculo) === i)
    .slice(0, 2)
    .map(({ musculo, que, series }) => ({ musculo, que, series }));
  return { nota, mejoras };
}

// ------------------------------------------------------------------ la próxima sesión

/** Para subir, las series tienen que llegar al tope con este RIR o más. */
export const RIR_PARA_SUBIR = 2;
/** Las sesiones seguidas que tienen que cumplir: el RIR erra ±1, nunca se decide por una. */
export const SESIONES_PARA_SUBIR = 2;

export type SesionDelEjercicio = { series: readonly SerieHecha[] };
export type Proxima =
  | { decision: 'subir' }
  | { decision: 'mantener'; razon: 'faltaElTope' | 'sueno' | 'fatiga' | 'sinObjetivo' }
  | { decision: 'noSeSabe'; razon: 'pocasSesiones' };

/**
 * La doble progresión: sube cuando todas las series de las dos últimas sesiones llegan al tope del rango con RIR 2
 * o más (sin RIR anotado, alcanza con el tope). La comida no frena: el déficit no le quita fuerza a lo ganado
 * (spec/estudio/musculos-recuperacion.md, 6). `nocheCortaHoy`: si hoy toca este ejercicio después de una noche de
 * 6 h o menos (o de despertarte 1 h antes): ese día no se sube; `fatigadoHoy`, lo mismo si un músculo suyo todavía se
 * recupera. `sesiones`, de la más vieja a la más nueva.
 */
export function proximaSesion(p: { sesiones: readonly SesionDelEjercicio[]; tope: number | null; nocheCortaHoy: boolean; fatigadoHoy?: boolean }): Proxima {
  // Sin las repeticiones del objetivo en la rutina no hay doble progresión: se mantiene.
  if (p.tope == null) return { decision: 'mantener', razon: 'sinObjetivo' };
  const ultimas = p.sesiones.filter((s) => s.series.length > 0).slice(-SESIONES_PARA_SUBIR);
  if (ultimas.length < SESIONES_PARA_SUBIR) return { decision: 'noSeSabe', razon: 'pocasSesiones' };
  const tope = p.tope;
  const llega = ultimas.every((s) => s.series.every((x) => x.reps != null && x.reps >= tope && (x.rir == null || x.rir >= RIR_PARA_SUBIR)));
  if (!llega) return { decision: 'mantener', razon: 'faltaElTope' };
  if (p.nocheCortaHoy) return { decision: 'mantener', razon: 'sueno' };
  // Si hoy toca y alguno de sus músculos todavía se recupera, hoy no se sube: que no diga «sube» y «recupérate» a la vez.
  if (p.fatigadoHoy) return { decision: 'mantener', razon: 'fatiga' };
  return { decision: 'subir' };
}

// ------------------------------------------------------------------ la fatiga, en días

/** Las piernas y la espalda baja: al fallo con un multiarticular, tardan un día más. */
export const DE_PIERNAS = ['cuadriceps', 'gluteos', 'isquios', 'aductores', 'espaldaBaja'] as const;
/** Desde estas series a 2 o más de reserva, un día más. */
export const SERIES_QUE_ALARGAN = 10;

/** Un músculo en una sesión en que fue principal: sus series de trabajo y la reserva más baja (sin anotar, null). */
export type MusculoEnLaSesion = {
  fecha: string;
  series: number;
  rirMinimo: number | null;
  /** Lo trabajó un multiarticular y el músculo es de las piernas o la espalda baja. */
  multiarticularDePiernas: boolean;
  /** La primera vez con alguno de esos ejercicios en 26 semanas. */
  nuevo: boolean;
};

/**
 * Cuántos días tarda en estar listo, por casos (spec/estudio/musculos-recuperacion.md, 2.4, tabla A; erra ±1 día):
 * todo a 2 o más de reserva, al día siguiente (2 días con 10 series o más); a 1 o sin la reserva anotada, 2 días; al
 * fallo, 2 días, o 3 en un multiarticular de piernas o espalda baja; la primera vez con el ejercicio, uno más.
 */
export function diasParaEstarListo(s: MusculoEnLaSesion): number {
  const r = s.rirMinimo;
  const d = r === null || r === 1 ? 2 : r <= 0 ? (s.multiarticularDePiernas ? 3 : 2) : s.series >= SERIES_QUE_ALARGAN ? 2 : 1;
  return d + (s.nuevo ? 1 : 0);
}

const sumarDiasUTC = (clave: string, n: number) => new Date((diaUTC(clave) + n) * 86_400_000).toISOString().slice(0, 10);

/**
 * El día en que vuelve a estar listo un músculo, con sus sesiones de la más vieja a la más nueva: cuenta la última
 * y, si lo volviste a entrenar antes de estar listo, un día más. Sin sesiones, null.
 */
export function listoEl(sesiones: readonly MusculoEnLaSesion[]): string | null {
  let listo: string | null = null;
  for (const s of sesiones) {
    const antes = listo !== null && s.fecha < listo;
    listo = sumarDiasUTC(s.fecha, diasParaEstarListo(s) + (antes ? 1 : 0));
  }
  return listo;
}

/** Los días que faltan hasta ese día (0 si ya está). */
export const diasHastaListo = (listo: string | null, hoy: string) => (listo === null ? 0 : Math.max(0, diaUTC(listo) - diaUTC(hoy)));

export type EstadoDeFatiga = 'descansado' | 'recuperandose' | 'cargado';
/** Cargado si faltan 2 días o más; recuperándose si falta 1. */
export const estadoDeFatiga = (dias: number): EstadoDeFatiga => (dias >= 2 ? 'cargado' : dias === 1 ? 'recuperandose' : 'descansado');

/**
 * El peso para subir: el salto más chico que suele tener la barra o la máquina, dentro del 2 al 10 % del ACSM 2009 (el
 * 2,5 kg y el 1 kg son convención). Sin peso (el del cuerpo), null.
 */
export function pesoSiguiente(kg: number): number | null {
  if (kg <= 0) return null;
  return kg >= 20 ? kg + 2.5 : kg + 1;
}
