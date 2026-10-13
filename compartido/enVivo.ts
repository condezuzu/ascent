import type { Cliente } from '@cliente';
import { disponible } from '@nucleo/esquema';
import { leerUniones, type LoPublicado, type Union } from '@nucleo/enVivo';
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

export async function pedirUnirse(supabase: Cliente, aQuien: string): Promise<boolean> {
  if (!disponible('entrenarConOtro', await version(supabase))) return false;
  return !(await supabase.rpc('pedir_unirse', { p_a: aQuien })).error;
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
