import type { Cliente } from '@cliente';
import { disponible } from '@nucleo/esquema';
import { CLAVE_NO_AVISAR_HASTA, PAUSA_TRAS_TERMINAR_MS, leerUniones, puedeMarcarPresencia, type LoPublicado, type Union } from '@nucleo/enVivo';
import { plataforma } from '@plataforma';
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
 * "ESTOY ENTRENANDO", al iniciar una sesión en cualquier lado (12/10). Es la
 * misma marca que pone el vigilante al llegar al gimnasio, y respeta lo mismo:
 * solo aparece quien tiene prendido "Avisar cuando entreno". Vence sola.
 *
 * La función es vieja (migración 51); lo nuevo es llamarla al iniciar, y eso
 * sale junto con "entrenar con otro".
 */
export async function avisarQueEntreno(supabase: Cliente): Promise<void> {
  // Una sesión nueva levanta la pausa que dejó el "Terminar" anterior.
  await plataforma.almacenamiento.borrar(CLAVE_NO_AVISAR_HASTA).catch(() => undefined);
  if (!disponible('entrenarConOtro', await version(supabase))) return;
  await supabase.rpc('marcar_en_gimnasio');
}

/** Lo que mira el vigilante del gimnasio antes de marcar que estás entrenando. Ver `puedeMarcarPresencia`. */
export async function sePuedeMarcarPresencia(): Promise<boolean> {
  return puedeMarcarPresencia(await plataforma.almacenamiento.leer(CLAVE_NO_AVISAR_HASTA).catch(() => null), Date.now());
}

/** Terminé: dejo de aparecer y se cortan mis vínculos. */
export async function dejarDeEntrenar(supabase: Cliente): Promise<void> {
  // Antes que nada, y aunque la base no conteste: el vigilante lo mira en el teléfono.
  await plataforma.almacenamiento
    .guardar(CLAVE_NO_AVISAR_HASTA, String(Date.now() + PAUSA_TRAS_TERMINAR_MS))
    .catch(() => undefined);
  if (!disponible('entrenarConOtro', await version(supabase))) return;
  await supabase.rpc('dejar_de_entrenar');
}
