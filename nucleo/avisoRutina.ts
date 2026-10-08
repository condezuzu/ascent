/**
 * EL AVISO DE QUE TU RUTINA AHORA SE VE (8/10/2026).
 *
 * La rutina a la vista de los amigos nació prendida —una función social
 * apagada no la encuentra nadie— y con 42 cuentas ya creadas. Entonces se
 * AVISA, una vez: que se ve, y que se apaga en Ajustes.
 *
 * UNA VEZ POR CUENTA EN CADA TELÉFONO. Lo visto se guarda en el aparato, como
 * la guía; guardarlo en la base pedía otra migración. Quien use dos teléfonos
 * lo ve en los dos.
 */

export const CLAVE_AVISO_RUTINA = 'ascent:aviso-rutina';

/** Las cuentas que ya lo vieron en este aparato. Basura de otra versión = nadie. */
export function quienesLoVieron(crudo: string | null | undefined): string[] {
  try {
    const lista = JSON.parse(crudo ?? '[]');
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function conEsteVisto(crudo: string | null | undefined, uid: string): string {
  return JSON.stringify([...new Set([...quienesLoVieron(crudo), uid])]);
}

/**
 * ¿Se muestra ahora? No con el recorrido andando —son dos tarjetas en el mismo
 * lugar y la guía va primero—: queda para la próxima vez que se abra. Y no a
 * quien ya la escondió, ni si no se pudo saber cómo la tiene.
 */
export function tocaAvisarDeLaRutina(e: {
  uid: string;
  vistoPor: string[];
  recorridoAndando: boolean;
  /** `null` = la base todavía no tiene la función, o no se pudo preguntar. */
  comparte: boolean | null;
}): boolean {
  return !!e.uid && e.comparte === true && !e.recorridoAndando && !e.vistoPor.includes(e.uid);
}
