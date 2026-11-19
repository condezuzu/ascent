// Lo de la sección de músculos que no es del puntaje, IGUAL EN MOSS Y EN ASCENT (spec/musculos-compartido.md): la
// tendencia de fuerza de 12 semanas con su rango, cuándo un ejercicio está estancado, por qué puede estarlo y el
// grupo de cada día de tu año. Como puntajeMuscular.ts, se copia tal cual en las dos apps, no importa nada y sus
// casos están en progresoCompartido.casos.json. Las fechas son claves AAAA-MM-DD (string).

// ------------------------------------------------------------ la fuerza: la tendencia de cada ejercicio

/** Una sesión con el ejercicio: cuándo (en semanas, desde cualquier día fijo) y el 1RM estimado de su mejor serie. */
export type PuntoDeFuerza = { t: number; e1rm: number };
export type EstadoDeLaFuerza = 'sube' | 'sinSubidaClara' | 'noSeSabe';
/** La recta de la tendencia, en logaritmos: lo que hace falta para dibujarla con su rango. */
export type Ajuste = { tMedio: number; yMedio: number; b: number; s: number; n: number; sxx: number };
export type TendenciaDeFuerza = {
  estado: EstadoDeLaFuerza;
  /** Las sesiones de la ventana y cuántas semanas van de la primera a la última. */
  sesiones: number;
  semanas: number;
  /** Lo que sube por mes, en %, con su rango del 80 % (null si no se sabe). */
  porMes: number | null;
  rango: [number, number] | null;
  /** Tu ruido de un día a otro, en %, acercado al de los estudios (sigmaTuyo). */
  sigma: number;
  /** Tu nivel de hoy, en kg de 1RM estimado: el de la tendencia (null con menos de 3 sesiones). */
  nivel: number | null;
  ajuste: Ajuste | null;
  puntos: PuntoDeFuerza[];
};

/** La ventana: las últimas 12 semanas. */
export const SEMANAS_DE_LA_TENDENCIA = 12;
/** Para decir algo: 6 sesiones o más, y por lo menos 6 semanas de la primera a la última. */
export const SESIONES_MINIMAS = 6;
export const SEMANAS_MINIMAS_DE_HISTORIA = 6;
/** «Sin subida clara»: ni el borde de arriba del rango llega a +0,3 % por semana. */
export const SIN_SUBIDA_POR_SEMANA = 0.3;
/** El rango del 80 %. */
export const Z_80 = 1.2816;
/** Semanas por mes (52,2 / 12). */
const SEMANAS_POR_MES = 4.35;

const porMesDe = (b: number) => (Math.exp(SEMANAS_POR_MES * b) - 1) * 100;

/**
 * La tendencia de la fuerza en un ejercicio: con las sesiones de las últimas 12 semanas, la recta de
 * mínimos cuadrados de ln(e1RM) contra el tiempo, con su rango del 80 % (b ± 1,2816 · EE(b)).
 * - «sube» si el borde de abajo pasa 0; «sin subida clara» si el de arriba no llega a +0,3 % por semana;
 *   si no, o con menos de 6 sesiones o 6 semanas, «todavía no se sabe».
 * - Con una sesión por semana y un ruido de 3,3 %: si subes un 1 % por mes, dice «sin subida clara» el
 *   15 % de las veces (la regla de las 3 semanas, el 63 %); si no subes, «sube» el 12 %.
 * - Tu ruido sale de lo que se aparta cada sesión de la recta (el error típico de Hopkins 2000), acercado
 *   al de los estudios con el peso de 10 sesiones.
 */
