import type { Cliente } from '@cliente';
import { plataforma } from '@plataforma';
import { disponible } from '@nucleo/esquema';
import { versionDelEsquema } from '@compartido/esquema';
import { T } from '@nucleo/textos';

/**
 * LOS AVISOS PUSH (migración 77): "te quieren agregar", "quieren unirse a tu
 * entrenamiento", con la app cerrada. Los manda la base al crearse el pedido;
 * acá solo se le dice a qué aparato.
 */
const CLAVE = 'ascent:token-push';

/** `pedir`: si nunca se le preguntó, se le pregunta ahora. Sin permiso no hace nada. */
export async function registrarAvisosRemotos(supabase: Cliente, pedir: boolean): Promise<void> {
  if (!disponible('avisosRemotos', await versionDelEsquema(supabase).catch(() => null))) return;
  const token = await plataforma.avisos.tokenRemoto(pedir);
  if (!token) return;
  const { error } = await supabase.rpc('guardar_token_push', { p_token: token, p_idioma: T.idioma });
  if (!error) await plataforma.almacenamiento.guardar(CLAVE, token);
}

/** Al cerrar sesión: que a este aparato no le lleguen los avisos de la cuenta que se fue. */
export async function olvidarAvisosRemotos(supabase: Cliente): Promise<void> {
  const token = await plataforma.almacenamiento.leer(CLAVE);
  if (!token) return;
  if (disponible('avisosRemotos', await versionDelEsquema(supabase).catch(() => null))) {
    await supabase.rpc('borrar_token_push', { p_token: token });
  }
  await plataforma.almacenamiento.borrar(CLAVE);
}
