import { DESCANSO_MAXIMO, DESCANSO_MINIMO, DESCANSO_PREDETERMINADO } from '@/lib/reglas';

const CLAVE = 'ascent:descanso';

export type DescansoVivo = { fin: number; duracion: number };

/**
 * El descanso en curso vive en `localStorage`, no en la base (§18.3): no hay
 * ningún dato que valga guardar y son quince o veinte descansos por sesión,
 * en un gimnasio con dos rayas de señal. Tiene que arrancar al instante y sin
 * red.
 *
 * Se guarda el timestamp de FIN, no el de inicio ni los segundos restantes:
 * así `restante = fin - ahora` sobrevive a que se apague la pantalla, a que la
 * app pase a segundo plano y a que se cierre entera (§18.4).
 *
 * Acá el reloj del teléfono alcanza, a diferencia de la sesión: las dos puntas
 * de la cuenta salen del mismo reloj, así que el desfasaje se cancela solo, y
 * no hay nada que ganar haciendo trampa —descansar de más no es un premio—.
 */
export function leerDescanso(): DescansoVivo | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const d = JSON.parse(crudo) as DescansoVivo;
    if (typeof d?.fin !== 'number' || typeof d?.duracion !== 'number') return null;
    return d;
  } catch {
    // localStorage puede estar lleno, deshabilitado o con basura de otra
    // versión. Nada de esto puede tumbar la pantalla principal.
    return null;
  }
}

export function guardarDescanso(duracion: number): DescansoVivo {
  const d = { fin: Date.now() + duracion * 1000, duracion };
  try {
    localStorage.setItem(CLAVE, JSON.stringify(d));
  } catch {
    // Si no se puede guardar, el descanso igual corre en memoria; lo único
    // que se pierde es que sobreviva a cerrar la app.
  }
  return d;
}

export function borrarDescanso() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* nada que hacer */
  }
}

/** Segundos que faltan. Nunca negativo: cero es cero. */
export function restante(fin: number): number {
  return Math.max(0, Math.ceil((fin - Date.now()) / 1000));
}

/** "2:30". Siempre con minutos, aunque falten segundos: es una cuenta atrás. */
export function cuentaAtras(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Para etiquetas y presets: "60 s", "90 s", "3 min".
 *
 * Abajo de dos minutos se dice en segundos y no en minutos: en una fila de
 * presets, "1:30" se lee como un reloj y "90 s" se lee como una opción. Es la
 * diferencia entre elegir y tener que interpretar.
 */
export function duracionCorta(segundos: number): string {
  if (segundos < 120) return `${segundos} s`;
  if (segundos % 60 === 0) return `${segundos / 60} min`;
  return cuentaAtras(segundos);
}

/** Lo que venga de la base, acotado a lo que la columna acepta. */
export function duracionValida(valor: unknown): number {
  const n = Number(valor);
  if (!Number.isFinite(n)) return DESCANSO_PREDETERMINADO;
  return Math.min(DESCANSO_MAXIMO, Math.max(DESCANSO_MINIMO, Math.round(n)));
}

/**
 * Vibra si el teléfono puede. En iPhone NO puede: WebKit nunca implementó la
 * Vibration API (§18.7). Devuelve si vibró, para no prometer en la interfaz
 * algo que no va a pasar.
 *
 * El patrón es doble a propósito: un pulso solo se confunde con cualquier
 * notificación.
 */
export function vibrar(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
  return navigator.vibrate([120, 90, 120]);
}

export function puedeVibrar(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

const CLAVE_SONIDO = 'ascent:descanso-sonido';

/**
 * Si el aviso suena, además de vibrar. **Apagado por defecto**: sonar sin
 * avisar en un gimnasio es peor que no sonar (§18.7).
 *
 * Va en localStorage y no en `profiles` a propósito: es una preferencia del
 * TELÉFONO, no de la cuenta. El mismo usuario puede querer sonido en casa y
 * no en el gimnasio, y eso no viaja con la sesión.
 */
export function leerSonido(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(CLAVE_SONIDO) === '1';
  } catch {
    return false;
  }
}

export function guardarSonido(prendido: boolean) {
  try {
    localStorage.setItem(CLAVE_SONIDO, prendido ? '1' : '0');
  } catch {
    /* nada que hacer */
  }
}
