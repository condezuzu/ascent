import type { SupabaseClient } from '@supabase/supabase-js';
import { eventos } from '@/plataforma/eventos';

/**
 * LO QUE TE ESTÁ ESPERANDO Y NO TE ENTERASTE.
 *
 * EL BUG: un amigo mandó una solicitud y no había forma de saberlo. La
 * pantalla de Ranking la muestra arriba de todo —bien— pero solo la ve quien
 * entra, y no hay ningún motivo para entrar si no sabés que hay algo. Una
 * notificación que solo se ve cuando ya la buscaste no es una notificación.
 *
 * QUÉ CUENTA: las solicitudes de amistad que me mandaron y los retos que me
 * mandaron. Las dos son lo mismo desde el punto de vista del usuario —alguien
 * te está esperando— y las dos viven en la misma pantalla, así que un solo
 * punto alcanza y no hay que decidir cuál es más importante.
 *
 * LO QUE NO CUENTA: lo que yo mandé. Mi propia solicitud pendiente no es una
 * novedad para mí, y un punto que aparece por algo que uno mismo hizo enseña a
 * ignorar el punto.
 *
 * POR QUÉ HAY MEMORIA. La barra se dibuja en TODAS las pantallas y se vuelve a
 * montar en cada navegación: sin esto serían dos consultas por toque de la
 * barra. Con ellas, dos por minuto como mucho.
 */

const VALE_MS = 60_000;

/** Cuando algo cambia —acepté, rechacé, respondí un reto— el número queda viejo. */
export const AVISO_SOCIAL = 'ascent:social-cambio';

let memo: { cuando: number; cuantos: number } | null = null;

/** Se llama después de resolver algo, para que el punto se apague enseguida. */
export function olvidarPendientes() {
  memo = null;
  eventos.emitir(AVISO_SOCIAL);
}

export async function contarPendientes(supabase: SupabaseClient): Promise<number> {
  if (memo && Date.now() - memo.cuando < VALE_MS) return memo.cuantos;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Sin sesión no hay nada que contar, y tampoco se memoriza: el próximo
  // intento tiene que volver a preguntar.
  if (!user) return 0;

  // Las dos consultas van juntas y piden solo la cuenta: lo que hace falta es
  // un número, no las filas.
  const [amistades, retos] = await Promise.all([
    supabase
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .eq('destinatario', user.id)
      .eq('estado', 'pendiente'),
    supabase
      .from('challenges')
      .select('id', { count: 'exact', head: true })
      .eq('rival', user.id)
      .eq('estado', 'pendiente'),
  ]);

  // UN ERROR NO ES UN CERO. Si la red falla, se deja lo que había: apagar el
  // punto porque no se pudo preguntar es la misma familia de bug que borraba
  // la sesión cuando `mi_sesion` no contestaba.
  if (amistades.error || retos.error) return memo?.cuantos ?? 0;

  const cuantos = (amistades.count ?? 0) + (retos.count ?? 0);
  memo = { cuando: Date.now(), cuantos };
  return cuantos;
}
