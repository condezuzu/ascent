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
 * LAS SESIONES DE UNA MISMA FECHA SON UN SOLO DÍA (cacería del 15/10): pesas a la mañana
 * y cinta a la tarde, o una que se cerró sola y se volvió a arrancar. Separadas, la
 * de la tarde pasaba por "el lunes" y se proponía sola. Llegan en orden de inicio.
 */
function unaPorFecha(ss: SesionRutina[]): SesionRutina[] {
  const out: SesionRutina[] = [];
  for (const s of [...ss].sort(porFechaAsc)) {
    const ult = out[out.length - 1];
    if (ult && ult.fecha === s.fecha) out[out.length - 1] = { fecha: s.fecha, ejercicios: ejerciciosEnOrden([...ult.ejercicios, ...s.ejercicios]) };
    else out.push(s);
  }
  return out;
}

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
  const conE = unaPorFecha(sesiones.filter(conEjercicios));
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

/** La sugerencia del siguiente mira solo la última semana (16/10, a pedido: eran cuatro). */
export const DIAS_DE_LA_SUGERENCIA = 7;

/**
 * LO QUE SUELE VENIR DESPUÉS DE `ultimo` (16/10): en la sesión más reciente de la
 * última semana que lo tiene, el primero que le sigue y que hoy no se hizo. Curl de
 * bíceps → curl martillo. `null` si en la semana no aparece o no le siguió nada.
 *
 * SOLO DEL MISMO DÍA DE LA SEMANA (19/10, bug del gimnasio): miraba todas las sesiones de
 * la semana, y el lunes podía proponer lo que siguió al press el martes, que es otro día.
 */
export function despuesDe(sesiones: SesionRutina[], ultimo: string, yaHechos: string[], hoyISO: string): string | null {
  const hechos = new Set(yaHechos);
  const hoy = diaDeSemana(hoyISO);
  const recientes = sesiones
    .filter((s) => {
      const dd = diasEntre(hoyISO, s.fecha);
      return dd >= 0 && dd <= DIAS_DE_LA_SUGERENCIA && diaDeSemana(s.fecha) === hoy;
    })
    .sort(porFechaAsc)
    .reverse();
  for (const s of recientes) {
    const i = s.ejercicios.indexOf(ultimo);
    if (i < 0) continue;
    const sigue = s.ejercicios.slice(i + 1).find((e) => !hechos.has(e));
    if (sigue) return sigue;
  }
  return null;
}

/**
 * EL SIGUIENTE EN LA CADENA: el que viene en la rutina después de lo hecho, sin repetir lo
 * ya hecho. `null` cuando ya se hicieron todos —la rutina propuesta terminó—.
 *
 * SIGUE POR DONDE IBA (19/10, bug del gimnasio): proponía el primero no hecho, así que al
 * cambiar un ejercicio por otro la lista volvía para atrás. Ahora arranca después del
 * último de la rutina que se hizo, y nunca antes de tantos como ya se hicieron (cambiar
 * uno por otro también es avanzar uno). Al llegar al final, vuelve a lo que faltó.
 */
/**
 * LO QUE QUEDA DE LA RUTINA HOY (20/10, bug: la segunda sesión del día volvía a proponer el
 * primero). Lo hecho en las sesiones anteriores de hoy cubre su lugar; lo que no estaba en el
 * día ocupa, en orden, el lugar de uno que no se hizo (la misma regla que «Reemplazar»). Si no
 * queda nada, el día entero, como antes.
 */
export function pendientesDeHoy(dia: string[], hechosHoy: string[]): string[] {
  const cubierto = cubiertosHoy(dia, hechosHoy);
  const quedan = dia.filter((_, k) => !cubierto[k]);
  return quedan.length > 0 ? quedan : dia;
}

/** Qué lugares del día ya cubrió lo hecho hoy, con la regla de `pendientesDeHoy`. */
export function cubiertosHoy(dia: string[], hechosHoy: string[]): boolean[] {
  const cubierto = dia.map(() => false);
  const ajenos: string[] = [];
  for (const h of new Set(hechosHoy)) {
    const i = dia.findIndex((e, k) => e === h && !cubierto[k]);
    if (i >= 0) cubierto[i] = true;
    else ajenos.push(h);
  }
  for (let n = 0; n < ajenos.length; n++) {
    const libre = cubierto.indexOf(false);
    if (libre < 0) break;
    cubierto[libre] = true;
  }
  return cubierto;
}

