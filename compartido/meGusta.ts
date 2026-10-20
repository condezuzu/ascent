import type { Cliente } from '@cliente';
import { anotar } from '@compartido/bitacora';

/**
 * EL CORAZÓN DE LAS RUTINAS (migración 92, 20/10).
 *
 * Cuántos corazones tiene una rutina y si uno es de quien mira. Quién lo dio no llega
 * nunca: la base no lo devuelve. Sin la migración vuelve `null` y el corazón no se dibuja.
 */
export type MeGusta = { cantidad: number; mio: boolean };

// PostgREST cuando la función no existe: la migración 92 todavía no se pegó.
const NO_EXISTE = 'PGRST202';

export async function meGustaDeRutina(supabase: Cliente, rutina: string): Promise<MeGusta | null> {
  const { data, error } = await supabase.rpc('me_gusta_de_rutina', { p_rutina: rutina });
  if (error) {
    // Sin la migración no es una falla: todavía no hay corazones. Lo otro queda en la bitácora.
    if (error.code !== NO_EXISTE) void anotar('me gusta: no se pudo leer', { codigo: error.code ?? null });
    return null;
  }
  const fila = (data as MeGusta[] | null)?.[0];
  return fila ? { cantidad: fila.cantidad, mio: fila.mio } : null;
}

/** Da o saca el corazón (dice cuál: dos toques con el mismo pedido dejan lo mismo). `null` si no se pudo. */
export async function marcarMeGustaRutina(supabase: Cliente, rutina: string, mio: boolean): Promise<MeGusta | null> {
  // Sin la función (PGRST202) no se llega acá: el corazón no se muestra.
  const { data, error } = await supabase.rpc('marcar_me_gusta_rutina', { p_rutina: rutina, p_mio: mio });
  if (error) return null;
  const fila = (data as MeGusta[] | null)?.[0];
  return fila ? { cantidad: fila.cantidad, mio: fila.mio } : null;
}
