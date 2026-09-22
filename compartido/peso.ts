import type { Cliente } from '@cliente';
import { disponible } from '@nucleo/esquema';

/**
 * CORREGIR Y BORRAR UN PESO ANOTADO (migración 45).
 *
 * POR QUÉ EXISTE ESTE ARCHIVO. `weights` solo tiene `select` para el dueño: se
 * escribe por RPC, así que la app no puede corregir con un `update` ni borrar
 * con un `delete`. Las dos llamadas son idénticas en las dos apps y el guardián
 * de la migración se olvida fácil, así que viven juntas y una sola vez.
 *
 * `null` SIGNIFICA "TODAVÍA NO SE PUEDE", y no es lo mismo que `false`. Si la
 * base no corrió la 45, las funciones no existen y llamarlas da un error feo;
 * la pantalla que llame a esto ya no debería estar mostrando los botones, pero
 * si algo se cuela, acá se frena antes de tocar la red.
 */

export async function corregirPeso(
  supabase: Cliente,
  version: number | null,
  fecha: string,
  valorEnKilos: number
): Promise<boolean | null> {
  if (!disponible('corregirPeso', version)) return null;
  const { data, error } = await supabase.rpc('corregir_peso', { p_fecha: fecha, p_valor: valorEnKilos });
  if (error) return false;
  // La base devuelve si tocó una fila: corregir un día que no existe no es un
  // error de red, es que no había nada que corregir, y la pantalla no puede
  // decir "listo" en ese caso.
  return data === true;
}

export async function borrarPeso(
  supabase: Cliente,
  version: number | null,
  fecha: string
): Promise<boolean | null> {
  if (!disponible('corregirPeso', version)) return null;
  const { data, error } = await supabase.rpc('borrar_peso', { p_fecha: fecha });
  if (error) return false;
  return data === true;
}
