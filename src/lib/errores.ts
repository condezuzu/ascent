import type { AuthError } from '@supabase/supabase-js';
import { T } from '../textos.ts';

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
    return T.errores.malConfigurada;
  }
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) {
    return T.errores.sinConexion;
  }
  if (m.includes('email not confirmed')) {
    return T.errores.sinConfirmar;
  }
  if (m.includes('email rate limit') || m.includes('rate limit') || error.status === 429) {
    return T.errores.demasiadosIntentos;
  }
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials')) {
    return T.errores.noCoinciden;
  }
  if (m.includes('user already registered')) {
    return T.errores.yaHayCuenta;
  }
  if (m.includes('password should be')) {
    return T.errores.claveCorta;
  }
  return T.errores.algoFallo;
}
