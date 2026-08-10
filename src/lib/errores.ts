import type { AuthError } from '@supabase/supabase-js';

/**
 * Traduce un error de auth a algo que el usuario pueda accionar.
 *
 * Lo importante: NO todos los fallos son "contraseña equivocada". Si la app
 * está mal configurada o no hay red, decirle a la persona que se equivocó de
 * datos la manda a probar contraseñas para siempre.
 */
export function mensajeDeAuth(error: AuthError | { message?: string; status?: number } | null): string {
  if (!error) return '';
  const m = (error.message ?? '').toLowerCase();

  if (m.includes('invalid api key') || m.includes('no api key')) {
    return 'La app no está bien configurada y no puede hablar con el servidor. No es tu contraseña.';
  }
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) {
    return 'No hay conexión con el servidor. Fijate si tenés internet y probá de nuevo.';
  }
  if (m.includes('email not confirmed')) {
    return 'Falta confirmar la cuenta desde el correo que te llegó.';
  }
  if (m.includes('email rate limit') || m.includes('rate limit') || error.status === 429) {
    return 'Demasiados intentos seguidos. Esperá unos minutos.';
  }
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials')) {
    return 'Ese correo y esa contraseña no coinciden.';
  }
  if (m.includes('user already registered')) {
    return 'Ya hay una cuenta con ese correo. Probá entrar, o pedí una contraseña nueva.';
  }
  if (m.includes('password should be')) {
    return 'La contraseña tiene que tener al menos 6 caracteres.';
  }
  return 'Algo falló al entrar. Probá de nuevo en un momento.';
}
