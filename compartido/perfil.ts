import type { Cliente } from '@cliente';
import type { Perfil, UsuarioPublico } from '@nucleo/tipos';
import { miniaturas } from '@compartido/album';

/**
 * LO QUE DIBUJA TU PERFIL, en dos tandas.
 *
 * POR QUÉ ESTÁ ACÁ Y NO EN LA PANTALLA (22/9). Eran sesenta líneas de consultas
 * escritas adentro de `app/yo/page.tsx`, y la app nativa necesitaba las mismas.
 * Copiarlas habría sido tener dos veces la regla de qué fotos se muestran y
 * cuántas, que es justo la clase de cosa que se corrige en un lado.
 *
 * DOS TANDAS Y NO OCHO CONSULTAS EN FILA. Antes la pantalla se dibujaba con la
 * primera respuesta y el planeta, las fotos y los amigos iban apareciendo de a
 * uno. Todo lo que puede ir junto va junto; la segunda tanda existe solo porque
 * necesita los ids que trae la primera.
 *
 * LAS FOTOS SON LAS QUE VEN TUS AMIGOS, y nada más: las mismas nueve que ve un
 * amigo entrando a tu perfil. Todas las fotos y cuáles se comparten se manejan
 * en el Álbum, que es otra pantalla y otra pregunta.
 */

/** Cuántas fotos se muestran en un perfil, el propio y el de un amigo. */
export const FOTOS_VISIBLES = 9;

export type FotoDePerfil = {
  id: string;
  url: string;
  miniatura?: string;
  /** La fecha solo si la foto cuelga de un día: una suelta no tiene cuándo. */
  fecha: string | null;
};

export type DatosDePerfil = {
  perfil: Perfil;
  fotos: FotoDePerfil[];
  amigos: UsuarioPublico[];
};

export async function cargarMiPerfil(supabase: Cliente, uid: string): Promise<DatosDePerfil | null> {
  const [{ data: p }, { data: fs }, { data: rel }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', uid).single(),
    supabase
      .from('photos')
      .select('id, storage_path, log_id, creado')
      .eq('user_id', uid)
      .eq('visibilidad', 'amigos')
      .order('creado', { ascending: false })
      .limit(FOTOS_VISIBLES),
    supabase.from('friendships').select('*').eq('estado', 'aceptada'),
  ]);
  // `null` es "no se pudo", que la pantalla dibuja distinto de "no hay nada":
  // un perfil vacío y un perfil que no cargó se ven igual y no son lo mismo.
  if (!p) return null;

  const lista = (fs ?? []) as { id: string; storage_path: string; log_id: string | null }[];
  const logIds = lista.map((f) => f.log_id).filter(Boolean) as string[];
  const rutas = lista.map((f) => f.storage_path);
  const ids = ((rel ?? []) as { solicitante: string; destinatario: string }[]).map((r) =>
    r.solicitante === uid ? r.destinatario : r.solicitante
  );

  const [logsFotos, firmadas, chicas, us] = await Promise.all([
    logIds.length ? supabase.from('logs').select('id, fecha').in('id', logIds).then((r) => r.data ?? []) : [],
    rutas.length ? supabase.storage.from('fotos').createSignedUrls(rutas, 3600).then((r) => r.data ?? []) : [],
    miniaturas(supabase, rutas),
    ids.length
      ? supabase.from('usuarios_publicos').select('*').in('id', ids).then((r) => (r.data ?? []) as UsuarioPublico[])
      : [],
  ]);

  const cuando = new Map((logsFotos as { id: string; fecha: string }[]).map((l) => [l.id, l.fecha]));
  return {
    perfil: p as Perfil,
    fotos: lista.map((f, i) => ({
      id: f.id,
      url: (firmadas as { signedUrl: string }[])[i]?.signedUrl ?? '',
      miniatura: chicas[i] ?? undefined,
      fecha: f.log_id ? (cuando.get(f.log_id) ?? null) : null,
    })),
    amigos: (us as UsuarioPublico[]).sort((a, b) => (a.username ?? '').localeCompare(b.username ?? '')),
  };
}
