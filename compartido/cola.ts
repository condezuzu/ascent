import { plataforma } from '@plataforma';
import { eventos } from '@compartido/eventos';
import { anotar } from '@compartido/bitacora';
// El tipo del cliente lo pone cada app: la web y la nativa traen cada una su
// copia de supabase-js, y para TypeScript son dos clases distintas.
import type { Cliente } from '@cliente';
import { quedanTrasPasada } from '@nucleo/cola';

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
  | { rpc: 'fijar_bloques'; args: { p_sesion: string; p_bloques: unknown } }
  // `marcar_actividad` (migración 37), por las mismas dos razones:
  //
  // - *Idempotente*: la base se queda con la MÁS RECIENTE de las marcas, así
  //   que repetirla —o subirla dos veces— deja todo igual.
  // - *No cambia de significado más tarde*: lleva el id de la sesión Y la hora
  //   en que pasó. Justo para eso existe la hora: una marca que sube media
  //   hora tarde desde el subsuelo tiene que decir cuándo fue el toque, no
  //   cuándo volvió la señal.
  | { rpc: 'marcar_actividad'; args: { p_sesion: string; p_hasta: string } }
  // `elegir_carga` (migración 38): con qué se hace un ejercicio.
  //
  // - *Idempotente*: guarda EL modo, no "cambialo". Repetirla deja lo mismo.
  // - *No cambia de significado más tarde*: lleva el ejercicio. No lleva
  //   sesión porque no es de una sesión: es de la cuenta, y por eso se pisa
  //   por ejercicio y no por sesión.
  | { rpc: 'elegir_carga'; args: { p_ejercicio: string; p_carga: string } };

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

/**
 * Leer-cambiar-guardar la cola, DE A UNO. Encolar ya no espera a la red, así
 * que un toque puede encolar mientras la pasada de `vaciar` está guardando lo
 * que quedó: sin turno, uno de los dos pisa al otro y se pierde una escritura.
 */
let turno: Promise<unknown> = Promise.resolve();
function enTurno<R>(fn: () => Promise<R>): Promise<R> {
  const r = turno.then(fn, fn);
  turno = r.catch(() => undefined);
  return r;
}

async function guardar(l: Pendiente[]) {
  try {
    await plataforma.almacenamiento.guardar(CLAVE, JSON.stringify(l.slice(-TOPE)));
  } catch {
    // Si el almacenamiento está lleno se pierde la cola, no la app.
  }
}

/**
 * Mete algo en la cola y trata de vaciarla, SIN ESPERAR A LA RED.
 *
 * `id` se usa para pisar lo anterior de la MISMA sesión: no tiene sentido
 * guardar cuarenta pendientes que dicen "las series son 1", "son 2", "son 3".
 * Solo importa el último, y así diez toques sin red se vacían en una llamada.
 *
 * Vuelve apenas quedó guardado en el teléfono. Antes esperaba a que la cola
 * terminara de mandar, y cada toque del gimnasio —el `+` de 2,5 kg incluido—
 * tardaba lo que tardara la red en mover el número. Quien necesite que ya haya
 * llegado (confirmar la sesión antes de preguntarle a la base) llama a
 * `vaciar` y lo espera.
 */
export async function encolar(supabase: Cliente, tarea: Encolable) {
  const id = `${tarea.rpc}:${'p_sesion' in tarea.args ? tarea.args.p_sesion : tarea.args.p_ejercicio}`;
  await enTurno(async () => {
    const lista = (await leer()).filter((p) => p.id !== id);
    lista.push({ ...tarea, id });
    await guardar(lista);
  });
  void vaciar(supabase);
}

let pasada: Promise<void> | null = null;
let otraVez = false;

/**
 * Manda lo pendiente, en orden, y se queda con lo que no entró.
 *
 * Una sola pasada a la vez: dos en paralelo mandarían lo mismo dos veces. Si
 * se pide mientras hay una andando, se espera ESA y se hace otra al terminar,
 * para lo que se haya encolado en el medio. Así `await vaciar()` quiere decir
 * de verdad "ya se intentó mandar todo lo que había".
 */
export async function vaciar(supabase: Cliente): Promise<void> {
  if (pasada) {
    otraVez = true;
    return pasada;
  }
  pasada = (async () => {
    do {
      otraVez = false;
      const cortada = await unaPasada(supabase);
      // Sin red no se reintenta en seguida: lo agregado espera a la próxima.
      if (cortada) break;
    } while (otraVez);
  })().finally(() => {
    pasada = null;
  });
  return pasada;
}

/** Devuelve `true` si cortó por un error (la red, casi siempre). */
async function unaPasada(supabase: Cliente): Promise<boolean> {
    const lista = await enTurno(leer);
    if (lista.length === 0) return false;
    // Lo que esta pasada mandó o descartó: es lo único que se saca al final.
    const sacados: Pendiente[] = [];
    let corto = false;
    for (const p of lista) {
      const { error } = await supabase.rpc(p.rpc, p.args);
      // UNA FUNCIÓN QUE NO EXISTE NO VA A EXISTIR REINTENTANDO. Antes cualquier
      // error dejaba el pendiente al frente y cortaba la cola, así que una
      // escritura a una función de una migración que todavía no corrió
      // trababa para siempre todas las series que venían atrás. Esa se
      // descarta —se anota— y la cola sigue.
      if (error?.code === 'PGRST202') {
        await anotar('descartado: la funcion no existe', { rpc: p.rpc });
        sacados.push(p);
        continue;
      }
      // Al primero que falla se corta y el resto queda para la próxima: si es
      // la red, los que siguen van a fallar igual y son viajes al vacío. Pero
      // NO se descartan — se quedan, que es la diferencia entre una cola y
      // tirar el trabajo a la basura.
      if (error) {
        corto = true;
        break;
      }
      sacados.push(p);
    }
    // NO `guardar(quedan)`: mientras se mandaba se pudo encolar algo, y eso
    // pisaba lo nuevo. Se saca de la cola de AHORA solo lo que salió.
    const resto = await enTurno(async () => {
      const r = quedanTrasPasada(await leer(), sacados);
      await guardar(r);
      return r;
    });
    if (resto.length > 0) await anotar('quedan pendientes', { cuantas: resto.length });
    else await anotar('cola vaciada', { cuantas: lista.length });
    return corto;
}

/** Cuántas escrituras están esperando. Para el Diagnóstico. */
export async function cuantasPendientes(): Promise<number> {
  return (await leer()).length;
}

/**
 * Si hay una escritura de ESTO esperando a subir. Sirve para no pisar con la
 * respuesta de la base algo que este teléfono eligió después y todavía no
 * llegó.
 */
export async function estaPendiente(rpc: Encolable['rpc'], clave: string): Promise<boolean> {
  return (await leer()).some((p) => p.id === `${rpc}:${clave}`);
}
