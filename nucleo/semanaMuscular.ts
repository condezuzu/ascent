// LO QUE ASCENT LE PASA A LAS CUENTAS DE MÚSCULOS (19/11, spec/musculos-compartido.md de Moss). Las
// sesiones de la semana, ejercicio por ejercicio, con sus músculos del catálogo compartido y cada serie de
// trabajo con sus repeticiones y su RIR: lo que `puntajeMuscular.ts` (copiado tal cual de Moss) recibe.
// Las reglas —la semana son los últimos 7 días, qué serie es de trabajo, el 1RM de referencia de los
// últimos 126 días— son las de ese archivo, no las de Ascent: así las dos apps cuentan igual.

import { DIAS_DEL_E1RM, dentroDeLaSemana, esDeTrabajo, mejorE1rm, type EjercicioHecho } from './puntajeMuscular.ts';

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

/**
 * `sesiones` tiene que traer los últimos DIAS_DEL_E1RM días: de ahí sale el 1RM de referencia de cada ejercicio,
 * y con él se separan las series de trabajo de la entrada en calor. Cuentan solo las de la semana.
 */
export function ejerciciosDeLaSemana(
  sesiones: readonly SesionHecha[],
  hoy: string,
  catalogo: Readonly<Record<string, DelCatalogo>>,
  grupoDePropio: Readonly<Record<string, string>>,
  objetivos: Readonly<Record<string, number>>
): EjercicioHecho[] {
  const recientes = sesiones.filter((s) => diasEntre(s.fecha, hoy) >= 0 && diasEntre(s.fecha, hoy) < DIAS_DEL_E1RM);
  const unoRM = new Map<string, number | null>();
  for (const id of new Set(recientes.flatMap((s) => s.bloques.map((b) => b.ejercicio ?? '')))) {
    unoRM.set(id, mejorE1rm(recientes.flatMap((s) => s.bloques.filter((b) => b.ejercicio === id).flatMap(seriesDe))));
  }
  const salen: EjercicioHecho[] = [];
  for (const s of recientes) {
    if (!dentroDeLaSemana(s.fecha, hoy)) continue;
    for (const b of s.bloques) {
      // El cardio se mide en minutos, no en series.
      if (!b.ejercicio || b.minutos !== undefined || b.series <= 0) continue;
      const delGrupo = GRUPO_A_MUSCULO[grupoDePropio[b.ejercicio] ?? ''];
      const m = catalogo[b.ejercicio] ?? (delGrupo ? { principal: [delGrupo], ayuda: [] } : null);
      if (!m) continue;
      const ref = unoRM.get(b.ejercicio) ?? null;
      salen.push({
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
