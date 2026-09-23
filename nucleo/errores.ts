import { T } from './textos.ts';

/**
 * Traduce un error de auth a algo que el usuario pueda accionar.
 *
 * VIVE EN EL NÚCLEO porque las dos apps entran con la misma base y tienen que
 * decir lo mismo cuando algo falla. Y no importa el tipo `AuthError` de
 * supabase-js a propósito: la firma estructural —lo que se lee es `message` y
 * `status`— alcanza, y así este archivo no importa nada de afuera.
 *
 * Lo importante: NO todos los fallos son "contraseña equivocada". Si la app
 * está mal configurada o no hay red, decirle a la persona que se equivocó de
 * datos la manda a probar contraseñas para siempre.
 */
/**
 * ¿ESTA CUENTA YA NO EXISTE, o simplemente no se pudo preguntar?
 *
 * DE DÓNDE SALE. Borrar la cuenta desde otro aparato deja este con un token
 * guardado que sigue siendo válido —está firmado y no venció—, pero que apunta
 * a un usuario que ya no está. El teléfono cree que hay sesión, pide el perfil,
 * no viene ninguna fila, y la pantalla dice "algo falló, probá de nuevo" con un
 * botón de reintentar que no puede funcionar nunca. Encontrado el 25/9 al
 * rehacer la cuenta de App Review con la app abierta.
 *
 * Y NO ALCANZA CON VOLVER AL LOGIN: el token sigue en el almacenamiento, así
 * que la raíz lo vuelve a encontrar y entra a la misma pantalla rota. Hay que
 * cerrar la sesión de verdad.
 *
 * LA DISTINCIÓN QUE IMPORTA, y por la que esto es una función y no un `if`:
 * preguntarle al servidor quién sos también falla SIN RED, y ahí cerrar la
 * sesión sería echar de la app a alguien por estar en un subsuelo —que es
 * media app de gimnasio—. Solo cuenta cuando el servidor CONTESTÓ que no.
 */
export function laCuentaYaNoExiste(error: { message?: string; status?: number } | null): boolean {
  if (!error) return false;
  const m = (error.message ?? '').toLowerCase();
  // Sin red no se concluye nada. `AuthRetryableFetchError` llega con status 0.
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) {
    return false;
  }
  if (!error.status) return false;
  // Lo que contesta GoTrue cuando el `sub` del token no está en la tabla.
  if (m.includes('does not exist') || m.includes('user_not_found') || m.includes('user not found')) {
    return true;
  }
  return error.status === 401 || error.status === 403;
}

export function mensajeDeAuth(error: { message?: string; status?: number } | null): string {
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
