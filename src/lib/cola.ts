import { plataforma } from '@/plataforma';
import { eventos } from '@/plataforma/eventos';
import { anotar } from '@/lib/bitacora';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Escrituras que insisten hasta entrar, y un aviso cuando algo no se pudo.
 *
 * LOS DOS SON EL MISMO PROBLEMA: fallar en silencio. Tocás el `+`, no pasa
 * nada, tocás de nuevo. Subís una foto y creés que se subió. Apagás un
 * interruptor y vuelve solo. En un gimnasio —que es un subsuelo donde la red
 * se corta— eso pasa seguido, y la app no decía nada nunca.
 *
 * Hay dos respuestas y no una, porque no todas las escrituras son iguales:
 *
 * **LO QUE SE PUEDE REINTENTAR SOLO** va a la cola. Vale más que un mensaje de
 * error: el `+` funciona sin red y se sincroniza después, y la persona no se
 * entera de nada porque no hace falta que se entere.
 *
 * **LO QUE NO SE PUEDE** se dice, con `avisarFallo`. Y no se puede casi nunca,
 * por dos razones que conviene tener claras:
 *
 * - *No es idempotente.* Reintentar `iniciar_sesion` no es inofensivo. Solo
 *   entran a la cola las escrituras que repetidas dan lo mismo.
 * - *Significa algo distinto más tarde.* `anotar_peso` y `registrar_dia`
 *   escriben sobre HOY, y hoy lo decide el servidor cuando la llamada llega.
 *   Si una de esas se vacía mañana, anota el día equivocado — que es peor que
 *   perderla. Por eso `fijar_series` lleva el id de la sesión: para que
 *   vaciarse tarde no la mande a otro lado.
 */

const CLAVE = 'ascent:cola';
const TOPE = 200;

/** Un aviso de que algo no se pudo guardar. Lo pinta `AvisoDeFallo`. */
export const FALLO = 'ascent:fallo';

export function avisarFallo(que: string) {
  eventos.emitir(FALLO, que);
}

/**
 * Lo único que entra a la cola por ahora. Es a propósito que sea una lista
 * cerrada y no cualquier RPC: que algo se pueda reintentar es una propiedad
 * que hay que demostrar una por una, no una que se asuma.
 */
type Encolable =
  | { rpc: 'fijar_series'; args: { p_sesion: string; p_series: number } }
  // `fijar_bloques` entra por las MISMAS dos razones, demostradas una por una:
  //
  // - *Idempotente*: manda la lista entera, no "agregá un bloque". Repetirla
  //   deja exactamente el mismo estado, que es lo que hace segura la cola
  //   cuando la respuesta se pierde pero la escritura llegó.
  // - *No cambia de significado más tarde*: lleva el id de la sesión, así que
  //   vaciarse mañana la sigue mandando a la sesión de ayer, que es la que
  //   corresponde. Sin el id iría a parar a la de mañana.
  | { rpc: 'fijar_bloques'; args: { p_sesion: string; p_bloques: unknown } };

type Pendiente = Encolable & { id: string };

async function leer(): Promise<Pendiente[]> {
  try {
    const crudo = await plataforma.almacenamiento.leer(CLAVE);
    if (!crudo) return [];
    const l = JSON.parse(crudo);
    return Array.isArray(l) ? l : [];
  } catch {
    return [];
  }
}

async function guardar(l: Pendiente[]) {
  try {
    await plataforma.almacenamiento.guardar(CLAVE, JSON.stringify(l.slice(-TOPE)));
  } catch {
    // Si el almacenamiento está lleno se pierde la cola, no la app.
  }
}

/**
 * Mete algo en la cola y trata de vaciarla ya.
 *
 * `id` se usa para pisar lo anterior de la MISMA sesión: no tiene sentido
 * guardar cuarenta pendientes que dicen "las series son 1", "son 2", "son 3".
 * Solo importa el último, y así diez toques sin red se vacían en una llamada.
 */
export async function encolar(supabase: SupabaseClient, tarea: Encolable) {
  const id = `${tarea.rpc}:${tarea.args.p_sesion}`;
  const lista = (await leer()).filter((p) => p.id !== id);
  lista.push({ ...tarea, id });
  await guardar(lista);
  await vaciar(supabase);
}

let vaciando = false;

/** Manda lo pendiente, en orden, y se queda con lo que no entró. */
export async function vaciar(supabase: SupabaseClient) {
  // Una sola pasada a la vez: dos en paralelo mandarían lo mismo dos veces y,
  // peor, la segunda podría borrar de la cola algo que la primera no mandó.
  if (vaciando) return;
  vaciando = true;
  try {
    const lista = await leer();
    if (lista.length === 0) return;
    const quedan: Pendiente[] = [];
    let corto = false;
    for (const p of lista) {
      // Al primero que falla se corta y el resto queda para la próxima: si es
      // la red, los que siguen van a fallar igual y son viajes al vacío. Pero
      // NO se descartan — se guardan, que es la diferencia entre una cola y
      // tirar el trabajo a la basura.
      if (corto) {
        quedan.push(p);
        continue;
      }
      const { error } = await supabase.rpc(p.rpc, p.args);
      if (error) {
        quedan.push(p);
        corto = true;
      }
    }
    await guardar(quedan);
    if (quedan.length > 0) await anotar('quedan pendientes', { cuantas: quedan.length });
    else await anotar('cola vaciada', { cuantas: lista.length });
  } finally {
    vaciando = false;
  }
}

/** Cuántas escrituras están esperando. Para el Diagnóstico. */
export async function cuantasPendientes(): Promise<number> {
  return (await leer()).length;
}
