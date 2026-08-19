import { TOPE_SESION_SEGUNDOS, DESCANSO_PREDETERMINADO } from '@/lib/reglas';

const CLAVE = 'ascent:sesion';
const CLAVE_DURACION = 'ascent:descanso-sesion';

/**
 * El evento `storage` del navegador solo llega a las OTRAS pestañas, nunca a
 * la que escribió. Sin este aviso propio, la franja no aparecía hasta cambiar
 * de pantalla: empezabas la sesión y no pasaba nada visible abajo.
 */
export const AVISO = 'ascent:sesion-cambio';

function avisar() {
  try {
    window.dispatchEvent(new Event(AVISO));
  } catch {
    // en el servidor no hay window; la franja no se pinta ahí de todos modos
  }
}

export type SesionCacheada = { inicio: string; desfasaje: number };

/**
 * Caché de la sesión en curso, en el propio teléfono.
 *
 * Existe para que la franja de arriba de la barra (§17.6b) se pinte en TODAS
 * las pantallas sin pedir un `mi_sesion` por navegación. La base sigue siendo
 * la autoridad: `/sesion` la consulta de verdad y pisa esto con lo que diga.
 *
 * Se guarda el `inicio` del servidor y el desfasaje del reloj del teléfono,
 * que es todo lo que hace falta para contar (§17.5).
 */
export function guardarSesionCache(s: SesionCacheada) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(s));
  } catch {
    // sin localStorage: la franja no aparece, la sesión sigue igual
  }
  avisar();
}

/**
 * Devuelve la sesión cacheada, o null si no hay o si ya pasó el tope de 4
 * horas. Ese vencimiento lo aplica también el servidor (§17.3): sin esto la
 * franja seguiría mostrando una sesión que la base ya dio por abandonada.
 */
export function leerSesionCache(): SesionCacheada | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const s = JSON.parse(crudo) as SesionCacheada;
    if (typeof s?.inicio !== 'string' || typeof s?.desfasaje !== 'number') return null;
    const corridos = (Date.now() - s.desfasaje - Date.parse(s.inicio)) / 1000;
    if (!Number.isFinite(corridos) || corridos >= TOPE_SESION_SEGUNDOS) {
      borrarSesionCache();
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function borrarSesionCache() {
  try {
    localStorage.removeItem(CLAVE);
    sessionStorage.removeItem(CLAVE_DURACION);
  } catch {
    // nada que hacer
  }
  avisar();
}

/**
 * La duración de descanso elegida con un preset vale para lo que queda de
 * ESTA sesión y no pisa el predeterminado de Ajustes (§18.5).
 *
 * Va en `sessionStorage` y no en estado de React porque la franja se vuelve a
 * montar en cada pantalla; y no en `localStorage` porque tiene que morirse al
 * cerrar la app: mañana se arranca con el predeterminado, no con los 90
 * segundos de los accesorios de ayer.
 */
export function leerDuracionDeSesion(): number | null {
  try {
    const v = Number(sessionStorage.getItem(CLAVE_DURACION));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function guardarDuracionDeSesion(segundos: number) {
  try {
    sessionStorage.setItem(CLAVE_DURACION, String(segundos));
  } catch {
    // nada que hacer: se sigue usando el predeterminado
  }
}

/** El predeterminado del perfil, o 3 minutos si todavía no llegó. */
export function duracionPredeterminada(perfil: { duracion_descanso?: number } | null): number {
  return perfil?.duracion_descanso ?? DESCANSO_PREDETERMINADO;
}
