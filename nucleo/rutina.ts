/**
 * LA RUTINA QUE SE PROPONE SOLA.
 *
 * Uno repite su rutina: lo que hace los domingos es casi siempre lo mismo. La
 * app ya tiene esa información (las sesiones pasadas con sus bloques) y hasta
 * ahora no la usaba más que para sembrar el último ejercicio suelto. Acá está la
 * lógica —pura, sin red ni estado— para proponer la rutina del día en cadena.
 *
 * TODO SALE DEL LADO DEL CLIENTE, de las sesiones que ya se traen. Sin migración
 * (regla confirmada). Una "rutina" es la lista ORDENADA de ejercicios de una
 * sesión, sin repetir (dos bloques del mismo ejercicio son un ejercicio).
 *
 * LAS REGLAS, tal como se cerraron:
 *  - Por día de la semana: lo que hiciste ese mismo día en las últimas ~4
 *    semanas (la más reciente). Lo que hago los domingos. Pero un día suelto
 *    no la reescribe (ver `sinSueltos`, 15/10).
 *  - Si ese día no tiene historia reciente: la rutina que SIGUE por rotación a
 *    la última que hiciste.
 *  - Si cambiás el primer ejercicio: la cadena se re-engancha a la rutina que
 *    corresponde a ESE ejercicio (lo que solés hacer después de él).
 *  - Sin historia: no se propone nada (queda como hoy).
 *  El PESO de cada ejercicio no sale de acá: es el de la última vez que se hizo
 *  ese ejercicio, y eso ya lo resuelve `como_arranca` en la base.
 */

/** Una sesión pasada, reducida a lo que la rutina necesita. */
export type SesionRutina = {
  /** El día del log (YYYY-MM-DD), en el huso de la persona. */
  fecha: string;
  /** Los ejercicios de la sesión, en orden y sin repetir. */
  ejercicios: string[];
};

/** La ventana que se mira para "el mismo día de la semana": cuatro semanas. */
export const SEMANAS_VENTANA = 4;
const DIAS_VENTANA = SEMANAS_VENTANA * 7;

/** Ejercicios en orden, sin repetir y sin vacíos: la firma de una rutina. */
export function ejerciciosEnOrden(lista: (string | null | undefined)[]): string[] {
  const vistos = new Set<string>();
  const orden: string[] = [];
  for (const e of lista) {
    if (typeof e === 'string' && e && !vistos.has(e)) {
      vistos.add(e);
      orden.push(e);
    }
  }
  return orden;
}

/** El día de la semana (0=domingo) de una fecha ISO, sin líos de huso. */
function diaDeSemana(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, (m ?? 1) - 1, d ?? 1).getDay();
}

/** Días entre dos fechas ISO (a - b), por medianoche local. */
function diasEntre(a: string, b: string): number {
  const f = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
  };
  return Math.round((f(a) - f(b)) / 86400000);
}

const conEjercicios = (s: SesionRutina) => s.ejercicios.length > 0;
const porFechaAsc = (a: SesionRutina, b: SesionRutina) => a.fecha.localeCompare(b.fecha);
const firma = (ejercicios: string[]) => ejercicios.join('>');

/**
 * LO QUE HACÉS ESE DÍA, SIN QUE UN DÍA SUELTO LO REESCRIBA (15/10). `mismoDia`
 * va de la más vieja a la más nueva. La base es la más reciente —la última
 * rutina que hiciste—, pero lo que aparece en ella por PRIMERA VEZ ese día de la
 * semana no entra hasta que se repita: la sentadilla en Smith de una vez no pasa
 * a ser lo primero de todos los lunes. Y si lo nuevo es la mayoría, el día
 * entero fue suelto y vale el anterior (evaluado igual contra los suyos).
 */
export function sinSueltos<S extends { ejercicios: string[] }>(mismoDia: S[]): { base: S; ejercicios: string[] } | null {
  for (let i = mismoDia.length - 1; i >= 0; i--) {
    const base = mismoDia[i];
    if (i === 0) return { base, ejercicios: base.ejercicios };
    const vistos = new Set(mismoDia.slice(0, i).flatMap((x) => x.ejercicios));
    const conocidos = base.ejercicios.filter((e) => vistos.has(e));
    if (conocidos.length * 2 >= base.ejercicios.length) return { base, ejercicios: conocidos };
  }
  return null;
}

/**
 * LA RUTINA QUE SE PROPONE HOY. Vacío = no hay nada que proponer (queda como hoy).
 *
 * 1. El mismo día de la semana, en las últimas 4 semanas → la más reciente, sin
 *    lo suelto (`sinSueltos`).
 * 2. Si no hay, la que sigue por rotación a la última hecha.
 */
export function rutinaParaHoy(sesiones: SesionRutina[], hoyISO: string): string[] {
  const conE = sesiones.filter(conEjercicios);
  if (conE.length === 0) return [];

  // (1) MISMO DÍA DE LA SEMANA, últimas 4 semanas, la más reciente.
  const dow = diaDeSemana(hoyISO);
  const mismoDia = conE
    .filter((s) => {
      const dd = diasEntre(hoyISO, s.fecha);
      return dd > 0 && dd <= DIAS_VENTANA && diaDeSemana(s.fecha) === dow;
    })
    .sort(porFechaAsc);
  if (mismoDia.length > 0) return sinSueltos(mismoDia)?.ejercicios ?? [];

  // (2) ROTACIÓN: la que vino después de la última hecha, la última vez que la hice.
  return rotacion(conE);
}

