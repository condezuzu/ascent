import * as Linking from 'expo-linking';
import { supabase } from './supabase';
import { tokensDeUrl } from '@nucleo/enlace';

/**
 * EL ENLACE DEL CORREO QUE VUELVE A LA APP.
 *
 * EL PROBLEMA. Crear la cuenta manda un correo de confirmación, y ese enlace
 * abre el navegador. En web eso está bien —el navegador ES la app— pero acá
 * dejaba a la persona confirmada y afuera: la sesión quedaba en una pestaña
 * que no es la app. Sin esto, una cuenta nueva se tiene que crear en la web.
 *
 * CÓMO FUNCIONA. Supabase redirige a `ascent://confirmar#access_token=...`,
 * el sistema abre la app con esa URL, y acá se sacan los dos tokens y se
 * arranca la sesión. Es el mismo par que ya vive en AsyncStorage cuando entrás
 * con contraseña; lo único distinto es de dónde salieron.
 *
 * EL PARSEO VIVE EN `nucleo/enlace.ts`, no acá: los tokens pueden venir en el
 * fragmento o en la query según el flujo, y equivocarse ahí no rompe nada
 * ruidosamente —la app simplemente no entra—. Del otro lado se puede probar
 * con seis URLs raras; acá haría falta un teléfono.
 *
 * SI NO HAY TOKENS NO PASA NADA. La app se abre por su enlace propio en otros
 * casos —y se va a abrir por más cuando haya links a un perfil o a un reto—,
 * así que esto NO puede tirar ni dejar la app en un estado raro cuando la URL
 * no es la que espera: mira, no encuentra, y sigue.
 *
 * LO QUE FALTA Y NO ES CÓDIGO: `ascent://confirmar` tiene que estar en la
 * lista blanca de Supabase (Authentication → URL Configuration → Redirect
 * URLs). Sin eso, Supabase ignora el `redirect_to` y manda al sitio por
 * omisión. Es una línea en el panel y la tiene que poner el humano: la clave
 * de servicio no está —ni tiene que estar— en este repo.
 */

/** A dónde vuelve el correo. El `scheme` sale de `app.json`. */
export const VUELTA = Linking.createURL('confirmar');

/**
 * Abre la sesión con lo que vino en el enlace. Devuelve `true` si entró.
 *
 * No decide nada más: quién vuelve a mirar la sesión es la pantalla, igual que
 * después de entrar con contraseña.
 */
export async function sesionDesdeEnlace(url: string | null): Promise<boolean> {
  const tokens = tokensDeUrl(url);
  if (!tokens) return false;
  const { error } = await supabase.auth.setSession(tokens);
  return !error;
}
