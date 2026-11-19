// LO QUE ASCENT LE PASA A LAS CUENTAS DE MÚSCULOS (19/11, spec/musculos-compartido.md de Moss). Las
// sesiones de la semana, ejercicio por ejercicio, con sus músculos del catálogo compartido y cada serie de
// trabajo con sus repeticiones y su RIR: lo que `puntajeMuscular.ts` (copiado tal cual de Moss) recibe.
// Las reglas —la semana son los últimos 7 días, qué serie es de trabajo, el 1RM de referencia de los
// últimos 126 días— son las de ese archivo, no las de Ascent: así las dos apps cuentan igual.

import { DE_PIERNAS, DE_TRABAJO, DIAS_DEL_E1RM, dentroDeLaSemana, esDeTrabajo, mejorE1rm, type EjercicioHecho, type MusculoEnLaSesion } from './puntajeMuscular.ts';
import { PESADA, REPS_PESADAS, type SemanaDeEntreno } from './progresoCompartido.ts';
import { restarDias } from './fechas.ts';
import { lunesDe } from './volumen.ts';

export type DelCatalogo = { principal: string[]; ayuda: string[]; parte?: string };
export type BloqueHecho = { ejercicio: string | null; series: number; minutos?: number; pesos?: (number | null)[]; reps?: (number | null)[]; rir?: (number | null)[] };
export type SesionHecha = { fecha: string; bloques: BloqueHecho[] };

/** Un ejercicio propio no está en el catálogo: su grupo de Ascent, como músculo principal y sin ayuda. */
export const GRUPO_A_MUSCULO: Record<string, string> = {
  pecho: 'pecho',
  espalda: 'dorsales',
  hombros: 'hombros',
  brazos: 'biceps',
  piernas: 'cuadriceps',
  core: 'abdomen',
};

