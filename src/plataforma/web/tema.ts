// EL RANGO PROPIO, SABIDO ANTES DE PINTAR (19/9).
//
// Cada pantalla dibujaba primero con `rango={1}` —la paleta gris— mientras
// esperaba el perfil, y recién después se teñía. Se veía en todas: Inicio,
// Stats, al deslizar entre pestañas. Nunca tendría que verse la app sin su
// rango.
//
// Acá se guarda el último tema PROPIO que se supo (el rango, el planeta y las
// variables de CSS que salen de ellos), y `SCRIPT_TEMA` lo aplica desde el
// `<head>` antes del primer cuadro, antes de que corra React. Es web y es
// sincrónico a propósito: por eso vive en la plataforma y no pasa por el
// almacenamiento asincrónico.
//
// Solo lo propio: el perfil de otra persona tiene su rango y no puede quedar
// como el color de la app.

const CLAVE = 'ascent:tema';

export type TemaGuardado = {
  rango: number;
  planeta: string | null;
  /** Las variables de CSS, tal cual se aplican. */
  v: Record<string, string>;
};

export function guardarTema(t: TemaGuardado) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(t));
  } catch {
    // sin almacenamiento: la próxima vez arranca con el de por omisión
  }
}

export function leerTema(): TemaGuardado | null {
  try {
    const t = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as TemaGuardado | null;
    return t && typeof t.rango === 'number' && t.v && typeof t.v === 'object' ? t : null;
  } catch {
    return null;
  }
}

/** Al salir de la cuenta: la próxima no puede arrancar con el color de esta. */
export function borrarTema() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // nada
  }
}

/**
 * Va en el `<head>`, en línea: corre antes de pintar nada. Escrito a mano y
 * chico: no puede importar nada, y si falla no pasa nada (queda el gris de
 * siempre, que es lo que había).
 */
export const SCRIPT_TEMA = `try{var t=JSON.parse(localStorage.getItem('${CLAVE}'));if(t&&t.v){var s=document.documentElement.style;for(var k in t.v)if(/^--[a-z-]+$/.test(k))s.setProperty(k,String(t.v[k]))}}catch(e){}`;