export function tendenciaDeFuerza(todos: readonly PuntoDeFuerza[], o: { hoy: number; entrenado: boolean }): TendenciaDeFuerza {
  const puntos = todos.filter((p) => p.t <= o.hoy && p.t > o.hoy - SEMANAS_DE_LA_TENDENCIA && p.e1rm > 0).sort((a, b) => a.t - b.t);
  const n = puntos.length;
  const semanas = n ? puntos[n - 1].t - puntos[0].t : 0;
  const base = o.entrenado ? SIGMA.entrenado : SIGMA.novato;
  const vacia: TendenciaDeFuerza = { estado: 'noSeSabe', sesiones: n, semanas, porMes: null, rango: null, sigma: base, nivel: null, ajuste: null, puntos };
  if (n < 3 || semanas <= 0) return vacia;
  const ys = puntos.map((p) => Math.log(p.e1rm));
  const tMedio = puntos.reduce((s, p) => s + p.t, 0) / n;
  const yMedio = ys.reduce((s, y) => s + y, 0) / n;
  let sxx = 0, sxy = 0;
  puntos.forEach((p, i) => { sxx += (p.t - tMedio) ** 2; sxy += (p.t - tMedio) * (ys[i] - yMedio); });
  const b = sxy / sxx;
  const residuos = puntos.map((p, i) => ys[i] - yMedio - b * (p.t - tMedio));
  const sse = residuos.reduce((s, r) => s + r * r, 0);
  const s = Math.sqrt(sse / Math.max(1, n - 2));
  const ee = s / Math.sqrt(sxx);
  const ajuste: Ajuste = { tMedio, yMedio, b, s, n, sxx };
  const sigma = sigmaTuyo(residuos.map((r) => r * 100), o.entrenado);
  const nivel = Math.exp(yMedio + b * (o.hoy - tMedio));
  if (n < SESIONES_MINIMAS || semanas < SEMANAS_MINIMAS_DE_HISTORIA) return { ...vacia, sigma, nivel, ajuste };
  const abajo = 100 * (b - Z_80 * ee), arriba = 100 * (b + Z_80 * ee);
  const estado: EstadoDeLaFuerza = abajo > 0 ? 'sube' : arriba < SIN_SUBIDA_POR_SEMANA ? 'sinSubidaClara' : 'noSeSabe';
  return { estado, sesiones: n, semanas, porMes: porMesDe(b), rango: [porMesDe(b - Z_80 * ee), porMesDe(b + Z_80 * ee)], sigma, nivel, ajuste, puntos };
}

/** La tendencia en un momento, en kg, con su rango del 80 % (para dibujarla). */
export function nivelEn(a: Ajuste, t: number): { nivel: number; abajo: number; arriba: number } {
  const y = a.yMedio + a.b * (t - a.tMedio);
  const ee = a.s * Math.sqrt(1 / a.n + (t - a.tMedio) ** 2 / a.sxx);
  return { nivel: Math.exp(y), abajo: Math.exp(y - Z_80 * ee), arriba: Math.exp(y + Z_80 * ee) };
}


/** El ruido de un día a otro en el 1RM (Grgic 2020): 3,3 % en entrenados, 5,5 % con menos de 6 meses. */
export const SIGMA = { entrenado: 3.3, novato: 5.5 };

/**
 * Tu σ: el desvío de tu mejor serie de cada sesión contra su tendencia (en %), que se acerca al de
 * los estudios con el peso de 10 sesiones (derivado).
 */
export function sigmaTuyo(desvios: number[], entrenado: boolean): number {
  const base = entrenado ? SIGMA.entrenado : SIGMA.novato;
  if (!desvios.length) return base;
  const varianza = desvios.reduce((s, d) => s + d * d, 0) / desvios.length;
  return Math.sqrt((desvios.length * varianza + 10 * base * base) / (desvios.length + 10));
}

// ------------------------------------------------------------ estancado y por qué

/** Las semanas de tendencia que hacen falta para hablar de estancamiento. */
export const SEMANAS_PARA_ESTANCADO = 8;
/** El umbral de fábrica de Ascent (sus Ajustes: 2, 3, 6 u 8 semanas sin marca). */
export const UMBRAL_DE_ASCENT = 6;
/** Si un ejercicio está estancado: la tendencia lo dice con 8 semanas o más y ya pasó el umbral de Ascent. */
export const estaEstancado = (t: TendenciaDeFuerza, semanasSinMarca: number, umbral = UMBRAL_DE_ASCENT) =>
  t.estado === 'sinSubidaClara' && t.semanas >= SEMANAS_PARA_ESTANCADO && semanasSinMarca >= umbral;

