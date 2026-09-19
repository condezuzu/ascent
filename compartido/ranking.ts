import type { Cliente } from '@cliente';
import { planetaDeDia } from '@nucleo/rangos';
import { T } from '@nucleo/textos';
import type { Reto, UsuarioPublico } from '@nucleo/tipos';

/**
 * LO QUE MUESTRA RANKING, pedido una sola vez para las dos apps.
 *
 * Vivía adentro de la pantalla de la web. Al portar Ranking a la app nativa
 * había dos caminos: copiar las siete consultas, o sacarlas acá. Copiadas,
 * la primera vez que alguien arreglara una —el orden, un filtro, el vencimiento
 * de las fotos— la otra quedaría vieja sin que nadie se entere. Escrito dos
 * veces se separa.
 *
 * Devuelve `null` cuando NO SE PUDO preguntar, y eso no es lo mismo que "no
 * tenés amigos": decir "tu cielo todavía está vacío" cuando lo que pasó es que
 * falló la red es mentir sobre los datos de la persona.
 */

export type Solicitud = { id: string; de: UsuarioPublico };
export type Actividad = {
  username: string;
  userId: string;
  avatar: string | null;
  fecha: string;
  planeta: string | null;
  foto: string | null;
};
export type RetoConNombre = Reto & { nombreRival: string; idRival: string };

export type DatosDeRanking = {
  /** Yo y mis amigos, de mayor racha a menor. */
  amigos: UsuarioPublico[];
  solicitudes: Solicitud[];
  /** A quiénes ya les mandé pedido y todavía no contestaron. */
  pedidosMandados: Set<string>;
  retos: RetoConNombre[];
  actividad: Actividad[];
  miRango: number;
  miPlaneta: string | null;
};

export async function cargarRanking(supabase: Cliente, uid: string): Promise<DatosDeRanking | null> {
  // EN TANDAS Y NO EN FILA (19/9). Eran siete viajes a la base uno detrás del
  // otro, y Ranking tardaba en aparecer. Ahora van juntos los que no dependen
  // entre sí: cuatro viajes seguidos en vez de siete.
  //
  // Tanda 1: cerrar los retos vencidos (fecha local, no UTC del server) y las
  // amistades. Los retos se piden recién en la tanda 2, después de cerrarlos.
  const [, { data: rel, error: errAmigos }] = await Promise.all([
    supabase.rpc('cerrar_retos_vencidos'),
    supabase.from('friendships').select('*'),
  ]);
  if (errAmigos) return null;

  const aceptadas = (rel ?? []).filter((r) => r.estado === 'aceptada');
  const idsAmigos = aceptadas.map((r) => (r.solicitante === uid ? r.destinatario : r.solicitante));
  const pendientes = (rel ?? []).filter((r) => r.estado === 'pendiente' && r.destinatario === uid);
  const mandadas = (rel ?? []).filter((r) => r.estado === 'pendiente' && r.solicitante === uid);

  // yo también aparezco en el campo estelar
  const idsInteres = [...new Set([...idsAmigos, uid, ...pendientes.map((p) => p.solicitante)])];

  // Tanda 2: quiénes son, los retos y la actividad de los amigos.
  const [{ data: publicos }, { data: rs }, ls] = await Promise.all([
    supabase.from('usuarios_publicos').select('*').in('id', idsInteres),
    supabase
      .from('challenges')
      .select('*')
      .or(`retador.eq.${uid},rival.eq.${uid}`)
      .neq('estado', 'rechazado')
      .order('creado', { ascending: false })
      .limit(6),
    idsAmigos.length > 0
      ? supabase
          .from('logs')
          .select('id, user_id, fecha, planeta_del_dia')
          .in('user_id', idsAmigos)
          .eq('es_descanso', false)
          .order('fecha', { ascending: false })
          .limit(12)
          .then((r) => r.data ?? [])
      : Promise.resolve([] as { id: string; user_id: string; fecha: string; planeta_del_dia: string | null }[]),
  ]);
  const mapaUsuarios = new Map(((publicos ?? []) as UsuarioPublico[]).map((p) => [p.id, p]));
  const yo = mapaUsuarios.get(uid);

  const amigos = ((publicos ?? []) as UsuarioPublico[])
    .filter((p) => p.id === uid || idsAmigos.includes(p.id))
    .sort((a, b) => b.racha_actual - a.racha_actual);

  const solicitudes = pendientes
    .map((p) => ({ id: p.id as string, de: mapaUsuarios.get(p.solicitante) as UsuarioPublico }))
    .filter((s) => s.de);

  const retos = ((rs ?? []) as Reto[]).map((r) => {
    const otro = r.retador === uid ? r.rival : r.retador;
    return { ...r, idRival: otro, nombreRival: mapaUsuarios.get(otro)?.username ?? '¿?' };
  });

  // Tanda 3: las fotos de esa actividad, y sus URL.
  let actividad: Actividad[] = [];
  if (ls.length > 0) {
    const logIds = ls.map((l) => l.id as string);
    let fotosPorLog = new Map<string, string>();
    const { data: fs } = await supabase.from('photos').select('log_id, storage_path').in('log_id', logIds);
    if (fs && fs.length > 0) {
      const { data: firmadas } = await supabase.storage
        .from('fotos')
        .createSignedUrls(
          fs.map((f) => f.storage_path as string),
          3600
        );
      fotosPorLog = new Map(fs.map((f, i) => [f.log_id as string, firmadas?.[i]?.signedUrl ?? '']));
    }
    actividad = ls.map((l) => ({
      username: mapaUsuarios.get(l.user_id as string)?.username ?? T.social.sinNombre,
      userId: l.user_id as string,
      avatar: mapaUsuarios.get(l.user_id as string)?.avatar_url ?? null,
      fecha: l.fecha as string,
      planeta: l.planeta_del_dia as string | null,
      foto: fotosPorLog.get(l.id as string) ?? null,
    }));
  }

  return {
    amigos,
    solicitudes,
    pedidosMandados: new Set(mandadas.map((r) => r.destinatario as string)),
    retos,
    actividad,
    miRango: yo?.rango_actual ?? 1,
    miPlaneta: yo ? planetaDeDia(yo.racha_actual) : null,
  };
}