export function siguienteEnRutina(rutina: string[], yaHechos: string[]): string | null {
  const hechos = new Set(yaHechos);
  const ultimo = Math.max(-1, ...yaHechos.map((e) => rutina.indexOf(e)));
  const desde = Math.max(ultimo + 1, Math.min(yaHechos.length, rutina.length));
  for (let i = 0; i < rutina.length; i++) {
    const e = rutina[(desde + i) % rutina.length];
    if (!hechos.has(e)) return e;
  }
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
    // Las de una misma fecha son un solo día (ver `unaPorFecha`). La base las manda de
    // la más nueva a la más vieja: se juntan al revés, en el orden en que se hicieron.
    const porFecha = new Map<string, Vista[]>();
    for (const v of porDia.get(d) ?? []) porFecha.set(v.fecha, [v, ...(porFecha.get(v.fecha) ?? [])]);
    const juntas = [...porFecha.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, vs]) => {
        const conSeries = ejerciciosConSeries(vs.flatMap((v) => v.conSeries));
        return { fecha, conSeries, ejercicios: conSeries.map((e) => e.ejercicio) };
      });
    const r = sinSueltos(juntas.slice(-SEMANAS_VENTANA));
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

/**
 * EL DÍA QUE SE HIZO, con la forma de un día de rutina (16/10): cada ejercicio una vez,
 * en el orden en que apareció, con sus series sumadas y los minutos del cardio.
 */
export function diaDeLaSesion(bloques: SesionVista['bloques']): { descanso: false; ejercicios: EjercicioDeRutina[] } {
  return { descanso: false, ejercicios: ejerciciosConSeries(bloques) };
}

/** Una sesión pasada con lo que se anotó en cada bloque: series, pesos y modo de carga. */
export type SesionConPesos = { fecha: string; bloques: { ejercicio?: string | null; series?: number | null; pesos?: (number | null)[] | null; carga?: string | null }[] };

/**
 * LA ÚLTIMA VEZ DE UN EJERCICIO (19/10, bug del gimnasio): la sesión más reciente antes de
 * hoy que lo tiene, con sus tandas juntas. Las repeticiones no están: no se anotan por serie.
 */
export function ultimaVezDe(sesiones: SesionConPesos[], ejercicio: string, hoyISO: string): { fecha: string; series: number; pesos: (number | null)[]; carga?: string } | null {
  let s: SesionConPesos | null = null;
  for (const x of sesiones) if (x.fecha < hoyISO && (!s || x.fecha > s.fecha) && x.bloques.some((b) => b?.ejercicio === ejercicio)) s = x;
  if (!s) return null;
  const suyos = s.bloques.filter((b) => b?.ejercicio === ejercicio);
  const series = suyos.reduce((t, b) => t + (Number(b.series) > 0 ? Math.round(Number(b.series)) : 0), 0);
  const carga = suyos.find((b) => b.carga)?.carga ?? undefined;
  return { fecha: s.fecha, series, pesos: suyos.flatMap((b) => b.pesos ?? []), ...(carga ? { carga } : {}) };
}

/** Una marca con sus repeticiones, como la guarda `prs` (sin la hora: no es de las columnas que se leen). */
export type MarcaConReps = { ejercicio: string; peso: number; reps: number; fecha: string };

/**
 * LAS REPETICIONES DE LA ÚLTIMA VEZ (20/10). Las series no guardan repeticiones: las únicas
 * que hay son las de las marcas. Son las de la marca de ese ejercicio guardada el día de su
 * última sesión (`ultimaVezDe`); si esa sesión no tuvo marca, no hay. Antes era la marca más
 * reciente de cualquier día, y una de hace semanas se leía como la de la última vez.
 */
