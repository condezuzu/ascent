// Las sugerencias para hoy de la sección de músculos, IGUALES EN MOSS Y EN ASCENT (spec/musculos-compartido.md):
// una de entrenamiento (salvo que ya hayas entrenado: ahí no va), una de comida y una de sueño, todos los días
// (lo pidió el dueño el 23/11/2026: en qué macros enfocarte según lo registrado, y cuántas horas dormir). Las reglas salen de
// spec/estudio/sugerencias-de-hoy.md. Como puntajeMuscular.ts, se copia tal cual en las dos apps, no importa nada y sus
// casos están en sugerenciasDeHoy.casos.json. Devuelve la clave del texto y sus datos: cada app pone sus palabras.

export type Objetivo = 'musculo' | 'fuerza';

export type EntradaDeHoy = {
  /** La sesión de hoy (la de la rutina, o ya hecha), con sus músculos principales; sin sesión, null. */
  sesion: { musculos: readonly string[]; minutos: number; hecha: boolean } | null;
  /** De los músculos de la sesión de hoy, los que todavía no están listos (la fatiga en días). */
  sinRecuperar: readonly string[];
  objetivo: Objetivo;
  /** La noche de anoche, en minutos dormidos, y cuánto antes de lo de siempre te despertaste. */
  noche: { dormido: number; despertoAntes: number | null } | null;
  deuda: 'sinDeuda' | 'baja' | 'media' | 'alta' | null;
  /** Cuánto necesitas dormir, en minutos: lo que elegiste o lo de fábrica. */
  necesidad: number;
  /** A qué hora acostarte esta noche, en minutos desde la medianoche (el periodo de melatonina de Moss). */
  acostarse: number | null;
  /** Lo comido ayer contra la meta de ayer, con los tres macros; sin datos, null. */
  ayer: {
    kcal: number; proteina: number; carbohidratos: number; grasas: number;
    metaKcal: number; metaProteina: number; metaCarbohidratos: number; metaGrasas: number;
  } | null;
  /** Con un trastorno de la alimentación marcado: nada de calorías ni de «comiste menos». */
  cuidadoConLaComida: boolean;
};

export type Macro = 'proteina' | 'carbohidratos' | 'grasas';

export type Sugerencia = {
  clave: string;
  musculos?: readonly string[];
  fatigados?: readonly string[];
  /** Las repeticiones de cada serie y cuántas dejar en reserva, de cuánto a cuánto: el «a» y el «o» los pone cada idioma. */
  reps?: readonly [number, number];
  reserva?: readonly [number, number];
  hora?: number;
  /** En qué macros enfocarte hoy, del que más faltó al que menos. */
  macros?: readonly Macro[];
  /** Cuánto dormir esta noche, en minutos. */
  minutos?: number;
};
/** `entreno` es null si ya entrenaste hoy: quedan la comida y el sueño. */
export type SugerenciasDeHoy = { entreno: Sugerencia | null; comida: Sugerencia; sueno: Sugerencia };

/** Una noche corta: 6 h o menos, o despertarte 1 h o más antes de lo de siempre (Craven 2022; Kong 2025). */
export const NOCHE_CORTA = 6 * 60;
export const DESPERTO_ANTES = 60;
/** Ayer faltó un macro si quedó por debajo del 80 % de su meta. Se nombran como mucho dos, del que más faltó. */
export const FALTO = 0.8;
export const MACROS_A_LA_VEZ = 2;
/**
 * Sin que falte nada (o sin datos), lo que ayuda a recuperarse: proteína siempre, y carbohidratos el día que se
 * entrena (para rendir y reponer el glucógeno; Burd 2011, King 2022). Nunca compensar lo de ayer (Cioffi 2018).
 */
const PARA_RECUPERAR = { entrena: ['proteina', 'carbohidratos'], descansa: ['proteina'] } as const;
/**
 * Lo que se duerme de más para bajar la deuda, varias noches: una falta de ~1 h por noche se recuperó en ~4 noches
 * largas (Kitamura 2016), y más de ~1 h extra casi no se logra (Harrison y Horne 1996). Después de una noche corta,
 * media hora más.
 */