const diasEntre = (desde: string, hasta: string) => (Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86400000;
const seriesDe = (b: BloqueHecho) => Array.from({ length: b.series }, (_, i) => ({ peso: b.pesos?.[i] ?? 0, reps: b.reps?.[i] ?? null, rir: b.rir?.[i] ?? null }));

/** Un ejercicio de la semana: lo que reciben las cuentas, más de qué ejercicio y de qué día es (para el detalle). */
export type EjercicioDeLaSemana = EjercicioHecho & { id: string; fecha: string };

const musculosDe = (id: string, catalogo: Readonly<Record<string, DelCatalogo>>, grupoDePropio: Readonly<Record<string, string>>): DelCatalogo | null => {
  const delGrupo = GRUPO_A_MUSCULO[grupoDePropio[id] ?? ''];
  return catalogo[id] ?? (delGrupo ? { principal: [delGrupo], ayuda: [] } : null);
};

/**
 * Las sesiones de los últimos DIAS_DEL_E1RM días, ejercicio por ejercicio, con solo sus series de trabajo: de ahí
 * sale el 1RM de referencia de cada uno, que separa las de trabajo de la entrada en calor. Más viejas, no entran.
 */
export function ejerciciosRecientes(
  sesiones: readonly SesionHecha[],
  hoy: string,
  catalogo: Readonly<Record<string, DelCatalogo>>,
  grupoDePropio: Readonly<Record<string, string>>,
  objetivos: Readonly<Record<string, number>>
): EjercicioDeLaSemana[] {
  const recientes = sesiones.filter((s) => diasEntre(s.fecha, hoy) >= 0 && diasEntre(s.fecha, hoy) < DIAS_DEL_E1RM);
  const unoRM = new Map<string, number | null>();
  for (const id of new Set(recientes.flatMap((s) => s.bloques.map((b) => b.ejercicio ?? '')))) {
    unoRM.set(id, mejorE1rm(recientes.flatMap((s) => s.bloques.filter((b) => b.ejercicio === id).flatMap(seriesDe))));
  }
  const salen: EjercicioDeLaSemana[] = [];
  for (const s of recientes) {
    for (const b of s.bloques) {
      // El cardio se mide en minutos, no en series.
      if (!b.ejercicio || b.minutos !== undefined || b.series <= 0) continue;
      const m = musculosDe(b.ejercicio, catalogo, grupoDePropio);
      if (!m) continue;
      const ref = unoRM.get(b.ejercicio) ?? null;
      salen.push({
        id: b.ejercicio,
        fecha: s.fecha,
        principal: m.principal,
        ayuda: m.ayuda,
        ...(m.parte ? { parte: m.parte } : {}),
        objetivo: objetivos[b.ejercicio] ?? null,
        series: seriesDe(b)
          .filter((x) => esDeTrabajo(x, ref))
          .map(({ reps, rir }) => ({ reps, rir })),
      });
    }
  }
  return salen;
}

/** Los de la semana (los últimos 7 días contando hoy): lo que cuentan las barras y el cuerpo. */
export function ejerciciosDeLaSemana(
  sesiones: readonly SesionHecha[],
  hoy: string,
  catalogo: Readonly<Record<string, DelCatalogo>>,
  grupoDePropio: Readonly<Record<string, string>>,
  objetivos: Readonly<Record<string, number>>
): EjercicioDeLaSemana[] {
  return ejerciciosRecientes(sesiones, hoy, catalogo, grupoDePropio, objetivos).filter((e) => dentroDeLaSemana(e.fecha, hoy));
}

/** Las sesiones de un ejercicio, de la más vieja a la más nueva: lo que pide `proximaSesion`. */
export function sesionesDelEjercicio(recientes: readonly EjercicioDeLaSemana[], id: string) {
  return recientes
    .filter((e) => e.id === id)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((e) => ({ series: e.series }));
}

/** La rutina activa, día por día, como la reciben las cuentas: cada ejercicio con sus series planeadas. */
export function diasDeLaRutina(
  dias: readonly { descanso: boolean; ejercicios: readonly { ejercicio: string; series: number; reps?: number; minutos?: number }[] }[],
  catalogo: Readonly<Record<string, DelCatalogo>>,
  grupoDePropio: Readonly<Record<string, string>>
): EjercicioHecho[][] {
  return dias
    .filter((d) => !d.descanso)
    .map((d) =>
      d.ejercicios.flatMap((e) => {
        const m = e.minutos === undefined ? musculosDe(e.ejercicio, catalogo, grupoDePropio) : null;
        // Planeadas: cada serie llega al objetivo (sin objetivo, cuenta igual: `esDura`).
        return m ? [{ principal: m.principal, ayuda: m.ayuda, ...(m.parte ? { parte: m.parte } : {}), objetivo: e.reps ?? null, series: Array.from({ length: e.series }, () => ({ reps: e.reps ?? null })) }] : [];
      })
    );
}

/**
 * Lo que pide la fatiga de Moss (`listoEl`): por músculo, cada sesión en que fue principal, con sus series de trabajo,
 * la reserva más baja anotada y si lo trabajó un multiarticular de piernas o espalda baja. `nuevo` va en false: hacen
 * falta 26 semanas de historia y Ascent mira 18.
 */
export function musculosEnSesiones(recientes: readonly EjercicioDeLaSemana[], catalogo: Readonly<Record<string, DelCatalogo & { multiarticular?: boolean }>>): Map<string, MusculoEnLaSesion[]> {
  const porDia = new Map<string, MusculoEnLaSesion>();
  for (const e of recientes) {
    if (!e.series.length) continue;
    for (const m of e.principal) {
      const clave = `${m}|${e.fecha}`;
      const x = porDia.get(clave) ?? { fecha: e.fecha, series: 0, rirMinimo: null, multiarticularDePiernas: false, nuevo: false };
      x.series += e.series.length;
      for (const s of e.series) if (s.rir != null) x.rirMinimo = x.rirMinimo === null ? s.rir : Math.min(x.rirMinimo, s.rir);
      if (catalogo[e.id]?.multiarticular && (DE_PIERNAS as readonly string[]).includes(m)) x.multiarticularDePiernas = true;
      porDia.set(clave, x);
    }
  }
  const r = new Map<string, MusculoEnLaSesion[]>();
  for (const [clave, x] of porDia) {
    const m = clave.split('|')[0];
    r.set(m, [...(r.get(m) ?? []), x].sort((a, b) => a.fecha.localeCompare(b.fecha)));
  }
  return r;
}

/** Los grupos de Ascent de un día (todos los bloques del día, de todas sus sesiones), del que más series tuvo al que menos; si empatan, el que apareció antes. Lo que pide `grupoDelAnio`. */
export function gruposDelDia(bloques: readonly BloqueHecho[], grupoDe: Readonly<Record<string, string>>): string[] {
  const series = new Map<string, number>();
  for (const b of bloques) {
    const g = b.ejercicio ? grupoDe[b.ejercicio] : undefined;
    // Como gruposDeLaSesion de Moss: todas las series anotadas, con un mínimo de 1 por ejercicio.
    if (g) series.set(g, (series.get(g) ?? 0) + Math.max(1, b.series));
  }
  return [...series].sort((a, b) => b[1] - a[1]).map(([g]) => g);
}

/** «Cuando subía»: las 6 semanas (sus lunes) hasta la de la mejor marca, y las de después hasta esta (semanasParaLasRazones de Moss). */
export function semanasParaLasRazones(mejor: string, hoy: string): { antes: string[]; ahora: string[] } {
  const lunes = lunesDe(mejor);
  const antes = Array.from({ length: 6 }, (_, i) => restarDias(lunes, 7 * (5 - i)));
  const ahora: string[] = [];
  for (let l = restarDias(lunes, -7); l <= lunesDe(hoy); l = restarDias(l, -7)) ahora.push(l);
  return { antes, ahora };
}

/**
 * Una semana de un ejercicio para las razones (semanaDeEntreno de Moss): las series de trabajo del músculo como
 * principal, con todos sus ejercicios; las sesiones con el ejercicio, y sus series pesadas. El 1RM es el de la mejor
 * serie de ese día, así la entrada en calor tampoco cuenta.
 */
export function semanaDeEntreno(
  sesiones: readonly SesionHecha[],
  lunes: string,
  id: string,
  musculo: string,
  catalogo: Readonly<Record<string, DelCatalogo>>,
  grupoDePropio: Readonly<Record<string, string>>
): SemanaDeEntreno {
  const fin = restarDias(lunes, -7);
  let series = 0, veces = 0, pesadas = 0, conReps = 0;
  for (const s of sesiones) {
    if (s.fecha < lunes || s.fecha >= fin) continue;
    if (s.bloques.some((b) => b.ejercicio === id)) veces++;
    for (const b of s.bloques) {
      if (!b.ejercicio) continue;
      const xs = seriesDe(b);
      const mejor = mejorE1rm(xs);
      if (musculosDe(b.ejercicio, catalogo, grupoDePropio)?.principal.includes(musculo)) series += xs.filter((x) => esDeTrabajo(x, mejor)).length;
      if (b.ejercicio !== id) continue;
      for (const x of xs) {
        if (x.reps === null || x.peso <= 0 || (mejor && x.peso < DE_TRABAJO * mejor)) continue;
        conReps++;
        if (x.reps <= REPS_PESADAS || (mejor !== null && x.peso >= PESADA * mejor)) pesadas++;
      }
    }
  }
  return { lunes, series, veces, pesadas, conReps };
}
