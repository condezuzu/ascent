import type { Cliente } from '@cliente';
import { sesionSegun } from '@nucleo/veredicto';

/**
 * UNA SOLA RESPUESTA A "¿HAY SESIÓN?", CON TRES VALORES (4/10).
 *
 * `auth.getSession()` renueva el token si venció, y sin red devuelve "sin
 * sesión" CON un error. Cada pantalla de la nativa lo preguntaba por su cuenta
 * y miraba solo la sesión: "no pude renovar" se leía como "no tenés sesión", y
 * de ahí salió el login en pleno entrenamiento. Arreglarlo en un lugar dejaba
 * los otros cinco con el mismo error por delante.
 *
 *   'con'    hay sesión: acá está el id.
 *   'sin'    no hay: nunca entró, salió, o el servidor dijo que no.
 *   'no-se'  no se pudo preguntar (la red). NO es 'sin': la sesión guardada sigue
 *            en el aparato y se renueva sola cuando vuelve la señal.
 *
 * Es el único lugar de la nativa y de `compartido/` que llama a
 * `auth.getSession()`; lo cuida la sección 187 de `test:db`. La regla que
 * separa 'sin' de 'no-se' está en `nucleo/veredicto` (`sesionSegun`).
 */
export type QuienSoy = { estado: 'con'; uid: string } | { estado: 'sin' } | { estado: 'no-se' };

export async function quienSoy(supabase: Cliente): Promise<QuienSoy> {
  try {
    const { data, error } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (uid) return { estado: 'con', uid };
    return { estado: sesionSegun(false, error) === 'sin' ? 'sin' : 'no-se' };
  } catch {
    return { estado: 'no-se' };
  }
}

/**
 * EL ID, para lo que solo lo necesita para armar una consulta que la RLS ya
 * protege del otro lado. `null` si no hay sesión o no se pudo preguntar: quien
 * llama no decide nada con eso, simplemente no pide.
 *
 * Una PANTALLA no usa esto: usa `quienSoy`, que distingue los dos casos.
 */
export async function miId(supabase: Cliente): Promise<string | null> {
  const yo = await quienSoy(supabase);
  return yo.estado === 'con' ? yo.uid : null;
}