export const DE_MAS_SEGUN_LA_DEUDA = { media: 30, alta: 60 } as const;
export const DE_MAS_NOCHE_CORTA = 30;
/**
 * Para crecer, el peso casi no importa si se llega cerca del fallo (del 30 al 100 % del máximo); para la fuerza máxima
 * hace falta peso alto (80 % o más): ACSM 2026, Currier 2023, Lopez 2021, Lasevicius 2018. La reserva, cerca del fallo
 * para crecer y un poco más lejos para la fuerza (Robinson 2024; Grgic 2022).
 */
export const SERIES_SEGUN = { musculo: { reps: [8, 12], reserva: [1, 2] }, fuerza: { reps: [3, 6], reserva: [2, 3] } } as const;

const nocheCorta = (n: EntradaDeHoy['noche']) => !!n && (n.dormido <= NOCHE_CORTA || (n.despertoAntes ?? 0) >= DESPERTO_ANTES);

export function sugerenciasDeHoy(e: EntradaDeHoy): SugerenciasDeHoy {
  // Entrenamiento: la sesión de hoy, con el sueño y la fatiga primero; sin sesión, el descanso (moverse suave está
  // bien, no acelera la recuperación pero tampoco le quita: Dupuy 2018).
  let entreno: Sugerencia | null;
  if (!e.sesion) entreno = { clave: 'descanso' };
  else if (e.sesion.hecha) entreno = null;
  else if (nocheCorta(e.noche)) entreno = { clave: 'nocheCorta', musculos: e.sesion.musculos };
  else if (e.sinRecuperar.length) entreno = { clave: 'conFatiga', musculos: e.sesion.musculos, fatigados: e.sinRecuperar };
  else entreno = { clave: 'entrenar', musculos: e.sesion.musculos, ...SERIES_SEGUN[e.objetivo] };

  // Comida: en qué macros enfocarte hoy. Los que ayer quedaron bajo su meta, del que más faltó; si no faltó nada o no
  // hay datos, lo que ayuda a recuperarse. Con un trastorno de la alimentación marcado, nada de macros.
  let comida: Sugerencia;
  const a = e.ayer;
  if (e.cuidadoConLaComida) comida = { clave: 'cuidado' };
  else {
    const de = (m: Macro) => (a ? { proteina: [a.proteina, a.metaProteina], carbohidratos: [a.carbohidratos, a.metaCarbohidratos], grasas: [a.grasas, a.metaGrasas] }[m] : [0, 0]);
    const parte = (m: Macro) => de(m)[0] / de(m)[1];
    const faltaron = (['proteina', 'carbohidratos', 'grasas'] as const)
      .filter((m) => de(m)[1] > 0 && de(m)[0] < FALTO * de(m)[1])
      .sort((x, y) => parte(x) - parte(y))
      .slice(0, MACROS_A_LA_VEZ);
    comida = faltaron.length ? { clave: 'faltaron', macros: faltaron } : { clave: 'recuperar', macros: PARA_RECUPERAR[e.sesion ? 'entrena' : 'descansa'] };
  }

  // Sueño: cuántas horas y a qué hora. Lo que mejora el rendimiento es dormir más varias noches a tu hora; una noche
  // larga no alcanza.
  const hora = e.acostarse ?? undefined;
  const corta = nocheCorta(e.noche);
  const deMas = Math.max(corta ? DE_MAS_NOCHE_CORTA : 0, e.deuda === 'media' || e.deuda === 'alta' ? DE_MAS_SEGUN_LA_DEUDA[e.deuda] : 0);
  const minutos = e.necesidad + deMas;
  const conHora = (clave: string): Sugerencia => (hora === undefined ? { clave: clave + 'SinHora', minutos } : { clave, hora, minutos });
  let sueno: Sugerencia;
  if (!e.noche) sueno = hora === undefined ? { clave: 'sinDatos', minutos } : { clave: 'soloHora', hora, minutos };
  else if (corta) sueno = conHora('dormistePoco');
  else if (e.deuda === 'media' || e.deuda === 'alta') sueno = conHora('deuda');
  else sueno = conHora('bien');

  return { entreno, comida, sueno };
}
