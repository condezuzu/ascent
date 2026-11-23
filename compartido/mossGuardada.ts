import { plataforma } from '@plataforma';

// LO ÚLTIMO DE MOSS EN ESTE TELÉFONO (23/11, «que cargue de una»): si la cuenta está vinculada y la sección del día,
// para mostrarlas al instante mientras se pregunta de nuevo. Al entrar a Stats salía un segundo «Vincula Ascent con
// Moss» antes de saber que ya lo estaba. Lleva su dueño adentro, y se borra al salir de la cuenta (`cuenta.ts`): tiene
// datos de sueño y de comida de Moss.
export const CLAVE_MOSS_GUARDADA = 'ascent:moss-ultima';

export type MossGuardada = { uid: string; vinculada: boolean; hoy: string | null; seccion: unknown };

// La sección tiene Map (los músculos, el año): JSON no los sabe guardar solo.
const aTexto = (g: MossGuardada) => JSON.stringify(g, (_k, v) => (v instanceof Map ? { __mapa: [...v] } : v));
const deTexto = (t: string) =>
  JSON.parse(t, (_k, v) => (v && typeof v === 'object' && Array.isArray((v as { __mapa?: unknown }).__mapa) ? new Map((v as { __mapa: [unknown, unknown][] }).__mapa) : v)) as MossGuardada;

export async function leerMossGuardada(uid: string): Promise<MossGuardada | null> {
  try {
    const t = await plataforma.almacenamiento.leer(CLAVE_MOSS_GUARDADA);
    const g = t ? deTexto(t) : null;
    return g?.uid === uid ? g : null;
  } catch {
    return null;
  }
}

const guardar = (g: MossGuardada) => plataforma.almacenamiento.guardar(CLAVE_MOSS_GUARDADA, aTexto(g)).catch(() => undefined);

/** Lo que contestó la base. Sin vínculo, la sección guardada se va con él. */
export async function anotarVinculo(uid: string, vinculada: boolean): Promise<void> {
  const antes = vinculada ? await leerMossGuardada(uid) : null;
  await guardar({ uid, vinculada, hoy: antes?.hoy ?? null, seccion: antes?.seccion ?? null });
}

export async function anotarSeccion(uid: string, hoy: string, seccion: unknown): Promise<void> {
  await guardar({ uid, vinculada: true, hoy, seccion });
}
