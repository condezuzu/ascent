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
export type Mejora = { musculo: string; que: 'frecuencia' | 'pocasSeries' | 'muchasSeries' };
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
    if (!enRango) faltas.push({ musculo: m, que: n < RANGO.desde ? 'pocasSeries' : 'muchasSeries', peso: 2 - Number(frecuente) });
    if (!frecuente) faltas.push({ musculo: m, que: 'frecuencia', peso: 2 - Number(enRango) });
  }
  const parte = cumple / (MUSCULOS_GRANDES.length * 2);
  const nota = parte >= 0.9 ? 'muyBuena' : parte >= 0.6 ? 'buena' : 'mejorable';
  const mejoras = faltas
    .sort((a, b) => b.peso - a.peso || MUSCULOS_GRANDES.indexOf(a.musculo as never) - MUSCULOS_GRANDES.indexOf(b.musculo as never))
    // Una por músculo: dos mejoras del mismo dicen menos que una de cada uno.
    .filter((f, i, todas) => todas.findIndex((x) => x.musculo === f.musculo) === i)
    .slice(0, 2)
    .map(({ musculo, que }) => ({ musculo, que }));
  return { nota, mejoras };
}

// ------------------------------------------------------------------ la próxima sesión

/** Para subir, las series tienen que llegar al tope con este RIR o más. */
export const RIR_PARA_SUBIR = 2;
/** Las sesiones seguidas que tienen que cumplir: el RIR erra ±1, nunca se decide por una. */
export const SESIONES_PARA_SUBIR = 2;
/** El déficit que aconseja mantener (Murphy y Koehler 2022). */
export const DEFICIT_GRANDE = 500;

export type SesionDelEjercicio = { series: readonly SerieHecha[] };
export type Proxima =
  | { decision: 'subir' }
  | { decision: 'mantener'; razon: 'faltaElTope' | 'sueno' | 'deficit' | 'sinObjetivo' }
  | { decision: 'noSeSabe'; razon: 'pocasSesiones' };

/**
 * La doble progresión: sube cuando todas las series de las dos últimas sesiones llegan al tope del rango con
 * RIR 2 o más (sin RIR anotado, alcanza con el tope). El sueño corto varias noches o un déficit de más de
 * ~500 kcal solo aconsejan mantener. `sesiones`, de la más vieja a la más nueva.
 */
export function proximaSesion(p: {
  sesiones: readonly SesionDelEjercicio[];
  tope: number | null;
  suenoCorto: boolean;
  deficit: number | null;
}): Proxima {
  // Sin las repeticiones del objetivo en la rutina no hay doble progresión: se mantiene.
  if (p.tope == null) return { decision: 'mantener', razon: 'sinObjetivo' };
  const ultimas = p.sesiones.filter((s) => s.series.length > 0).slice(-SESIONES_PARA_SUBIR);
  if (ultimas.length < SESIONES_PARA_SUBIR) return { decision: 'noSeSabe', razon: 'pocasSesiones' };
  const tope = p.tope;
  const llega = ultimas.every((s) => s.series.every((x) => x.reps != null && x.reps >= tope && (x.rir == null || x.rir >= RIR_PARA_SUBIR)));
  if (!llega) return { decision: 'mantener', razon: 'faltaElTope' };
  if (p.suenoCorto) return { decision: 'mantener', razon: 'sueno' };
  if (p.deficit != null && p.deficit > DEFICIT_GRANDE) return { decision: 'mantener', razon: 'deficit' };
  return { decision: 'subir' };
}
