import type { Cliente } from '@cliente';
import type { Usado } from '@nucleo/tuyos';

/**
 * LOS EJERCICIOS QUE USASTE, PEDIDOS UNA SOLA VEZ (migración 44).
 *
 * POR QUÉ HAY CACHÉ Y NO UN PEDIDO POR APERTURA. El selector es una hoja que
 * se abre y se cierra muchas veces en la misma sesión: cambiar de ejercicio
 * entre bloque y bloque es lo normal. Un pedido cada vez serían diez viajes
 * en un entrenamiento para traer una lista que no cambió.
 *
 * Y EL PROBLEMA NO ES EL COSTO, ES EL SALTO. Si la lista llega después de que
 * la hoja se dibujó, "Tuyos" aparece un cuarto de segundo tarde y empuja todo
 * hacia abajo justo cuando el dedo ya va bajando. Con la caché, de la segunda
 * apertura en adelante está ANTES de abrir y la hoja sale entera.
 *
 * SE OLVIDA AL TERMINAR UNA SESIÓN, que es el único momento en que esto
 * cambia: los bloques de la sesión recién cerrada entran en la cuenta. Ver
 * `olvidarUsados`.
 *
 * SI LA MIGRACIÓN NO CORRIÓ, contesta lista vacía y la sección no aparece:
 * el selector queda exactamente como estaba. Una lista vacía y un "no se pudo"
 * se ven igual DESDE ACÁ a propósito — no hay nada que mostrarle a nadie sobre
 * un atajo que no se pudo calcular, y un cartel de error arriba del selector
 * sería peor que no tener el atajo.
 */

/** PostgREST cuando la función no existe: la migración 44 todavía no corrió. */
const NO_EXISTE = 'PGRST202';

let cache: { uid: string; filas: Usado[] } | null = null;
let enVuelo: { uid: string; promesa: Promise<Usado[]> } | null = null;

async function pedir(supabase: Cliente, uid: string): Promise<Usado[]> {
  const { data, error } = await supabase.rpc('mis_ejercicios_usados');
  if (error) {
    // Un error de red NO se cachea: la próxima apertura vuelve a intentar.
    // Que la migración no exista tampoco, y no hace falta tratarlo aparte:
    // reintentar un pedido por apertura de hoja mientras la 44 no esté es
    // barato, y el día que corra empieza a andar sin recargar la app.
    if (error.code !== NO_EXISTE) console.warn('mis_ejercicios_usados:', error.message);
    return [];
  }
  const filas = (Array.isArray(data) ? data : []) as Usado[];
  cache = { uid, filas };
  return filas;
}

/**
 * Las filas, de la caché si están. Nunca tira: sin datos devuelve `[]`, que es
 * "no mostrar el atajo".
 */
export function ejerciciosUsados(supabase: Cliente, uid: string): Promise<Usado[]> {
  if (cache && cache.uid === uid) return Promise.resolve(cache.filas);
  // Dos hojas abriéndose casi juntas no tienen por qué pedir dos veces.
  if (enVuelo && enVuelo.uid === uid) return enVuelo.promesa;
  const promesa = pedir(supabase, uid).finally(() => {
    if (enVuelo && enVuelo.promesa === promesa) enVuelo = null;
  });
  enVuelo = { uid, promesa };
  return promesa;
}

/** Lo que ya está, sin pedir nada. Para dibujar la hoja sin esperar. */
export function usadosEnCache(uid: string): Usado[] | null {
  return cache && cache.uid === uid ? cache.filas : null;
}

/** Al terminar una sesión, y al cerrar sesión de la cuenta. */
export function olvidarUsados() {
  cache = null;
  enVuelo = null;
}
