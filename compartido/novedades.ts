import type { Cliente } from '@cliente';
import type { Novedad } from '@nucleo/novedades';
import { traerUniones } from '@compartido/enVivo';

/**
 * Los pedidos que esperan respuesta MÍA: solicitudes de amistad y pedidos de
 * unirse a mi entrenamiento. `null` = no se pudo preguntar (no se muestra nada).
 */
export async function traerNovedades(supabase: Cliente, uid: string): Promise<Novedad[] | null> {
  const { data: pedidos, error } = await supabase
    .from('friendships')
    .select('id, solicitante')
    .eq('destinatario', uid)
    .eq('estado', 'pendiente');
  if (error) return null;
  const ids = (pedidos ?? []).map((p) => p.solicitante as string);
  const { data: gente, error: eGente } = ids.length
    ? await supabase.from('usuarios_publicos').select('id, username, avatar_url').in('id', ids)
    : { data: [], error: null };
  if (eGente) return null;
  const quien = new Map((gente ?? []).map((g) => [g.id as string, g as Novedad['otro']]));
  const amistades: Novedad[] = (pedidos ?? []).flatMap((p) => {
    const otro = quien.get(p.solicitante as string);
    return otro ? [{ tipo: 'amistad' as const, id: p.id as string, otro }] : [];
  });
  const u = await traerUniones(supabase);
  const uniones: Novedad[] = (u?.uniones ?? [])
    .filter((x) => x.estado === 'pendiente' && !x.laPediYo)
    .map((x) => ({ tipo: 'union' as const, id: x.id, otro: { id: x.otro.id, username: x.otro.username, avatar_url: x.otro.avatar_url } }));
  // Unirse primero: se contesta mientras se entrena, la amistad puede esperar.
  return [...uniones, ...amistades];
}
