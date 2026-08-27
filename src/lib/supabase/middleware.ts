import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  clasificar,
  decidirRuta,
  hayCookiesDeSesion,
  llevarCookies,
} from '@/lib/supabase/veredicto';

const RUTAS_PUBLICAS = ['/login', '/auth', '/galeria'];

/**
 * Refresca el token en cada pedido y decide si la pantalla se puede ver.
 *
 * DOS COSAS QUE ESTUVIERON MAL ACÁ Y SE PARECEN A UNA SOLA, porque la segunda
 * convierte a la primera en permanente:
 *
 * 1. **El error de `getUser()` se tiraba a la basura.** Esa llamada sale a la
 *    red, y cuando fallaba por algo que no era "no tenés sesión" devolvía
 *    `user` en null igual. Un corte de un segundo entre Vercel y Supabase te
 *    mandaba a /login. Ahora lo decide `decidirRuta`, que ante la duda sigue.
 *
 * 2. **El redirect tiraba las cookies recién refrescadas.** Supabase ROTA el
 *    refresh token: cada refresco invalida el anterior. `setAll` deja los
 *    nuevos en `respuesta`, pero `NextResponse.redirect()` es una respuesta
 *    nueva que no los llevaba. O sea que el navegador se quedaba con el token
 *    viejo, que el servidor acababa de consumir. El próximo intento moría con
 *    `refresh_token_already_used` y ahí sí: sesión muerta de verdad, no un
 *    parpadeo.
 *
 * Encadenadas explican lo que se vio: un hipo de red rebotaba a /login, ese
 * rebote se comía el token nuevo, y a partir de ahí TODO iba a /login. Cuatro
 * capturas seguidas de la pantalla de entrada, idénticas byte por byte.
 *
 * Por eso ahora hay UNA sola salida (`salir`), que siempre lleva las cookies.
 * No es un detalle de estilo: es que no haya un segundo camino donde volver a
 * olvidarse.
 */
export async function actualizarSesion(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookies: { name: string; value: string; options?: object }[]) {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value));
          respuesta = NextResponse.next({ request });
          cookies.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const conCookies = hayCookiesDeSesion(request.cookies.getAll().map((c) => c.name));

  // Sin cookies no se pregunta: es el caso del que nunca entró, y sacarle un
  // viaje de red a cada carga de /login no le sirve a nadie.
  const { data, error } = conCookies
    ? await supabase.auth.getUser()
    : { data: { user: null }, error: null };

  const veredicto = decidirRuta({
    hayCookiesDeSesion: conCookies,
    hayUsuario: !!data.user,
    fallo: clasificar(error),
    esPublica: RUTAS_PUBLICAS.some((r) => request.nextUrl.pathname.startsWith(r)),
  });

  if (veredicto === 'seguir') return respuesta;

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  // Si TENÍA cookies y aun así lo mandamos a entrar, eso es un rebote y hay
  // que poder cazarlo después: la pantalla de entrada lo anota en la bitácora.
  // Sin esto, "me deslogueó en el gimnasio" no deja ningún rastro.
  if (conCookies) url.searchParams.set('rebote', '1');
  // SIEMPRE con las cookies del refresco: ver `llevarCookies`.
  return llevarCookies(NextResponse.redirect(url), respuesta);
}
