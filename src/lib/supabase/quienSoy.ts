import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Quién es el usuario de esta pestaña, SIN salir a la red.
 *
 * POR QUÉ NO ES `auth.getUser()`. Esa llamada pega en `/auth/v1/user` cada
 * vez. Había dieciséis en la app y salían dos por navegación —una del
 * middleware, otra de la pantalla que se abría—, así que cambiar de pestaña
 * costaba dos viajes al servidor antes de pedir un solo dato.
 *
 * Y no compraban nada. Estas pantallas solo quieren el `id` para armar una
 * consulta que **RLS ya protege del otro lado**: si el token fuera falso, la
 * consulta de atrás no devolvería nada igual. Validar el token acá es pedirle
 * permiso al servidor para después pedirle permiso al servidor.
 *
 * `getSession()` lee la cookie y solo sale a la red si el token venció, que es
 * lo que hay que hacer.
 *
 * DÓNDE SÍ SIGUE YENDO `getUser()`, y no se toca:
 *
 *  - `middleware.ts` — es LA verificación. Corre en el servidor en cada
 *    pedido y es lo único que decide si esas cookies son de una sesión viva;
 *    además es la llamada que rota el refresh token. Contestar eso con la
 *    cookie sería creerle a la cookie sobre la cookie.
 *  - `nueva-clave` — decide si el enlace de recuperación sigue vivo. Con
 *    lectura local, una sesión que el servidor ya mató muestra el formulario
 *    igual y el error aparece recién después de escribir la contraseña nueva.
 *  - `VigilanteDeSesion` — su pregunta literal es "¿mi sesión sigue viva
 *    después de veinte minutos en segundo plano?". Contestarla con la caché
 *    local es contestarla con justo lo que se desconfía. No está en el camino
 *    de navegación: dispara al volver, y solo si estuviste más de un minuto.
 *
 * MÁS ADELANTE. Existe `getClaims()`, que valida Y no sale a la red — pero
 * solo con claves asimétricas. Con el secreto compartido de hoy se cae al
 * mismo `/auth/v1/user` y no ahorra nada. Cuando se rote el JWT a claves
 * asimétricas, el cambio es de una línea y pasa a estar acá adentro.
 */
export async function miUsuario(supabase: SupabaseClient): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}