/** Una semana de entreno de un ejercicio: las series duras del músculo, las veces con el ejercicio y sus series pesadas. */
export type SemanaDeEntreno = {
  lunes: string;
  /** Las series de trabajo del músculo principal del ejercicio, como principal, con todos los ejercicios. */
  series: number;
  /** Cuántas sesiones tuvieron el ejercicio. */
  veces: number;
  /** De las series de trabajo del ejercicio con repeticiones anotadas, las pesadas (80 % del 1RM estimado o más, o 6 repeticiones o menos). */
  pesadas: number;
  conReps: number;
};

/** Pesada: con el 80 % del 1RM estimado o más, o de 6 repeticiones o menos (Lopez 2021; ACSM 2026). */
export const PESADA = 0.8;
export const REPS_PESADAS = 6;

const promedio = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const varianza = (xs: readonly number[]) => {
  const m = promedio(xs);
  return xs.length > 1 ? xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1) : 0;
};

/**
 * Si algo bajó de verdad: de cada lado, 3 semanas o más, y la diferencia pasa dos errores estándar de lo
 * que cambia de una semana a otra en la propia persona, y un mínimo (si todas las semanas son iguales, el
 * error es 0 y cualquier cosa contaría). Devuelve los dos promedios, o null sin datos.
 */
export function bajoDeVerdad(antes: readonly number[], ahora: readonly number[], minimo: number): { antes: number; ahora: number; bajo: boolean } | null {
  if (antes.length < 3 || ahora.length < 3) return null;
  const a = promedio(antes), b = promedio(ahora);
  const ee = Math.sqrt(varianza(antes) / antes.length + varianza(ahora) / ahora.length);
  return { antes: a, ahora: b, bajo: a - b > 2 * ee && a - b >= minimo };
}

/** Lo mínimo que cuenta: 2 series duras por semana y media sesión por semana. */
export const MENOS_SERIES = 2;
export const MENOS_VECES = 0.5;

export type Razon =
  /** Menos series duras por semana del músculo que cuando subía. */
  | { que: 'series'; antes: number; ahora: number }
  /** Menos veces por semana con el ejercicio. */
  | { que: 'frecuencia'; antes: number; ahora: number }
  /** Pocas series pesadas, si buscas fuerza: menos de un tercio. */
  | { que: 'pesadas'; pesadas: number; de: number }
  /** Bajando más de un 1 % del peso por semana. */
  | { que: 'bajando'; porSemana: number }
  /** En definición (objetivo «bajar»), a un ritmo tranquilo: que la fuerza se mantenga ya es un buen resultado. */
  | { que: 'definicion' }
  /** La proteína de estas semanas por debajo de 1,6 g por kilo por día. */
  | { que: 'proteina'; gPorKg: number }
  /** El sueño de estas semanas por debajo de 6 h, o 45 minutos menos que cuando subía. */
  | { que: 'sueno'; ahora: number; antes: number | null };

export type Faltan = 'series' | 'comida' | 'sueno';
export type RazonesDeEstancamiento = {
  razones: Razon[];
  /** «Con años de entrenamiento se sube más lento»: de contexto, no como causa. */
  anios: number | null;
  /** Lo que no se pudo mirar por falta de datos. */
  faltan: Faltan[];
};

export const MAXIMO_DE_RAZONES = 3;
export const POCAS_PESADAS = 1 / 3;
/** Con menos de 6 series con repeticiones en las semanas de ahora, no se dice nada de la carga. */
export const SERIES_PARA_LA_CARGA = 6;
export const BAJANDO_RAPIDO = 1;
export const PROTEINA_POR_KG = 1.6;
/** La comida cuenta en una semana con 4 días anotados o más, y hacen falta 2 de esas semanas. */
export const DIAS_DE_COMIDA = 4;
export const SEMANAS_DE_COMIDA = 2;
export const SUENO_POCO = 6 * 60;
export const SUENO_MENOS = 45;
/** Desde 2 años entrenando se dice el contexto. */
export const ANIOS_DE_CONTEXTO = 2;

/**
 * Las razones de un ejercicio estancado, de la más a la menos sólida: las series duras del músculo, las
 * veces por semana, la carga pesada, bajar rápido (o estar en definición), la proteína y el sueño. Dos o
 * tres como mucho. Con «sin déficit», nada de lo que habla de bajar.
 */
