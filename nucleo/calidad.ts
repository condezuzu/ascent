/**
 * LA CALIDAD DEL FONDO, y cuándo bajarla sola (8/10).
 *
 * El fondo es un motor 3D dibujando a pantalla completa. En un teléfono viejo
 * no da: la app entera va a los saltos, porque el motor y los toques comparten
 * el mismo hilo. Antes había una sola calidad para todos.
 *
 * Ahora hay dos, y por omisión elige la app: mide cuántos cuadros por segundo
 * salen de verdad —la misma medición que ya tenía Diagnóstico— y si no llega,
 * baja. La persona también puede fijarla a mano en Ajustes.
 *
 * QUÉ CAMBIA EN "BAJA": la mitad de resolución en el fondo (es lo que más pesa:
 * cada píxel se calcula) y menos partículas. El resto de la app no cambia.
 *
 * NO IMPORTA NADA del teléfono: se prueba con node pelado. Medir y guardar
 * viven en `movil/src/calidad.ts`.
 */

/** Lo que eligió la persona. */
export type PreferenciaDeCalidad = 'auto' | 'alta' | 'baja';
/** Con qué se dibuja. */
export type Calidad = 'alta' | 'baja';

export const CLAVE_CALIDAD = 'ascent:calidad';
/** Lo que decidió la app sola en este teléfono. Solo se guarda "baja". */
export const CLAVE_CALIDAD_MEDIDA = 'ascent:calidad-medida';
export const CALIDAD_CAMBIO = 'ascent:calidad-cambio';

export function preferenciaValida(x: unknown): PreferenciaDeCalidad {
  return x === 'alta' || x === 'baja' ? x : 'auto';
}

/** A mano manda; en automático, lo que se midió. */
export function calidadEfectiva(preferencia: PreferenciaDeCalidad, medidaBaja: boolean): Calidad {
  if (preferencia !== 'auto') return preferencia;
  return medidaBaja ? 'baja' : 'alta';
}

/** Hasta cuántos píxeles por punto se dibuja el fondo. */
export function densidadTope(calidad: Calidad): number {
  return calidad === 'baja' ? 1 : 2;
}

/** El nivel de partículas del motor (ver `FACTOR` en `compartido/motor/escena.ts`). */
export function nivelDelMotor(calidad: Calidad): 'bajo' | 'medio' {
  return calidad === 'baja' ? 'bajo' : 'medio';
}

/** Por debajo de esto, promedio, la app se siente a los saltos. */
export const FPS_MINIMO = 40;
/** Cuántos segundos dura cada medición. */
export const SEGUNDOS_DE_MEDICION = 6;
/** Cuánto se espera antes de medir: el arranque siempre va a los saltos. */
export const ESPERA_ANTES_DE_MEDIR_MS = 8000;
/**
 * DOS SEGUIDAS, no una: una medición mala puede ser la app cargando algo, una
 * notificación, el teléfono caliente un momento. Bajar la calidad es para el
 * teléfono que no da, no para el que tuvo un mal segundo.
 */
export const MALAS_PARA_BAJAR = 2;

/**
 * QUÉ DICE UNA MEDICIÓN. `null` = no sirve: si tardó bastante más de lo pedido
 * es que la app estuvo en segundo plano en el medio —ahí no se dibuja nada y
 * los cuadros "faltan" sin que el teléfono tenga la culpa—.
 */
export function veredictoDeMedicion(m: { fps: number; ms: number; cuadros: number } | null, segundos = SEGUNDOS_DE_MEDICION): 'bien' | 'mal' | null {
  if (!m || m.cuadros < 2) return null;
  if (m.ms > segundos * 1000 * 1.25) return null;
  return m.fps < FPS_MINIMO ? 'mal' : 'bien';
}

/** Lleva la cuenta de las malas seguidas. Una buena, o una que no sirve, no baja nada. */
export function trasMedir(malasSeguidas: number, veredicto: 'bien' | 'mal' | null): { malas: number; bajar: boolean } {
  if (veredicto === null) return { malas: malasSeguidas, bajar: false };
  if (veredicto === 'bien') return { malas: 0, bajar: false };
  const malas = malasSeguidas + 1;
  return { malas, bajar: malas >= MALAS_PARA_BAJAR };
}
