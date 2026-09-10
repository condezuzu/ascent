/**
 * LOS TOKENS QUE VIENEN EN UN ENLACE.
 *
 * Cuando Supabase confirma un correo redirige a la app con la sesión adentro
 * de la URL. El detalle que hace falta acertar: **pueden venir en el fragmento
 * (`#`) o en la query (`?`)** según el flujo y la versión, y el fragmento
 * `URL` no lo parsea solo. Equivocarse ahí no rompe nada ruidosamente — la app
 * simplemente no entra, y el que confirmó la cuenta se queda mirando el login
 * sin entender por qué.
 *
 * VIVE EN EL NÚCLEO PARA PODER PROBARLO. En `movil/` habría quedado atado a
 * `expo-linking` y a supabase-js, o sea imposible de correr con node pelado, y
 * esto es exactamente el tipo de función que hay que probar con seis URLs
 * raras y no con un teléfono.
 *
 * `URL` y `URLSearchParams` son estándar y existen en node, en el navegador y
 * en React Native con el polyfill que ya carga supabase-js.
 */

export type TokensDeSesion = { access_token: string; refresh_token: string };

/** Los tokens de una URL, vengan en el `#` o en la `?`. `null` si no hay. */
export function tokensDeUrl(url: string | null): TokensDeSesion | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    // El fragmento no lo parsea `URL`: se le saca el `#` y se lee igual que
    // una query.
    const delFragmento = new URLSearchParams(u.hash.replace(/^#/, ''));
    const access_token = delFragmento.get('access_token') ?? u.searchParams.get('access_token');
    const refresh_token = delFragmento.get('refresh_token') ?? u.searchParams.get('refresh_token');
    if (!access_token || !refresh_token) return null;
    return { access_token, refresh_token };
  } catch {
    // Una URL que no es una URL no es un error de la app: es alguien abriendo
    // el esquema a mano, o un enlace viejo.
    return null;
  }
}