export function razonesDeEstancamiento(p: {
  antes: readonly SemanaDeEntreno[];
  ahora: readonly SemanaDeEntreno[];
  objetivo: 'bajar' | 'mantener' | 'subir';
  sinDeficit?: boolean;
  /** Lo que bajas por semana, en % del peso (positivo es bajar), de la tendencia del peso. */
  bajaSemanal: number | null;
  /** La comida de cada semana de ahora: los días anotados y la proteína promedio de esos días. */
  comida: readonly { dias: number; proteina: number }[];
  pesoKg: number;
  /** Lo dormido en promedio cuando subía y ahora, en minutos (null sin noches). */
  sueno: { antes: number | null; ahora: number | null };
  anios: number | null;
}): RazonesDeEstancamiento {
  const razones: Razon[] = [];
  const faltan: Faltan[] = [];

  const series = bajoDeVerdad(p.antes.map((s) => s.series), p.ahora.map((s) => s.series), MENOS_SERIES);
  if (!series) faltan.push('series');
  else if (series.bajo) razones.push({ que: 'series', antes: series.antes, ahora: series.ahora });
  const veces = bajoDeVerdad(p.antes.map((s) => s.veces), p.ahora.map((s) => s.veces), MENOS_VECES);
  if (veces?.bajo) razones.push({ que: 'frecuencia', antes: veces.antes, ahora: veces.ahora });
  const conReps = p.ahora.reduce((s, x) => s + x.conReps, 0);
  const pesadas = p.ahora.reduce((s, x) => s + x.pesadas, 0);
  if (conReps >= SERIES_PARA_LA_CARGA && pesadas / conReps < POCAS_PESADAS) razones.push({ que: 'pesadas', pesadas, de: conReps });

  if (!p.sinDeficit) {
    if (p.bajaSemanal !== null && p.bajaSemanal > BAJANDO_RAPIDO) razones.push({ que: 'bajando', porSemana: p.bajaSemanal });
    else if (p.objetivo === 'bajar') razones.push({ que: 'definicion' });
  }

  const conComida = p.comida.filter((c) => c.dias >= DIAS_DE_COMIDA);
  if (conComida.length < SEMANAS_DE_COMIDA || p.pesoKg <= 0) faltan.push('comida');
  else {
    const gPorKg = promedio(conComida.map((c) => c.proteina)) / p.pesoKg;
    if (gPorKg < PROTEINA_POR_KG) razones.push({ que: 'proteina', gPorKg });
  }

  if (p.sueno.ahora === null) faltan.push('sueno');
  else if (p.sueno.ahora < SUENO_POCO || (p.sueno.antes !== null && p.sueno.antes - p.sueno.ahora >= SUENO_MENOS)) {
    razones.push({ que: 'sueno', ahora: p.sueno.ahora, antes: p.sueno.antes });
  }

  return { razones: razones.slice(0, MAXIMO_DE_RAZONES), anios: p.anios !== null && p.anios >= ANIOS_DE_CONTEXTO ? p.anios : null, faltan };
}

// ------------------------------------------------------------ tu año

export type GrupoDelAnio = 'pecho' | 'piernas' | 'espalda' | 'brazos';
const DEL_ANIO: Partial<Record<string, GrupoDelAnio>> = { pecho: 'pecho', hombros: 'pecho', piernas: 'piernas', espalda: 'espalda', brazos: 'brazos' };

/**
 * El color de un día en «Tu año»: el grupo de lo que más trabajó (gruposDeLaSesion) en cuatro, el empuje con el
 * pecho (los brazos, desde el 19/11/2026: lo pediste); el core y el cardio solos no dicen de qué día se trata, y se
 * mira el que sigue. Sin ninguno, null.
 */
export function grupoDelAnio(grupos: readonly string[]): GrupoDelAnio | null {
  for (const g of grupos) {
    const delAnio = DEL_ANIO[g];
    if (delAnio) return delAnio;
  }
  return null;
}


/** Los colores de los grupos de «Tu año»: cuatro tonos apagados que se distinguen también con daltonismo. */
export const COLORES_DEL_ANIO = { pecho: '#419ec6', piernas: '#a77e33', espalda: '#765190', brazos: '#b5677d' } as const;
