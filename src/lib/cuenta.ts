import type { SupabaseClient } from '@supabase/supabase-js';
import { T } from '@nucleo/textos';

/**
 * Junta TODO el historial del usuario en un objeto para bajar como archivo.
 *
 * De los amigos sale solo el nombre de usuario: es mi lista de amigos, no un
 * volcado de los datos de otra gente. El peso va en kilos, que es como está
 * guardado, con la unidad elegida anotada aparte para que el número se pueda
 * interpretar sin adivinar.
 */
export async function juntarMisDatos(supabase: SupabaseClient, userId: string) {
  const [perfil, logs, pesos, fotos, descansos, amistades, retos, marcas, sesiones] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('logs').select('*').eq('user_id', userId).order('fecha'),
      supabase.from('weights').select('fecha, valor').eq('user_id', userId).order('fecha'),
      supabase
        .from('photos')
        .select('storage_path, visibilidad, es_subida_de_rango, log_id, creado')
        .eq('user_id', userId)
        .order('creado'),
      supabase.from('descansos').select('desde, dias').eq('user_id', userId).order('desde'),
      supabase.from('friendships').select('*'),
      supabase.from('challenges').select('*'),
      supabase
        .from('prs')
        .select('ejercicio, peso, reps, es_real, fecha')
        .eq('user_id', userId)
        .order('fecha'),
      supabase
        .from('sesiones')
        .select('inicio, fin, estado')
        .eq('user_id', userId)
        .order('inicio'),
    ]);

  const p = perfil.data;

  // los nombres de los amigos, para que la lista se entienda sin uuids sueltos
  const ids = new Set<string>();
  for (const a of amistades.data ?? []) {
    ids.add(a.solicitante === userId ? a.destinatario : a.solicitante);
  }
  const nombres = new Map<string, string>();
  if (ids.size > 0) {
    const { data: us } = await supabase
      .from('usuarios_publicos')
      .select('id, username')
      .in('id', [...ids]);
    for (const u of us ?? []) nombres.set(u.id, u.username);
  }

  return {
    exportado: new Date().toISOString(),
    app: 'Ascent',
    perfil: p
      ? {
          username: p.username,
          racha_actual: p.racha_actual,
          mejor_racha: p.mejor_racha,
          rango_actual: p.rango_actual,
          dias_descanso: p.dias_descanso,
          unidad_peso: p.unidad_peso,
          sexo: p.sexo ?? null,
          duracion_descanso: p.duracion_descanso ?? null,
          visibilidad_default: p.visibilidad_default,
          creado: p.creado,
        }
      : null,
    dias: (logs.data ?? []).map((l) => ({
      fecha: l.fecha,
      es_descanso: l.es_descanso,
      planeta_del_dia: l.planeta_del_dia,
    })),
    pesos_en_kilos: (pesos.data ?? []).map((w) => ({
      fecha: w.fecha,
      kilos: Number(w.valor),
    })),
    // Va lo que se levantó, no el 1RM: el 1RM es un derivado y guardarlo acá
    // congelaría la fórmula del día que se exportó. El DOTS tampoco va, por lo
    // mismo: depende del peso corporal, que ya está más arriba.
    marcas_en_kilos: (marcas.data ?? []).map((m) => ({
      ejercicio: m.ejercicio,
      kilos: Number(m.peso),
      repeticiones: m.reps,
      es_1rm_real: m.es_real,
      fecha: m.fecha,
    })),
    fotos: (fotos.data ?? []).map((f) => ({
      archivo: f.storage_path,
      visibilidad: f.visibilidad,
      de_subida_de_rango: f.es_subida_de_rango,
      creado: f.creado,
    })),
    // Las dos puntas, no la duración: la duración es `fin - inicio` y
    // guardarla acá sería repetir un derivado. `fin` en null significa que la
    // sesión no tiene duración, no que duró cero.
    sesiones: (sesiones.data ?? []).map((s) => ({
      inicio: s.inicio,
      fin: s.fin,
      estado: s.estado,
    })),
    // configuraciones de descanso fechadas: cada una rige desde su fecha
    descansos: descansos.data ?? [],
    amigos: (amistades.data ?? []).map((a) => {
      const otro = a.solicitante === userId ? a.destinatario : a.solicitante;
      return {
        username: nombres.get(otro) ?? null,
        estado: a.estado,
        lo_pedi_yo: a.solicitante === userId,
        desde: a.creado,
      };
    }),
    retos: (retos.data ?? []).map((r) => ({
      desde: r.desde,
      hasta: r.hasta,
      estado: r.estado,
      lo_gane: r.ganador === userId,
    })),
  };
}

/**
 * Borra la cuenta entera. Primero los ARCHIVOS del storage y recién después
 * la cuenta: si se hiciera al revés y el borrado de archivos fallara, esas
 * fotos quedarían para siempre en el bucket sin nadie con permiso para
 * alcanzarlas, porque el dueño ya no existiría.
 *
 * Se listan las carpetas en vez de leer la tabla `photos` para llevarse
 * también cualquier archivo que haya quedado suelto de una subida a medias.
 */
export async function eliminarCuenta(
  supabase: SupabaseClient,
  userId: string
): Promise<{ ok: true } | { error: string }> {
  for (const bucket of ['fotos', 'avatares']) {
    const { data: archivos, error: errListar } = await supabase.storage
      .from(bucket)
      .list(userId, { limit: 1000 });
    if (errListar) return { error: T.errores.noSeBorraronFotos };
    if (!archivos || archivos.length === 0) continue;

    const { data: borrados, error: errBorrar } = await supabase.storage
      .from(bucket)
      .remove(archivos.map((a) => `${userId}/${a.name}`));
    if (errBorrar) return { error: T.errores.noSeBorraronFotos };

    // No alcanza con que no haya error. Si a un bucket le falta la política
    // de delete, la RLS lo frena EN SILENCIO: la respuesta viene sin error y
    // con cero archivos borrados. Así fue como una baja de cuenta dejó el
    // avatar huérfano en un bucket público. Se cuenta lo que volvió.
    if ((borrados?.length ?? 0) !== archivos.length) {
      return { error: T.errores.noSeBorraronFotos };
    }
  }

  const { error } = await supabase.rpc('eliminar_cuenta');
  if (error) return { error: T.errores.noSeElimino };
  return { ok: true };
}
