import type { Cliente } from '@cliente';
import { plataforma } from '@plataforma';
import { disponible } from '@nucleo/esquema';
import { rutinaPorDia } from '@nucleo/rutina';
import { diasLimpios, hayAlgo, semanaDeLaDeducida, type DiaDeSemana, type Rutina } from '@nucleo/rutinas';
import { versionDelEsquema } from '@compartido/esquema';
import { leerPerfilCache } from '@compartido/cache';

/**
 * LAS RUTINAS, del lado del teléfono (14/10). Las reglas viven en
 * `nucleo/rutinas.ts`; acá están los viajes a la base.
 *
 * Con la base anterior a la 75 no hay rutinas guardadas: se ve la deducida del
 * historial y nada más.
 */

export type DatoDeEjercicio = { nombre: string; grupo: string | null; mide: 'series' | 'tiempo' };
export type CatalogoDeRutina = Map<string, DatoDeEjercicio>;

export async function hayRutinasGuardadas(supabase: Cliente): Promise<boolean> {
  return disponible('rutinas', await versionDelEsquema(supabase).catch(() => null));
}

/** Nombre, grupo y si se mide en tiempo, de cada ejercicio que la cuenta puede ver. */
export async function catalogoDeRutina(supabase: Cliente): Promise<CatalogoDeRutina> {
  const { data } = await supabase.from('ejercicios').select('*');
  return new Map(
    ((data ?? []) as { id: string; nombre: string; grupo?: string | null; mide?: string | null }[]).map((e) => [
      e.id,
      { nombre: e.nombre, grupo: e.grupo ?? null, mide: e.mide === 'tiempo' ? 'tiempo' : 'series' },
    ])
  );
}

// LA ACTIVA, GUARDADA EN EL TELÉFONO: la sesión arranca con ella aunque no haya
// señal. Es de UNA cuenta: con otra en el mismo teléfono no se lee.
const CLAVE_ACTIVA = 'ascent:rutina-activa';

async function guardarActiva(rutinas: Rutina[]) {
  const de = (await leerPerfilCache())?.id;
  if (!de) return;
  const activa = rutinas.find((r) => r.activa) ?? null;
  await plataforma.almacenamiento.guardar(CLAVE_ACTIVA, JSON.stringify({ de, dias: activa?.dias ?? null })).catch(() => undefined);
}

/** La rutina activa que el teléfono tiene guardada, o `null`. Sin red. */
export async function rutinaActivaDelTelefono(): Promise<{ dias: DiaDeSemana[] } | null> {
  try {
    const de = (await leerPerfilCache())?.id;
    const crudo = await plataforma.almacenamiento.leer(CLAVE_ACTIVA);
    if (!de || !crudo) return null;
    const g = JSON.parse(crudo) as { de?: unknown; dias?: unknown };
    return g.de === de && g.dias ? { dias: diasLimpios(g.dias) } : null;
  } catch {
    return null;
  }
}

/** Mis rutinas, o `null` si no se pudo (o la base todavía no las tiene). */
export async function cargarMisRutinas(supabase: Cliente): Promise<Rutina[] | null> {
  if (!disponible('rutinas', await versionDelEsquema(supabase).catch(() => null))) return null;
  const { data, error } = await supabase.rpc('mis_rutinas');
  if (error || !Array.isArray(data)) return null;
  const rutinas = (data as { id: string; nombre: string; activa: boolean; dias: unknown }[]).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    activa: r.activa === true,
    dias: diasLimpios(r.dias),
  }));
  await guardarActiva(rutinas);
  return rutinas;
}

/** Sin `id` crea una nueva. Devuelve el id, o `null` si no se guardó. */
export async function guardarRutina(supabase: Cliente, r: { id: string | null; nombre: string; dias: DiaDeSemana[] }): Promise<string | null> {
  if (!disponible('rutinas', await versionDelEsquema(supabase).catch(() => null))) return null;
  const { data, error } = await supabase.rpc('guardar_rutina', { p_id: r.id, p_nombre: r.nombre, p_dias: r.dias });
  return error || typeof data !== 'string' ? null : data;
}

export async function activarRutina(supabase: Cliente, id: string): Promise<boolean> {
  if (!disponible('rutinas', await versionDelEsquema(supabase).catch(() => null))) return false;
  return !(await supabase.rpc('activar_rutina', { p_id: id })).error;
}

/**
 * COPIAR LA RUTINA DE UN AMIGO (15/10): queda guardada como tuya y activa, y se
 * devuelve cuál estaba activa antes, para poder volver con un toque.
 */
export async function copiarRutina(
  supabase: Cliente,
  nombre: string,
  dias: DiaDeSemana[]
): Promise<{ nueva: string; anterior: { id: string; nombre: string } | null } | null> {
  const antes = (await cargarMisRutinas(supabase))?.find((r) => r.activa) ?? null;
  const nueva = await guardarRutina(supabase, { id: null, nombre, dias });
  if (!nueva || !(await activarRutina(supabase, nueva))) return null;
  await cargarMisRutinas(supabase);
  return { nueva, anterior: antes ? { id: antes.id, nombre: antes.nombre } : null };
}

export async function borrarRutina(supabase: Cliente, id: string): Promise<boolean> {
  if (!disponible('rutinas', await versionDelEsquema(supabase).catch(() => null))) return false;
  return !(await supabase.rpc('borrar_rutina', { p_id: id })).error;
}

/**
 * LA RUTINA DE ALGUIEN PARA MIRARLA (la mía o la de un amigo). Primero la
 * activa guardada; si no tiene, la deducida de sus últimas cuatro semanas.
 *
 * - `deducida`: no es una guardada, es la que sale del historial.
 * - `escondida`: es de un amigo que la escondió (no se dibuja nada).
 * - `null`: no se pudo preguntar.
 */
export type RutinaParaVer = { nombre: string | null; dias: DiaDeSemana[]; deducida: boolean; escondida: boolean };

export async function cargarRutinaParaVer(supabase: Cliente, quien: string, esYo: boolean): Promise<RutinaParaVer | null> {
  const version = await versionDelEsquema(supabase).catch(() => null);
  if (disponible('rutinas', version)) {
    const { data, error } = await supabase.rpc('rutina_activa_de', { p_quien: quien });
    if (error) return null;
    const g = data as { nombre?: string; dias?: unknown } | null;
    if (g?.dias) return { nombre: g.nombre ?? null, dias: diasLimpios(g.dias), deducida: false, escondida: false };
  }
  if (!disponible('rutinaDeAmigo', version)) return { nombre: null, dias: diasLimpios(null), deducida: true, escondida: !esYo };
  const { data: filas, error } = await supabase.rpc('rutina_de_amigo', { p_quien: quien });
  if (error) return null;
  const sesiones = ((filas ?? []) as { fecha: string; bloques: { ejercicio: string; series: number | null }[] | null }[]).map((f) => ({
    fecha: f.fecha,
    bloques: f.bloques ?? [],
  }));
  const dias = semanaDeLaDeducida(rutinaPorDia(sesiones));
  if (esYo || hayAlgo(dias)) return { nombre: null, dias, deducida: true, escondida: false };
  // Vacía: ¿la escondió, o no tiene datos? Solo contesta que sí a un amigo que la muestra.
  if (!disponible('entrenarConOtro', version)) return { nombre: null, dias, deducida: true, escondida: true };
  const { data: muestra, error: eMuestra } = await supabase.rpc('me_muestra_su_rutina', { p_quien: quien });
  return { nombre: null, dias, deducida: true, escondida: eMuestra ? true : muestra !== true };
}
