import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { encabezadoDeVersion } from './version';
import { T } from '@nucleo/textos';
import { conNombresEn } from '@nucleo/ejerciciosEn';

/**
 * EL CLIENTE DE SUPABASE, VERSIÓN NATIVA.
 *
 * ES LA MISMA BASE Y LOS MISMOS DATOS que la web: misma URL, misma anon key.
 * Entrás con tu cuenta y ves tu racha. No hay nada que migrar ni que copiar —
 * RLS es por usuario y la base no sabe ni le importa desde qué app le hablan.
 *
 * LO ÚNICO QUE CAMBIA es dónde vive la sesión. La web usa `@supabase/ssr`
 * porque el navegador tiene cookies y el servidor las lee; en React Native no
 * hay cookies, así que la sesión se guarda en AsyncStorage. Es exactamente la
 * clase de diferencia para la que existe `plataforma/`: cambia el archivo que
 * crea el cliente, y nada más.
 *
 * `detectSessionInUrl: false` porque acá no hay URL de la que sacar nada: los
 * enlaces de confirmación y recuperación llegan por deep link y se manejan
 * aparte (queda para la tanda que traiga el login).
 *
 * El polyfill de URL va primero de todo: `supabase-js` usa `URL` y `URLSearchParams`
 * y el motor de React Native no los trae completos.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Se avisa fuerte y temprano: sin esto el error aparece recién al primer
  // pedido, con un mensaje que no dice que faltaba configurar el `.env`.
  throw new Error(
    'Faltan EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en movil/.env'
  );
}

/**
 * EN INGLÉS, EL CATÁLOGO LLEGA CON LOS NOMBRES EN INGLÉS (14/10/2026). La base
 * los guarda en español y el catálogo se pide en diez lugares: cambiarlos acá,
 * al llegar, es uno solo y alcanza a los que se agreguen. Solo la tabla
 * `ejercicios`, solo en inglés; lo demás pasa sin tocar.
 */
async function conElIdioma(entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const r = await fetch(entrada, init);
  if (T.idioma !== 'en' || !r.ok) return r;
  const direccion = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  if (!/\/rest\/v1\/ejercicios(\?|$)/.test(direccion)) return r;
  const filas = await r.clone().json().catch(() => null);
  if (!Array.isArray(filas)) return r;
  return new Response(JSON.stringify(conNombresEn(filas)), { status: r.status, statusText: r.statusText, headers: r.headers });
}

export const supabase = createClient(url, anon, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  // Con qué versión llega cada pedido: ver `encabezadoDeVersion`.
  global: { headers: { 'X-Client-Info': encabezadoDeVersion() }, fetch: conElIdioma },
});
