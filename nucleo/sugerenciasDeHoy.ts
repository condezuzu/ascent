// Las sugerencias para hoy de la sección de músculos, IGUALES EN MOSS Y EN ASCENT (spec/musculos-compartido.md):
// una de entrenamiento, una de comida y una de sueño, todos los días. Las reglas salen de
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
  /** A qué hora acostarte esta noche, en minutos desde la medianoche (el periodo de melatonina de Moss). */
  acostarse: number | null;
  /** Lo comido ayer contra la meta de ayer; sin datos, null. */
  ayer: { kcal: number; proteina: number; metaKcal: number; metaProteina: number } | null;
  /** Con un trastorno de la alimentación marcado: nada de calorías ni de «comiste menos». */
  cuidadoConLaComida: boolean;
};

export type Sugerencia = {
  clave: string;
  musculos?: readonly string[];
  fatigados?: readonly string[];
  /** Las repeticiones de cada serie y cuántas dejar en reserva, como texto («8 a 12», «1 o 2»). */
  reps?: string;
  reserva?: string;
  hora?: number;
  gramos?: number;
};
export type SugerenciasDeHoy = { entreno: Sugerencia; comida: Sugerencia; sueno: Sugerencia };

/** Una noche corta: 6 h o menos, o despertarte 1 h o más antes de lo de siempre (Craven 2022; Kong 2025). */
export const NOCHE_CORTA = 6 * 60;
export const DESPERTO_ANTES = 60;
/** Desde 45 minutos, los carbohidratos antes suben el volumen (King 2022). */
export const SESION_LARGA = 45;
/** Ayer faltó si quedó por debajo del 80 % de la meta; llegó si pasó el 90 %. */
export const FALTO = 0.8;
export const LLEGO = 0.9;
/** La proteína de cada comida cuando faltó (unos 0,3 g/kg en 3 o 4 comidas; Schoenfeld y Aragon 2018). */
export const PROTEINA_POR_COMIDA = 30;
/**
 * Para crecer, el peso casi no importa si se llega cerca del fallo (del 30 al 100 % del máximo); para la fuerza máxima
 * hace falta peso alto (80 % o más): ACSM 2026, Currier 2023, Lopez 2021, Lasevicius 2018. La reserva, cerca del fallo
 * para crecer y un poco más lejos para la fuerza (Robinson 2024; Grgic 2022).
 */
export const SERIES_SEGUN = { musculo: { reps: '8 a 12', reserva: '1 o 2' }, fuerza: { reps: '3 a 6', reserva: '2 o 3' } } as const;

const nocheCorta = (n: EntradaDeHoy['noche']) => !!n && (n.dormido <= NOCHE_CORTA || (n.despertoAntes ?? 0) >= DESPERTO_ANTES);

export function sugerenciasDeHoy(e: EntradaDeHoy): SugerenciasDeHoy {
  // Entrenamiento: la sesión de hoy, con el sueño y la fatiga primero; sin sesión, el descanso (moverse suave está
  // bien, no acelera la recuperación pero tampoco le quita: Dupuy 2018).
  let entreno: Sugerencia;
  if (!e.sesion) entreno = { clave: 'descanso' };
  else if (e.sesion.hecha) entreno = { clave: 'hecha' };
  else if (nocheCorta(e.noche)) entreno = { clave: 'nocheCorta', musculos: e.sesion.musculos };
  else if (e.sinRecuperar.length) entreno = { clave: 'conFatiga', musculos: e.sesion.musculos, fatigados: e.sinRecuperar };
  else entreno = { clave: 'entrenar', musculos: e.sesion.musculos, ...SERIES_SEGUN[e.objetivo] };

  // Comida: nunca compensar lo de ayer (Cioffi 2018); la proteína, la de siempre en cada comida (Burd 2011).
  let comida: Sugerencia;
  const larga = !!e.sesion && !e.sesion.hecha && e.sesion.minutos >= SESION_LARGA;
  const a = e.ayer;
  if (e.cuidadoConLaComida) comida = { clave: 'cuidado' };
  else if (a && a.metaProteina > 0 && a.proteina < FALTO * a.metaProteina) comida = { clave: 'faltoProteina', gramos: PROTEINA_POR_COMIDA };
  else if (a && a.metaKcal > 0 && a.kcal < FALTO * a.metaKcal) comida = { clave: 'comioMenos' };
  else if (larga) comida = { clave: 'carbos' };
  else if (a && a.kcal >= LLEGO * a.metaKcal && a.proteina >= LLEGO * a.metaProteina) comida = { clave: 'ayerBien' };
  else comida = { clave: a ? 'normal' : 'sinDatos' };

  // Sueño: lo que mejora el rendimiento es dormir varias noches a tu hora; una noche larga no alcanza.
  const hora = e.acostarse ?? undefined;
  const conHora = (clave: string): Sugerencia => (hora === undefined ? { clave: clave + 'SinHora' } : { clave, hora });
  let sueno: Sugerencia;
  if (!e.noche) sueno = hora === undefined ? { clave: 'sinDatos' } : { clave: 'soloHora', hora };
  else if (nocheCorta(e.noche)) sueno = conHora('dormistePoco');
  else if (e.deuda === 'media' || e.deuda === 'alta') sueno = conHora('deuda');
  else sueno = conHora('bien');

  return { entreno, comida, sueno };
}
