import { createBrowserClient } from '@supabase/ssr';

const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLAVE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Revisa que las variables de entorno tengan pinta de válidas ANTES de que
 * falle una petición. Un valor cortado o vacío hace que Supabase conteste
 * "Invalid API key", que desde afuera se confunde con una contraseña mal
 * escrita: hay que poder distinguirlos.
 *
 * Ojo: las NEXT_PUBLIC_* se incrustan al COMPILAR. Cambiarlas en Vercel no
 * alcanza, hay que volver a desplegar.
 */
export function configuracionValida(): boolean {
  if (!URL_SUPA || !CLAVE) return false;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(URL_SUPA.trim())) return false;
  // un JWT son tres partes separadas por punto; la anon key ronda los 200 caracteres
  const partes = CLAVE.trim().split('.');
  if (partes.length !== 3 || CLAVE.trim().length < 100) return false;
  return true;
}

/**
 * UNO SOLO POR PESTAÑA, y esto no es una optimización.
 *
 * Treinta y tres componentes llaman a `crearCliente()`, casi todos con
 * `useState(() => crearCliente())`. Sin esta caché, en una pantalla conviven
 * cinco o seis clientes distintos: cada uno con SU temporizador de refresco y
 * SU copia de la sesión en memoria.
 *
 * Supabase ROTA el token en cada refresco. Cuando uno de esos clientes
 * refresca, los otros se quedan con el token anterior —que el servidor acaba
 * de invalidar— y el siguiente pedido que hagan vuelve 401. Se vio en las
 * capturas: `401 en /rest/v1/descansos`, con la sesión perfectamente viva.
 *
 * Con un cliente por pestaña hay un solo temporizador y una sola copia, así
 * que no hay nada que se pueda desincronizar consigo mismo.
 */
let unico: ReturnType<typeof createBrowserClient> | null = null;

export function crearCliente() {
  if (process.env.NODE_ENV !== 'production' && !configuracionValida()) {
    console.error(
      '[Ascent] NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY faltan o están mal.\n' +
        `URL: ${URL_SUPA ?? '(vacía)'}\n` +
        `Clave: ${CLAVE ? `${CLAVE.length} caracteres` : '(vacía)'} — la anon key tiene ~208.`
    );
  }
  // En el servidor NO se cachea: cada pedido tiene sus propias cookies, y
  // compartir un cliente entre pedidos mezclaría sesiones de personas
  // distintas. Ahí `createBrowserClient` no se usa igual, pero la guarda queda
  // dicha por si alguien mueve esto de lugar.
  if (typeof window === 'undefined') return createBrowserClient(URL_SUPA!, CLAVE!);
  unico ??= createBrowserClient(URL_SUPA!, CLAVE!);
  return unico;
}