export function repsDeLaSesion(marcas: MarcaConReps[], ejercicio: string, fecha: string): MarcaConReps | null {
  let m: MarcaConReps | null = null;
  for (const x of marcas) if (x.ejercicio === ejercicio && x.fecha === fecha) m = x;
  return m;
}

/** Los días de la rutina con ese día cambiado por lo que se hizo: el resto, sin tocar (19/10). */
export function conDiaReemplazado<D>(dias: D[], dia: number, hecho: D): D[] {
  return dias.map((d, i) => (i === dia ? hecho : d));
}

type DiaConEjercicios = { descanso: boolean; ejercicios: EjercicioDeRutina[] };

/**
 * LO QUE GUARDA «REEMPLAZAR» EN LA VENTANA DEL FINAL: el día con lo que cambió, y nada más
 * (20/10, bug del gimnasio: "cambié el primer ejercicio y me editó todo"). Pisaba el día
 * entero con lo entrenado: cambiar el primero y cortar antes borraba el resto. Ahora cada
 * ejercicio hecho que el día no tenía ocupa, en orden, el lugar de uno del día que no se
 * hizo; si sobran, van al final. Lo demás queda como estaba, con sus series.
 */
export function rutinaConLoHecho<D extends DiaConEjercicios>(dias: D[], dia: number, hecho: D, antesHoy: string[] = []): D[] {
  const delDia = dias[dia];
  const antes = delDia && !delDia.descanso ? delDia.ejercicios : [];
  const hechos = new Set(hecho.ejercicios.map((e) => e.ejercicio));
  const tenia = new Set(antes.map((e) => e.ejercicio));
  const nuevos = hecho.ejercicios.filter((e) => !tenia.has(e.ejercicio));
  // LO DE LAS SESIONES ANTERIORES DE HOY también cuenta como hecho (20/10): si no, en la segunda
  // sesión del día lo nuevo pisaba el primero, que ya se había hecho a la mañana.
  const cubierto = cubiertosHoy(antes.map((e) => e.ejercicio), antesHoy);
  let usados = 0;
  const ejercicios = antes.map((e, k) => (!hechos.has(e.ejercicio) && !cubierto[k] && usados < nuevos.length ? nuevos[usados++] : e));
  return conDiaReemplazado(dias, dia, { ...hecho, descanso: false, ejercicios: [...ejercicios, ...nuevos.slice(usados)] });
}

/** Lo que se elige en la ventana del final. */
export type EleccionDeLaVentana = 'reemplazar' | 'nueva' | 'olvidar';

/**
 * CÓMO QUEDAN LOS DÍAS SEGÚN LO QUE SE ELIGE (20/10). «Reemplazar» y «Crear rutina nueva»
 * guardan el día con lo que cambió (`rutinaConLoHecho`; la nueva, aparte). «Olvidar este
 * día» no guarda nada: el cambio de ese día se descarta y la rutina queda como estaba.
 */
export function rutinaTrasLaVentana<D extends DiaConEjercicios>(dias: D[], dia: number, hecho: D, eleccion: EleccionDeLaVentana, antesHoy: string[] = []): D[] | null {
  return eleccion === 'olvidar' ? null : rutinaConLoHecho(dias, dia, hecho, antesHoy);
}

/**
 * ¿SE PREGUNTA SI CAMBIA EL DÍA DE LA RUTINA? (16/10) Solo si se entrenó algo que ese día
 * no tiene: el orden y las series no cuentan, otro ejercicio sí. Un día de descanso o vacío
 * en la rutina, con algo hecho, también. Saltearse uno ya no pregunta (20/10): «Reemplazar»
 * solo cambia lo nuevo (`rutinaConLoHecho`), así que no habría qué cambiar.
 */
export function hayQuePreguntarPorLaRutina(
  delDia: { descanso: boolean; ejercicios: { ejercicio: string }[] } | undefined,
  hecho: { ejercicios: { ejercicio: string }[] }
): boolean {
  const tiene = new Set(delDia && !delDia.descanso ? delDia.ejercicios.map((e) => e.ejercicio) : []);
  return hecho.ejercicios.some((e) => !tiene.has(e.ejercicio));
}