/**
 * LA QUE SIGUE POR ROTACIÓN. La última sesión tiene una rutina R; se busca la
 * vez más reciente en que se hizo R y qué se hizo LA VEZ SIGUIENTE, y eso se
 * propone. Si R nunca se repitió, se propone R misma (nunca vacío si hay algo).
 */
function rotacion(conE: SesionRutina[]): string[] {
  const orden = [...conE].sort(porFechaAsc);
  const ultima = orden[orden.length - 1];
  const sig = firma(ultima.ejercicios);
  for (let i = orden.length - 2; i >= 0; i--) {
    if (firma(orden[i].ejercicios) === sig) return orden[i + 1].ejercicios;
  }
  return ultima.ejercicios;
}

/**
 * EL SIGUIENTE EN LA CADENA: el primero de la rutina que todavía no se hizo.
 * `null` cuando ya se hicieron todos —la rutina propuesta terminó—.
 */
export function siguienteEnRutina(rutina: string[], yaHechos: string[]): string | null {
  const hechos = new Set(yaHechos);
  for (const e of rutina) if (!hechos.has(e)) return e;
  return null;
}

/**
 * RE-ENGANCHE: cambiaste el primer ejercicio, y la cadena se re-arma con la
 * rutina que corresponde a ESE ejercicio —la vez más reciente que lo hiciste,
 * de ahí en adelante—. Si nunca lo hiciste, la cadena es solo ese ejercicio.
 */
/**
 * LA RUTINA DE LA SEMANA, para mostrársela a un amigo (8/10/2026): por cada día
 * de la semana, lo último que se hizo ese día —de las últimas cuatro veces, sin
 * lo suelto (`sinSueltos`)—. Lunes primero; el día sin sesiones no aparece.
 * `dia` es 0=domingo, como `Date.getDay()`.
 */
export type EjercicioDeRutina = { ejercicio: string; series: number; minutos?: number };
export type DiaDeRutina = { dia: number; ejercicios: EjercicioDeRutina[] };
type SesionVista = { fecha: string; bloques: { ejercicio?: string | null; series?: number | null; minutos?: number | null }[] };

/** Los bloques de una sesión, juntando los del mismo ejercicio: dos tandas de sentadilla son una, con las series sumadas. */
function ejerciciosConSeries(bloques: SesionVista['bloques']): EjercicioDeRutina[] {
  const orden: EjercicioDeRutina[] = [];
  for (const b of bloques ?? []) {
    if (typeof b?.ejercicio !== 'string' || !b.ejercicio) continue;
    const series = Number.isFinite(b.series) && (b.series as number) > 0 ? Math.round(b.series as number) : 0;
    const minutos = typeof b.minutos === 'number' && b.minutos > 0 ? Math.round(b.minutos) : 0;
    const ya = orden.find((e) => e.ejercicio === b.ejercicio);
    if (ya) {
      ya.series += series;
      if (minutos) ya.minutos = (ya.minutos ?? 0) + minutos;
    } else orden.push(minutos ? { ejercicio: b.ejercicio, series, minutos } : { ejercicio: b.ejercicio, series });
  }
  return orden;
}

export function rutinaPorDia(sesiones: SesionVista[]): DiaDeRutina[] {
  type Vista = { fecha: string; conSeries: EjercicioDeRutina[]; ejercicios: string[] };
  const porDia = new Map<number, Vista[]>();
  for (const s of sesiones) {
    const conSeries = ejerciciosConSeries(s.bloques);
    if (conSeries.length === 0) continue;
    const dia = diaDeSemana(s.fecha);
    porDia.set(dia, [...(porDia.get(dia) ?? []), { fecha: s.fecha, conSeries, ejercicios: conSeries.map((e) => e.ejercicio) }]);
  }
  const deDia = (d: number): EjercicioDeRutina[] => {
    // Con dos sesiones el mismo día queda la primera que llega: la base las
    // manda de la más nueva a la más vieja (el orden estable lo respeta).
    const vistas = [...(porDia.get(d) ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const unaPorFecha = vistas.filter((v, i) => i === 0 || vistas[i - 1].fecha !== v.fecha);
    const r = sinSueltos(unaPorFecha.slice(-SEMANAS_VENTANA));
    if (!r) return [];
    const quedan = new Set(r.ejercicios);
    return r.base.conSeries.filter((e) => quedan.has(e.ejercicio));
  };
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => porDia.has(d)).map((d) => ({ dia: d, ejercicios: deDia(d) }));
}

export function reengancharDesde(sesiones: SesionRutina[], primerEjercicio: string): string[] {
  const orden = [...sesiones].filter(conEjercicios).sort(porFechaAsc).reverse();
  for (const s of orden) {
    const i = s.ejercicios.indexOf(primerEjercicio);
    if (i >= 0) return s.ejercicios.slice(i);
  }
  return [primerEjercicio];
}
