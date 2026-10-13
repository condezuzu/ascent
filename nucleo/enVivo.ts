/**
 * ENTRENAR CON OTRO, la versión chica (12/10/2026, migración 67).
 *
 * De a dos. Uno pide unirse al entrenamiento de un amigo; si acepta, cada uno
 * ve del otro en qué ejercicio está, qué serie y cuánto le falta de descanso.
 * Nunca los pesos ni cuánto lleva.
 *
 * CÓMO ESTÁ HECHO, y por qué así: el teléfono PUBLICA una foto de lo que
 * muestra su pantalla, por un canal aparte, y NUNCA LEE DE VUELTA. No toca el
 * contador, la cola ni la caché. Es lo que permite hacerlo sin el "un solo
 * dueño del estado" (ver `spec/alcance.md`): si las copias del estado no
 * coinciden un instante, el otro ve un parpadeo, y a nadie se le rompe nada.
 *
 * LOS LÍMITES ACEPTADOS: se actualiza cada `CADA_CUANTO_MS`, no en vivo; con el
 * teléfono bloqueado la app no corre y el renglón queda congelado (el descanso
 * se sigue viendo bien: se publica cuándo termina, no cuánto falta ahora).
 *
 * NO IMPORTA NADA del teléfono: se prueba con node pelado.
 */

/** Se prendió o apagó "Avisar cuando entreno": si hay una sesión corriendo, tiene que surtir efecto YA. */
export const AVISO_DE_ENTRENO_CAMBIO = 'ascent:aviso-de-entreno-cambio';

/**
 * DESPUÉS DE "TERMINAR", NO SE VUELVE A MARCAR "ENTRENANDO" (12/10). Se termina
 * estando todavía en el gimnasio, y el vigilante —que marca la presencia al
 * verte adentro— te volvía a poner en "Entrenando ahora" a los dos minutos, con
 * su botón "Unirse" y sin nadie del otro lado para contestar. La pausa dura lo
 * que dura la marca; iniciar otra sesión la levanta.
 */
export const CLAVE_NO_AVISAR_HASTA = 'ascent:no-avisar-hasta';
export const PAUSA_TRAS_TERMINAR_MS = 2 * 60 * 60 * 1000;

export function puedeMarcarPresencia(noAvisarHasta: string | null | undefined, ahora: number): boolean {
  const hasta = Number(noAvisarHasta);
  return !(Number.isFinite(hasta) && hasta > ahora);
}

/** Cada cuánto se vuelve a preguntar. */
export const CADA_CUANTO_MS = 10_000;
/** Sin novedades por más de esto, el renglón dice "sin señal". */
export const SIN_SENAL_S = 120;

export type LoPublicado = { ejercicio: string | null; serie: number; meta: number; descansoFaltan: number | null };

/**
 * QUÉ SE PUBLICA, a partir de lo que muestra la pantalla. Sin sesión corriendo
 * no hay nada que publicar (`null`).
 */
export function loQueSePublica(
  e: { corriendo: boolean; ejercicio: string | null; hechas: number; meta: number; descansoFin: number | null },
  ahoraMs: number
): LoPublicado | null {
  if (!e.corriendo) return null;
  const faltan = e.descansoFin === null ? null : Math.ceil((e.descansoFin - ahoraMs) / 1000);
  return {
    ejercicio: e.ejercicio,
    serie: Math.max(0, Math.round(e.hechas)),
    meta: Math.max(0, Math.round(e.meta)),
    descansoFaltan: faltan !== null && faltan > 0 ? faltan : null,
  };
}

/**
 * Para no mandar dos veces lo mismo. El descanso entra por SU FIN y no por lo
 * que falta: lo que falta cambia cada segundo y sería publicar sin parar.
 */
export function firmaDe(e: { corriendo: boolean; ejercicio: string | null; hechas: number; meta: number; descansoFin: number | null }): string {
  return [e.corriendo ? 1 : 0, e.ejercicio ?? '', e.hechas, e.meta, e.descansoFin ?? ''].join('|');
}

export type Union = {
  id: string;
  estado: 'pendiente' | 'aceptada';
  laPediYo: boolean;
  otro: { id: string; username: string; avatar_url: string | null };
  /** El reloj de la base cuando contestó, en ms. */
  ahora: number;
  enVivo: { ejercicio: string | null; serie: number; meta: number; descansoFin: number | null; actualizado: number } | null;
};

const ms = (x: unknown): number | null => {
  const n = typeof x === 'string' ? Date.parse(x) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Lo que manda `mis_uniones`, con forma. Lo que no la tenga, afuera. */
export function leerUniones(crudo: unknown): Union[] {
  if (!Array.isArray(crudo)) return [];
  const r: Union[] = [];
  for (const x of crudo as Record<string, unknown>[]) {
    const otro = x?.otro as { id?: unknown; username?: unknown; avatar_url?: unknown } | null;
    const ahora = ms(x?.ahora);
    if (!x || typeof x.id !== 'string' || !otro || typeof otro.id !== 'string' || ahora === null) continue;
    if (x.estado !== 'pendiente' && x.estado !== 'aceptada') continue;
    const v = x.en_vivo as Record<string, unknown> | null;
    r.push({
      id: x.id,
      estado: x.estado,
      laPediYo: x.la_pedi_yo === true,
      otro: { id: otro.id, username: typeof otro.username === 'string' ? otro.username : '', avatar_url: typeof otro.avatar_url === 'string' ? otro.avatar_url : null },
      ahora,
      enVivo:
        x.estado === 'aceptada' && v
          ? {
              ejercicio: typeof v.ejercicio === 'string' ? v.ejercicio : null,
              serie: Number(v.serie) || 0,
              meta: Number(v.meta) || 0,
              descansoFin: ms(v.descanso_fin),
              actualizado: ms(v.actualizado) ?? ahora,
            }
          : null,
    });
  }
  return r;
}

export type Renglon = {
  /** `null` = todavía no publicó nada (aceptó y no tocó nada, o no está entrenando). */
  ejercicio: string | null;
  serie: number;
  meta: number;
  /** Segundos que le faltan de descanso; 0 = terminó recién; `null` = no está descansando. */
  descanso: number | null;
  sinSenal: boolean;
  sinDatos: boolean;
};

/**
 * LO QUE SE DIBUJA DE UN ACEPTADO, ahora. Todo se mide contra el reloj de la
 * BASE: `u.ahora` es lo que marcaba cuando contestó y `pasaronMs` lo que corrió
 * en este teléfono desde entonces. Así dos teléfonos con la hora distinta ven
 * la misma cuenta.
 */
export function renglonDe(u: Union, pasaronMs: number): Renglon {
  const v = u.enVivo;
  if (!v) return { ejercicio: null, serie: 0, meta: 0, descanso: null, sinSenal: false, sinDatos: true };
  const ahoraBase = u.ahora + Math.max(0, pasaronMs);
  const faltan = v.descansoFin === null ? null : Math.ceil((v.descansoFin - ahoraBase) / 1000);
  return {
    ejercicio: v.ejercicio,
    serie: v.serie,
    meta: v.meta,
    // Un descanso que terminó hace más de un minuto ya no es noticia.
    descanso: faltan === null || faltan < -60 ? null : Math.max(0, faltan),
    sinSenal: (ahoraBase - v.actualizado) / 1000 > SIN_SENAL_S,
    sinDatos: false,
  };
}

/** Con quién tengo algo (pedido o aceptado), para saber qué botón va en cada fila. */
export function unionCon(uniones: Union[], id: string): Union | null {
  return uniones.find((u) => u.otro.id === id) ?? null;
}
