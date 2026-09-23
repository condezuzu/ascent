import type { Cliente } from '@cliente';
import type { Log, Perfil, UsuarioPublico } from '@nucleo/tipos';
import { hoyISO, restarDias } from '@nucleo/fechas';
import { miniaturas } from '@compartido/album';
import { medallasDe, medallasDePercentiles, type Medalla } from '@nucleo/medallas';
import { disponible } from '@nucleo/esquema';
import { versionDelEsquema } from '@compartido/esquema';
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
  const mias = medallasDe(sexo, peso, marcas);
  void guardarParaAmigos(supabase, uid, mias);
  return mias;
}

/**
 * DEJA TUS MEDALLAS ESCRITAS PARA QUE LAS VEAN TUS AMIGOS.
 *
 * El percentil se calcula con tu mejor marca, tu peso corporal y tu sexo, y las
 * tres las tiene el dueño y solo el dueño: **el peso corporal de otra persona
 * no se ve nunca, ni entre amigos** (§16.7). Así que un amigo no puede
 * calcularlo ni queriendo, y lo que lee es este número ya derivado.
 *
 * SE REESCRIBE CADA VEZ QUE SE CALCULA, y por eso no hace falta ningún gancho
 * en "anotar peso" ni en "cambiar el sexo": cambiás cualquiera de las dos
 * cosas, abrís tu perfil o Inicio, y la fila queda al día. Es también lo que la
 * vuelve auto-reparable — un número que se escribió mal se corrige solo la
 * próxima vez.
 *
 * COMO SE RECALCULA SIEMPRE, PUEDE BAJAR: si subís de peso, el mismo
 * levantamiento vale menos. Es lo que se pidió —que no quede un número viejo
 * para siempre— y contradice a propósito el "no baja nunca" de antes. Volver al
 * trofeo que no se pierde es una línea: guardar el mayor entre el nuevo y el
 * guardado.
 *
 * NO SE ESPERA NI SE AVISA SI FALLA. Es un espejo para otros, no un dato de
 * esta pantalla: que no se haya podido escribir no tiene que frenar ni ensuciar
 * lo que estás mirando, y la próxima vez se vuelve a intentar sola. Mientras la
 * migración 46 no esté corrida, la tabla no existe y esto falla callado — que
 * es exactamente el estado de hoy.
 */
async function guardarParaAmigos(supabase: Cliente, uid: string, mias: Medalla[]): Promise<void> {
  try {
    if (mias.length === 0) return;
    await supabase.from('medallas').upsert(
      mias.map((m) => ({ user_id: uid, ejercicio: m.ejercicio, percentil: m.percentil, actualizado: new Date().toISOString() })),
      { onConflict: 'user_id,ejercicio' }
    );
  } catch {
    // Ver arriba: falla callado a propósito.
  }
}

/**
 * LAS MEDALLAS DE UN AMIGO, leídas de lo que él dejó escrito.
 *
 * VIENE EL PERCENTIL CRUDO Y EL RESTO SE DERIVA ACÁ, con las mismas reglas que
 * las tuyas (`medallasDe` no sirve: necesita marcas, peso y sexo). Guardar
 * además el material sería guardar la misma verdad dos veces y poder
 * contradecirse.
 *
 * SE PREGUNTA PRIMERO SI LA FUNCIÓN ESTÁ. Sin la migración 46 no existe, y
 * llamarla igual sería un error en la consola de todo el que abra el perfil de
 * un amigo antes de que la base esté al día. Con la versión en mano, el camino
 * viejo es no mostrar medallas, que es exactamente lo que se ve hoy.
 */
export async function cargarMedallasDeAmigo(supabase: Cliente, uid: string): Promise<Medalla[]> {
  if (!disponible('medallasDeAmigo', await versionDelEsquema(supabase))) return [];
  const { data } = await supabase.rpc('medallas_de', { p_user: uid });
  const filas = (data ?? []) as { ejercicio: string; percentil: number }[];
  return medallasDePercentiles(filas);
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
  /** Sus medallas por marca. Vacío si no es amigo, o si falta la migración 46. */
  medallas: Medalla[];
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
    medallas: [] as Medalla[],
  };
  if (!esAmigo) return base;

  const desde = restarDias(hoyISO(), DIAS_VISIBLES - 1);
  const [{ data: ls }, { data: fs }, medallas] = await Promise.all([
    supabase.from('logs').select('*').eq('user_id', otro).gte('fecha', desde).order('fecha'),
    supabase
      .from('photos')
      .select('id, storage_path, log_id, creado')
      .eq('user_id', otro)
      .order('creado', { ascending: false })
      .limit(FOTOS_VISIBLES),
    // Las suyas, del número que él dejó escrito: su peso corporal no se ve
    // nunca, ni entre amigos, así que calcularlas acá es imposible.
    cargarMedallasDeAmigo(supabase, otro),
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
    medallas,
    logs: (ls ?? []) as Log[],
    fotos: lista.map((f, i) => ({
      id: f.id,
      url: (firmadas as { signedUrl: string }[])[i]?.signedUrl ?? '',
      miniatura: chicas[i] ?? undefined,
      fecha: f.log_id ? (cuando.get(f.log_id) ?? null) : null,
    })),
  };
}
