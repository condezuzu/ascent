/**
 * ¿Se lo deja pasar o se lo manda a /login?
 *
 * Está separado del middleware y no importa nada, para poder probarlo: es la
 * decisión más peligrosa de la app entera. Mandar a /login a alguien que SÍ
 * tiene sesión es lo peor que le puede pasar a una app de rachas —llegás al
 * gimnasio, abrís, te pide entrar— y encima hoy no hay recuperación de
 * contraseña, porque el SMTP está apagado. Quedar deslogueado es quedar
 * afuera.
 *
 * LA REGLA: solo se manda a /login cuando se SABE que no hay sesión. Cuando no
 * se pudo averiguar, se sigue. Los dos errores no cuestan lo mismo:
 *
 * - Dejar pasar a alguien sin sesión no expone nada. Todo lo que hay atrás lo
 *   protege RLS, que no depende de esto, y la propia pantalla lo manda a
 *   /login apenas ve que no hay sesión. Cuesta un parpadeo.
 * - Mandar a /login a alguien con sesión lo deja afuera de la app.
 *
 * Con esa asimetría, ante la duda se sigue. Siempre.
 */

export type Veredicto = 'seguir' | 'a-login';

export type Fallo =
  /** Se pudo preguntar y contestaron. */
  | 'no'
  /** El servidor dijo que no: token inválido, vencido, revocado. */
  | 'de-auth'
  /** No se pudo preguntar: red, timeout, 500, límite de pedidos. */
  | 'de-red';

export type Entrada = {
  /** Si el pedido trae cookies de sesión de Supabase. */
  hayCookiesDeSesion: boolean;
  /** Si el servidor confirmó quién es. */
  hayUsuario: boolean;
  fallo: Fallo;
  esPublica: boolean;
};

export function decidirRuta(e: Entrada): Veredicto {
  if (e.esPublica) return 'seguir';

  // Sin una sola cookie de sesión no hay nada que averiguar ni que perder.
  // Este es el caso normal del que nunca entró, y es el único que no necesita
  // preguntarle nada a nadie.
  if (!e.hayCookiesDeSesion) return 'a-login';

  if (e.hayUsuario) return 'seguir';

  // ACÁ ESTABA EL BUG. `getUser()` sale a la red en cada pedido, y cuando esa
  // llamada fallaba por cualquier motivo que no fuera "no tenés sesión" —un
  // corte de un segundo entre Vercel y Supabase, un 500, un límite de
  // pedidos— devolvía `user` en null y esto lo mandaba a /login igual. Un
  // hipo de red te dejaba afuera.
  if (e.fallo === 'de-red') return 'seguir';

  // Tenía cookies pero el servidor las rechazó: esa sesión está muerta de
  // verdad y hay que volver a entrar.
  return 'a-login';
}

/**
 * Cómo se clasifica lo que devolvió `getUser()`.
 *
 * Ante la duda, `de-red`. Un error que no sabemos leer NO puede costar la
 * sesión: si aparece uno nuevo y lo tratamos como de-auth, deslogueamos gente
 * por algo que ni siquiera entendimos.
 */
export function clasificar(error: { name?: string; status?: number } | null): Fallo {
  if (!error) return 'no';
  // El que tira supabase-js cuando el `fetch` no llegó a ningún lado.
  if (error.name === 'AuthRetryableFetchError') return 'de-red';
  if (error.status === 401 || error.status === 403) return 'de-auth';
  if (error.status === undefined || error.status === 0) return 'de-red';
  if (error.status >= 500) return 'de-red';
  // 429 incluido: que Supabase nos frene por exceso de pedidos no significa
  // que la persona no tenga sesión.
  if (error.status === 429) return 'de-red';
  return 'de-red';
}

/** Las cookies de sesión de Supabase, que pueden venir partidas en pedazos. */
export function hayCookiesDeSesion(nombres: string[]): boolean {
  return nombres.some((n) => n.startsWith('sb-') && n.includes('auth-token'));
}

/**
 * Pasa a `destino` las cookies que `origen` haya juntado.
 *
 * ACÁ ESTABA EL SEGUNDO BUG, Y ES EL QUE MATABA LA SESIÓN DE VERDAD. Supabase
 * ROTA el refresh token: cada refresco invalida el anterior. El middleware
 * dejaba los tokens nuevos en la respuesta de "seguir", pero cuando decidía
 * rebotar devolvía un `NextResponse.redirect()` recién hecho, que no los
 * llevaba. El navegador se quedaba con el token viejo, que el servidor acababa
 * de consumir, y el próximo refresco moría con `refresh_token_already_used`.
 *
 * Un rebote de un segundo se convertía así en un deslogueo permanente.
 *
 * Va acá y no en el middleware para que se pueda probar: el tipo es
 * estructural a propósito —cualquier cosa con `cookies.getAll()` y
 * `cookies.set()`— así este archivo no importa nada y node lo puede cargar.
 */
type ConCookies = {
  cookies: {
    getAll(): { name: string; value: string }[];
    set(cookie: { name: string; value: string }): unknown;
  };
};

export function llevarCookies<T extends ConCookies>(destino: T, origen: ConCookies): T {
  for (const cookie of origen.cookies.getAll()) destino.cookies.set(cookie);
  return destino;
}
