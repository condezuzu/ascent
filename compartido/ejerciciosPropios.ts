import type { Cliente } from '@cliente';
import { disponible } from '@nucleo/esquema';
import { versionDelEsquema } from '@compartido/esquema';
import { eventos, EJERCICIOS_CAMBIO } from '@compartido/eventos';

/**
 * AGREGAR UN EJERCICIO PROPIO (14/10, migración 76). Devuelve su id, o `null` si
 * no se pudo. Un nombre que la cuenta ya tiene devuelve ese mismo: dos toques no
 * crean dos. Avisa a quien tenga el catálogo cargado para que lo vuelva a pedir.
 */
export async function crearEjercicio(supabase: Cliente, nombre: string, grupo: string): Promise<string | null> {
  if (!disponible('ejerciciosPropios', await versionDelEsquema(supabase).catch(() => null))) return null;
  const { data, error } = await supabase.rpc('crear_ejercicio', { p_nombre: nombre, p_grupo: grupo, p_mide: grupo === 'cardio' ? 'tiempo' : 'series' });
  if (error || typeof data !== 'string') return null;
  eventos.emitir(EJERCICIOS_CAMBIO);
  return data;
}
