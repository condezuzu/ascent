import type { SupabaseClient } from '@supabase/supabase-js';
import type { Perfil } from '@/lib/tipos';

/**
 * Guarda una preferencia del perfil pintándola YA en pantalla y volviendo
 * atrás sola si la base la rechaza.
 *
 * El optimismo es la parte importante: son botones de un toque y esperar el
 * viaje de red los deja medio segundo sin responder, que se siente roto.
 * Solo sirve para las columnas que el cliente tiene permitido escribir
 * (§4: username, avatar_url, visibilidad_default, unidad_peso, sexo); las
 * demás las rechaza el grant por columna, no la RLS.
 */
export async function guardarPreferencia<K extends keyof Perfil>(
  supabase: SupabaseClient,
  perfil: Perfil,
  campo: K,
  valor: Perfil[K],
  alCambiar: (parcial: Partial<Perfil>) => void
): Promise<boolean> {
  const antes = perfil[campo];
  alCambiar({ [campo]: valor } as Partial<Perfil>);
  const { error } = await supabase
    .from('profiles')
    .update({ [campo]: valor })
    .eq('id', perfil.id);
  if (error) {
    alCambiar({ [campo]: antes } as Partial<Perfil>);
    return false;
  }
  return true;
}
