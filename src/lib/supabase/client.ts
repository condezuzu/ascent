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

export function crearCliente() {
  if (process.env.NODE_ENV !== 'production' && !configuracionValida()) {
    console.error(
      '[Ascent] NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY faltan o están mal.\n' +
        `URL: ${URL_SUPA ?? '(vacía)'}\n` +
        `Clave: ${CLAVE ? `${CLAVE.length} caracteres` : '(vacía)'} — la anon key tiene ~208.`
    );
  }
  return createBrowserClient(URL_SUPA!, CLAVE!);
}
