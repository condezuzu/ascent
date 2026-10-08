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

/**
 * EL LINK PARA AGREGAR A ALGUIEN (8/10/2026). Va por `https` —que se puede
 * tocar en cualquier chat— a una página de la web que ofrece abrir la app con
 * `ascent://amigo/<nombre>`. Las dos formas terminan en el mismo nombre.
 */
export const SITIO = 'https://ascent-blush-seven.vercel.app';
export const TIENDA = 'https://apps.apple.com/app/id6815006917';
const NOMBRE = /^[a-zA-Z0-9_]{3,20}$/;

export function enlaceDeAmigo(usuario: string): string {
  return `${SITIO}/amigo/${usuario}`;
}

export function enlaceALaApp(usuario: string): string {
  return `ascent://amigo/${usuario}`;
}

/** El nombre de usuario de un link de amigo, sea el de la web o el de la app. `null` si no es uno. */
export function usuarioDeEnlace(url: string | null | undefined): string | null {
  const m = /^(?:https?:\/\/[^/]+|ascent:\/\/)\/?amigo\/([^/?#]+)\/?(?:[?#].*)?$/.exec((url ?? '').trim());
  return m && NOMBRE.test(m[1]) ? m[1] : null;
}

/** Los tokens de una URL, vengan en el `#` o en la `?`. `null` si no hay. */
/**
 * SI EL ENLACE ES EL DE CAMBIAR LA CONTRASEÑA (4/10). Supabase lo marca con
 * `type=recovery` al lado de los tokens. Se tiraba, y por eso la app nativa
 * entraba y nunca preguntaba la clave nueva.
 */
export function esDeRecuperacion(url: string | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const tipo = new URLSearchParams(u.hash.replace(/^#/, '')).get('type') ?? u.searchParams.get('type');
    return tipo === 'recovery';
  } catch {
    return false;
  }
}

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
