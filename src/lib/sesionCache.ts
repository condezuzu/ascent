import { TOPE_SESION_SEGUNDOS, DESCANSO_PREDETERMINADO } from '@/lib/reglas';
import { plataforma } from '@/plataforma';
import type { Vigilancia } from '@/lib/llegada';
import { eventos } from '@/plataforma/eventos';

const CLAVE = 'ascent:sesion';
const CLAVE_LLEGADA = 'ascent:llegada';
const CLAVE_DURACION = 'ascent:descanso-sesion';

/**
 * El evento `storage` del navegador solo llega a las OTRAS pestañas, nunca a
 * la que escribió. Sin este aviso propio, la franja no aparecía hasta cambiar
 * de pantalla: empezabas la sesión y no pasaba nada visible abajo.
 */
export const AVISO = 'ascent:sesion-cambio';

const avisar = () => eventos.emitir(AVISO);

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
export async function guardarSesionCache(s: SesionCacheada) {
  await plataforma.almacenamiento.guardar(CLAVE, JSON.stringify(s));
  avisar();
}

/**
 * Devuelve la sesión cacheada, o null si no hay o si ya pasó el tope de 4
 * horas. Ese vencimiento lo aplica también el servidor (§17.3): sin esto la
 * franja seguiría mostrando una sesión que la base ya dio por abandonada.
 */
export async function leerSesionCache(): Promise<SesionCacheada | null> {
  const crudo = await plataforma.almacenamiento.leer(CLAVE);
  if (!crudo) return null;
  try {
    const s = JSON.parse(crudo) as SesionCacheada;
    if (typeof s?.inicio !== 'string' || typeof s?.desfasaje !== 'number') return null;
    const corridos = (Date.now() - s.desfasaje - Date.parse(s.inicio)) / 1000;
    if (!Number.isFinite(corridos) || corridos >= TOPE_SESION_SEGUNDOS) {
      await borrarSesionCache();
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export async function borrarSesionCache() {
  await plataforma.almacenamiento.borrar(CLAVE);
  await plataforma.efimero.borrar(CLAVE_DURACION);
  avisar();
}

/**
 * La duración de descanso elegida con un preset vale para lo que queda de
 * ESTA sesión y no pisa el predeterminado de Ajustes (§18.5).
 *
 * Va en el almacenamiento EFÍMERO y no en estado de React porque la franja se
 * vuelve a montar en cada pantalla; y no en el persistente porque tiene que
 * morirse al cerrar la app: mañana se arranca con el predeterminado, no con
 * los 90 segundos de los accesorios de ayer.
 */
export async function leerDuracionDeSesion(): Promise<number | null> {
  const v = Number(await plataforma.efimero.leer(CLAVE_DURACION));
  return Number.isFinite(v) && v > 0 ? v : null;
}

export function guardarDuracionDeSesion(segundos: number) {
  return plataforma.efimero.guardar(CLAVE_DURACION, String(segundos));
}

/** El predeterminado del perfil, o 3 minutos si todavía no llegó. */
export function duracionPredeterminada(perfil: { duracion_descanso?: number } | null): number {
  return perfil?.duracion_descanso ?? DESCANSO_PREDETERMINADO;
}

// ---------------------------------------------------------------
// La visita al gimnasio en curso (§13)
//
// Sobrevive a cerrar la app a propósito: si llegaste, cerraste la app y la
// volviste a abrir a los diez minutos, la llegada sigue siendo la de antes y
// la sesión arranca con la hora correcta. Si esto viviera en estado de React
// se perdería en cada recarga y la espera empezaría de nuevo cada vez.
// ---------------------------------------------------------------

export async function leerVigilancia(): Promise<Vigilancia | null> {
  const crudo = await plataforma.almacenamiento.leer(CLAVE_LLEGADA);
  if (!crudo) return null;
  try {
    const v = JSON.parse(crudo) as Vigilancia;
    if (typeof v?.desde !== 'number' || typeof v?.ultimoAdentro !== 'number') return null;
    if (!Number.isFinite(v.desde) || !Number.isFinite(v.ultimoAdentro)) return null;
    return { desde: v.desde, ultimoAdentro: v.ultimoAdentro, arranco: v.arranco === true };
  } catch {
    return null;
  }
}

export async function guardarVigilancia(v: Vigilancia | null) {
  if (!v) return plataforma.almacenamiento.borrar(CLAVE_LLEGADA);
  return plataforma.almacenamiento.guardar(CLAVE_LLEGADA, JSON.stringify(v));
}
