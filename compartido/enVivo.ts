import type { Cliente } from '@cliente';
import { disponible } from '@nucleo/esquema';
import { leerRespuestaDeUnirse, leerUniones, type LoPublicado, type RespuestaDeUnirse, type Union } from '@nucleo/enVivo';
import { versionDelEsquema } from '@compartido/esquema';

/**
 * ENTRENAR CON OTRO: las llamadas a la base. La regla vive en `nucleo/enVivo.ts`.
 *
 * NADA DE ESTO PASA POR LA COLA NI POR LA CACHÉ DE LA SESIÓN, y es a propósito:
 * es un canal aparte y de una sola mano. Si una llamada falla se pierde esa
 * foto y la próxima la reemplaza; nunca se reintenta algo viejo.
 *
 * Cada función pregunta por la migración 67 AL LADO de su llamada (no en un
 * ayudante de arriba): es la regla de la sección 81 de `test:db`.
 */

const version = (supabase: Cliente) => versionDelEsquema(supabase).catch(() => null);

export type Uniones = { uniones: Union[]; recibidoEn: number };

/** Mis vínculos vigentes. `null` = no se pudo preguntar: lo que estaba en pantalla se queda. */
export async function traerUniones(supabase: Cliente): Promise<Uniones | null> {
  if (!disponible('entrenarConOtro', await version(supabase))) return { uniones: [], recibidoEn: Date.now() };
  const { data, error } = await supabase.rpc('mis_uniones');
  if (error) return null;
  return { uniones: leerUniones(data), recibidoEn: Date.now() };
}

export async function pedirUnirse(supabase: Cliente, aQuien: string): Promise<RespuestaDeUnirse> {
  if (!disponible('entrenarConOtro', await version(supabase))) return 'fallo';
  const { data, error } = await supabase.rpc('pedir_unirse', { p_a: aQuien });
  return error ? 'fallo' : leerRespuestaDeUnirse(data);
}

export async function responderUnion(supabase: Cliente, id: string, acepta: boolean): Promise<boolean> {
  if (!disponible('entrenarConOtro', await version(supabase))) return false;
  return !(await supabase.rpc('responder_union', { p_id: id, p_acepta: acepta })).error;
}

export async function salirDeUnion(supabase: Cliente, otro: string): Promise<boolean> {
  if (!disponible('entrenarConOtro', await version(supabase))) return false;
  return !(await supabase.rpc('salir_de_union', { p_otro: otro })).error;
}

/** Publica la foto de lo que estoy haciendo. No avisa si falla: la siguiente la pisa. */
export async function publicarEnVivo(supabase: Cliente, p: LoPublicado): Promise<void> {
  if (!disponible('entrenarConOtro', await version(supabase))) return;
  await supabase.rpc('publicar_en_vivo', {
    p_ejercicio: p.ejercicio,
    p_serie: p.serie,
    p_meta: p.meta,
    p_descanso_faltan: p.descansoFaltan,
  });
}

/**
 * Terminé: se va lo que publiqué y se cortan mis vínculos. De "Entrenando
 * ahora" me saca que la sesión se cierre: desde la migración 72 eso sale de la
 * sesión y de ningún otro lado, así que acá no hay nada que marcar ni desmarcar.
 */
export async function dejarDeEntrenar(supabase: Cliente): Promise<void> {
  if (!disponible('entrenarConOtro', await version(supabase))) return;
  await supabase.rpc('dejar_de_entrenar');
}

// ── EL GRUPO (migración 88) ──

export type RespuestaDelLink = 'ok' | 'ya-unido' | 'ocupado' | 'no-existe' | 'fallo';

/** Me voy del grupo entero. Si lo había armado yo, pasa al que lleva más tiempo. */
export async function salirDelGrupo(supabase: Cliente): Promise<boolean> {
  if (!disponible('grupos', await version(supabase))) return false;
  return !(await supabase.rpc('salir_del_grupo')).error;
}

/** Saca a alguien del grupo. Solo anda si lo armé yo. */
export async function echarDelGrupo(supabase: Cliente, quien: string): Promise<boolean> {
  if (!disponible('grupos', await version(supabase))) return false;
  const { data, error } = await supabase.rpc('echar_del_grupo', { p_quien: quien });
  return !error && data === true;
}

/** El código del link del grupo (si no tengo grupo, se arma uno). `null` = no se pudo o no estoy entrenando. */
export async function linkDelGrupo(supabase: Cliente): Promise<string | null> {
  if (!disponible('grupos', await version(supabase))) return null;
  const { data, error } = await supabase.rpc('link_del_grupo');
  return !error && typeof data === 'string' && data ? data : null;
}

/** Entrar por el link: quedamos amigos con quien armó el grupo, y entro. */
export async function unirsePorLink(supabase: Cliente, codigo: string): Promise<RespuestaDelLink> {
  if (!disponible('grupos', await version(supabase))) return 'fallo';
  const { data, error } = await supabase.rpc('unirse_por_link', { p_codigo: codigo });
  if (error) return 'fallo';
  return data === 'ya-unido' || data === 'ocupado' || data === 'no-existe' ? data : 'ok';
}

/**
 * EN TIEMPO REAL (migración 88): avisa apenas cambia lo que publicó alguien del
 * grupo o quién está adentro. No trae los datos: quien escucha vuelve a pedir
 * `mis_uniones`, que es la única que sabe armar la lista (y la que mira los
 * permisos). La base deja leer solo lo del propio grupo. Devuelve con qué dejar
 * de escuchar.
 */
export function escucharGrupo(supabase: Cliente, grupo: string, companeros: string[], alCambiar: () => void): () => void {
  const canal = supabase.channel(`grupo:${grupo}:${Math.random().toString(36).slice(2, 8)}`);
  canal.on('postgres_changes', { event: '*', schema: 'public', table: 'grupo_miembros', filter: `grupo_id=eq.${grupo}` }, () => alCambiar());
  if (companeros.length > 0) {
    canal.on('postgres_changes', { event: '*', schema: 'public', table: 'en_vivo', filter: `user_id=in.(${companeros.join(',')})` }, () => alCambiar());
  }
  canal.subscribe();
  return () => {
    void supabase.removeChannel(canal);
  };
}