/**
 * Gente por nombre, para mandarle pedido. Sin los que ya son amigos ni yo.
 * Con menos de dos letras no se busca: una letra trae media base.
 */
export async function buscarGente(
  supabase: Cliente,
  texto: string,
  miId: string,
  yaSonAmigos: Set<string>
): Promise<UsuarioPublico[]> {
  const limpio = texto.trim();
  if (limpio.length < 2) return [];
  const { data } = await supabase
    .from('usuarios_publicos')
    .select('*')
    .ilike('username', `%${limpio}%`)
    .neq('id', miId)
    .limit(8);
  return ((data ?? []) as UsuarioPublico[]).filter((u) => !yaSonAmigos.has(u.id));
}

/** Las cuatro respuestas de la pantalla. Devuelven si salió bien. */
export async function pedirAmistad(supabase: Cliente, miId: string, destino: string) {
  const { error } = await supabase.from('friendships').insert({ solicitante: miId, destinatario: destino });
  return !error;
}
export async function aceptarAmistad(supabase: Cliente, id: string) {
  const { error } = await supabase.from('friendships').update({ estado: 'aceptada' }).eq('id', id);
  return !error;
}
export async function rechazarAmistad(supabase: Cliente, id: string) {
  const { error } = await supabase.from('friendships').delete().eq('id', id);
  return !error;
}
export async function responderReto(supabase: Cliente, id: string, acepta: boolean) {
  const { error } = await supabase
    .from('challenges')
    .update({ estado: acepta ? 'activo' : 'rechazado' })
    .eq('id', id);
  return !error;
}

/**
 * DÓNDE VA CADA AMIGO EN EL CAMPO ESTELAR de detrás de la lista, y de qué
 * tamaño y brillo. El tamaño y el brillo dicen la racha de un vistazo.
 *
 * EL PISO SUBE DE 18 A 30 px. A 18 y con la opacidad del fondo, un amigo de
 * racha baja quedaba en un objeto de 18 px al 28% efectivo: eso no es un
 * astro, es una mancha. El techo baja un poco para que la diferencia siga
 * diciendo algo sin que el más grande tape la lista.
 *
 * Las posiciones salen del índice con dos primos, y no al azar: el campo tiene
 * que ser el mismo cada vez que se abre, y el mismo en las dos apps.
 */
export function astroDeAmigo(i: number, racha: number, maxRacha: number) {
  const t = racha / Math.max(1, maxRacha);
  return {
    tam: 30 + Math.round(t * 30),
    /** En % del ancho y del alto del campo; es el CENTRO del astro. */
    x: 18 + ((i * 137) % 64),
    y: 16 + ((i * 89) % 66),
    opacidad: 0.68 + t * 0.32,
    /** Cuándo arranca su vaivén, en segundos: que no floten todos juntos. */
    retraso: (i * 1.3) % 5,
  };
}
