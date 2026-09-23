import type { Cliente } from '@cliente';
import type { Log, Perfil, UsuarioPublico } from '@nucleo/tipos';
import { hoyISO, restarDias } from '@nucleo/fechas';
import { miniaturas } from '@compartido/album';
import { medallasDe, type Medalla } from '@nucleo/medallas';
import type { MiFuerza } from '@nucleo/tipos';

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
  /** Las medallas por marca, para el costado del nombre. */
  medallas: Medalla[];
};

/**
 * TUS MEDALLAS POR MARCA. Se piden aparte de `cargarMiPerfil` porque la web las
 * necesita sin el resto —su pantalla de perfil tiene sus propias consultas— y
 * copiar la regla de qué se gana en dos lados es la clase de cosa que después
 * se corrige en uno solo.
 *
 * TRES DATOS Y NINGUNO ES NUEVO: tus mejores marcas (`mi_fuerza`, la misma que
 * usa Stats), tu peso corporal más reciente y tu sexo. La tabla de estándares
 * es por sexo y por peso corporal; sin esos dos el percentil no existe y
 * `medallasDe` devuelve una lista vacía, que es lo honesto.
 *
 * EL PESO SALE DE `weights` DIRECTO y no de una RPC nueva: la tabla ya tiene
 * grant de select para el dueño y es una consulta de una fila. Va en kilos,
 * que es como está la tabla de estándares.
 *
 * NO SIRVE PARA UN AMIGO, y no por olvido: el peso corporal de otra persona no
 * se ve nunca, ni entre amigos (§16.7). Las medallas de un amigo tienen que
 * salir calculadas del lado del servidor; ver `migracion-46-medallas.sql`.
 */
export async function cargarMisMedallas(
  supabase: Cliente,
  uid: string,
  sexo: string | null
): Promise<Medalla[]> {
  const [{ data: f }, { data: w }] = await Promise.all([
    supabase.rpc('mi_fuerza'),
    supabase.from('weights').select('valor').eq('user_id', uid).order('fecha', { ascending: false }).limit(1),
  ]);
  const marcas = ((f as MiFuerza | null)?.marcas ?? []).map((m) => ({ ejercicio: m.ejercicio, kg: m.kg }));
  const peso = ((w ?? []) as { valor: number }[])[0]?.valor ?? null;
  return medallasDe(sexo, peso, marcas);
}

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

  const [logsFotos, firmadas, chicas, us, medallas] = await Promise.all([
    logIds.length ? supabase.from('logs').select('id, fecha').in('id', logIds).then((r) => r.data ?? []) : [],
    rutas.length ? supabase.storage.from('fotos').createSignedUrls(rutas, 3600).then((r) => r.data ?? []) : [],
    miniaturas(supabase, rutas),
    ids.length
      ? supabase.from('usuarios_publicos').select('*').in('id', ids).then((r) => (r.data ?? []) as UsuarioPublico[])
      : [],
    // Van en la SEGUNDA tanda y no en la primera porque necesitan el sexo, que
    // viene en el perfil. Al lado de las fotos y los amigos no cuestan tiempo:
    // todo lo que puede ir junto va junto.
    cargarMisMedallas(supabase, uid, (p as Perfil).sexo),
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
    medallas,
  };
}

/** Cuántos días de la semana de un amigo se ven en su perfil. */
export const DIAS_VISIBLES = 7;

export type PerfilDeAmigo = {
  usuario: UsuarioPublico;
  /** `true` solo si la amistad está aceptada: sin eso no se ve nada suyo. */
  esAmigo: boolean;
  pedidoPendiente: boolean;
  /** Su última semana. Vacío si no es amigo. */
  logs: Log[];
  fotos: FotoDePerfil[];
};

/**
 * EL PERFIL DE OTRO, con lo que la base deja ver.
 *
 * NO ES UN ESPEJO DEL PROPIO, y la diferencia es de privacidad, no de dibujo:
 * de un amigo NO se ven sus días de descanso —son configuración suya, y la
 * semana se dibuja sin ellos— ni su peso ni su correo. Lo que se ve es lo que
 * la RLS deja leer a un amigo aceptado, y por eso `esAmigo` decide si se
 * consulta: pedir lo demás sin la amistad sería pedirle a la base que diga que
 * no, once veces.
 *
 * LOS RETOS NO ESTÁN. En la web tampoco se muestran (`RETOS_LISTOS` en false):
 * portar una pantalla que nadie ve sería portar una decisión que todavía no se
 * tomó.
 */
export async function cargarPerfilDeAmigo(
  supabase: Cliente,
  yo: string,
  otro: string
): Promise<PerfilDeAmigo | null> {
  const { data: u } = await supabase.from('usuarios_publicos').select('*').eq('id', otro).maybeSingle();
  if (!u) return null;

  const { data: rel } = await supabase
    .from('friendships')
    .select('*')
    .or(`and(solicitante.eq.${yo},destinatario.eq.${otro}),and(solicitante.eq.${otro},destinatario.eq.${yo})`)
    .maybeSingle();
  const esAmigo = rel?.estado === 'aceptada';
  const base = {
    usuario: u as UsuarioPublico,
    esAmigo,
    pedidoPendiente: rel?.estado === 'pendiente',
    logs: [] as Log[],
    fotos: [] as FotoDePerfil[],
  };
  if (!esAmigo) return base;

  const desde = restarDias(hoyISO(), DIAS_VISIBLES - 1);
  const [{ data: ls }, { data: fs }] = await Promise.all([
    supabase.from('logs').select('*').eq('user_id', otro).gte('fecha', desde).order('fecha'),
    supabase
      .from('photos')
      .select('id, storage_path, log_id, creado')
      .eq('user_id', otro)
      .order('creado', { ascending: false })
      .limit(FOTOS_VISIBLES),
  ]);

  const lista = (fs ?? []) as { id: string; storage_path: string; log_id: string | null }[];
  const logIds = lista.map((f) => f.log_id).filter(Boolean) as string[];
  const rutas = lista.map((f) => f.storage_path);
  const [logsFotos, firmadas, chicas] = await Promise.all([
    logIds.length ? supabase.from('logs').select('id, fecha').in('id', logIds).then((r) => r.data ?? []) : [],
    rutas.length ? supabase.storage.from('fotos').createSignedUrls(rutas, 3600).then((r) => r.data ?? []) : [],
    miniaturas(supabase, rutas),
  ]);
  const cuando = new Map((logsFotos as { id: string; fecha: string }[]).map((l) => [l.id, l.fecha]));

  return {
    ...base,
    logs: (ls ?? []) as Log[],
    fotos: lista.map((f, i) => ({
      id: f.id,
      url: (firmadas as { signedUrl: string }[])[i]?.signedUrl ?? '',
      miniatura: chicas[i] ?? undefined,
      fecha: f.log_id ? (cuando.get(f.log_id) ?? null) : null,
    })),
  };
}
