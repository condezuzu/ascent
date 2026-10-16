import { plataforma } from '@plataforma';

/**
 * SI YA VIO LA PANTALLA DE ENTRADA. Es de ESTE aparato y no de la cuenta: se
 * muestra antes de que haya cuenta, así que no hay dónde guardarla del otro
 * lado. Lo comparten las dos apps desde el 15/10 (antes vivía en la web y la
 * nativa la mostraba en cada login).
 *
 * UN APARATO CON SESIÓN YA NO LA VE (15/10): se anota también cuando hay una
 * cuenta adentro (`_layout` en la nativa, la barra de abajo en la web). Así las
 * cuentas que ya existían no la ven al salir; la ve quien llega por primera vez.
 *
 * ANTE LA DUDA, NO SE MUESTRA. Si el almacenamiento falla o devuelve basura,
 * `leer` da `null` y esto contesta que ya la vio: repetirle la entrada a alguien
 * que solo quiere entrar es peor que no mostrársela nunca a alguien nuevo.
 */
const CLAVE = 'ascent:entrada-vista';

export async function vioLaEntrada(): Promise<boolean> {
  try {
    return (await plataforma.almacenamiento.leer(CLAVE)) !== null;
  } catch {
    return true;
  }
}

export async function anotarEntradaVista(): Promise<void> {
  try {
    await plataforma.almacenamiento.guardar(CLAVE, '1');
  } catch {
    // Si no se puede anotar, la va a ver otra vez. No es lo ideal, pero no
    // rompe nada, y tirar acá dejaría a alguien sin poder entrar.
  }
}
