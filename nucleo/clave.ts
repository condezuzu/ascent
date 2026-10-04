import { T } from './textos.ts';

/**
 * ELEGIR UNA CONTRASEÑA NUEVA, sin la pantalla. Lo usan la web
 * (`/nueva-clave`) y la app nativa (`ClaveNueva`), que hasta el 4/10 no tenía
 * dónde elegirla: el enlace del correo te dejaba adentro y nada más.
 */

/** Por qué esa clave no sirve, o `null` si sirve. */
export function claveNuevaInvalida(clave: string, repetida: string): string | null {
  if (clave.length < 6) return T.clave.corta;
  if (clave !== repetida) return T.clave.noCoinciden;
  return null;
}

/**
 * Lo que se dice cuando la base no la cambió. "Es la misma" se reconoce por el
 * CÓDIGO (`same_password`), que es lo estable; el texto queda de respaldo
 * porque cambió entre versiones del servidor y la web miraba solo eso.
 */
export function porQueNoCambio(e: { code?: string; message?: string } | null | undefined): string {
  const esLaMisma = e?.code === 'same_password' || /same|different from the old/i.test(e?.message ?? '');
  return esLaMisma ? T.clave.esLaMisma : T.clave.noSePudo;
}
