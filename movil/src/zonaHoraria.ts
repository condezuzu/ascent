import { supabase } from './supabase';
import { anotar, registrarError } from './cajaNegra';

/**
 * LA ZONA HORARIA DEL TELÉFONO, PARA QUE EL DÍA SE CUENTE DONDE LA PERSONA ESTÁ.
 *
 * El servidor cuenta "hoy" en la zona guardada del perfil —`hoy_de()` hace
 * `now() at time zone profiles.zona`— y esa zona es, de fábrica,
 * `America/Montevideo`. La App Store es MUNDIAL: sin esto, alguien en Tokio o en
 * Auckland registra el día, y ve su racha, con el calendario uruguayo. Cerca de
 * la medianoche local eso cae un día para atrás o para adelante, y una racha se
 * puede cortar por un día que la persona sí entrenó, o marcarse dos veces el
 * mismo. El bug es invisible en Uruguay y seguro afuera.
 *
 * DE DÓNDE SALE LA ZONA. `Intl.DateTimeFormat().resolvedOptions().timeZone` es
 * la ÚNICA vía de JS puro a un nombre IANA ('America/Montevideo', 'Asia/Tokyo').
 * El offset de `getTimezoneOffset()` no sirve: `fijar_zona` valida el nombre
 * contra `pg_timezone_names`, así que necesita el nombre, no el número. Expo SDK
 * 54 trae Hermes con `Intl` habilitado, así que esto existe en el teléfono. Si
 * por lo que sea no estuviera, se devuelve null y no se toca nada: el servidor
 * se queda con Montevideo, que es exactamente lo de hoy — nunca peor.
 *
 * ES JS PURO / OTA: no agrega ningún módulo nativo. Vive de `Intl`, que ya está
 * en el motor, y del RPC `fijar_zona`, que ya está en la base.
 */

/** La última zona que le mandamos al servidor EN ESTA CORRIDA de la app. */
let ultimaEnviada: string | null = null;

/** El nombre IANA del huso del teléfono, o null si el motor no lo sabe decir. */
export function zonaDelTelefono(): string | null {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return z && typeof z === 'string' ? z : null;
  } catch {
    return null;
  }
}

/**
 * Le dice al servidor en qué huso está el teléfono. Se llama al iniciar sesión
 * y cada vez que la app vuelve al frente por si la persona cruzó un huso
 * viajando. Idempotente doble: en JS no reenvía si no cambió desde la última
 * vez de esta corrida, y aunque reenvíe, `fijar_zona` no escribe si el perfil
 * ya tiene esa zona.
 *
 * A PRUEBA DE TODO: cuelga de un `onAuthStateChange` y de un `AppState`, donde
 * un throw no tiene quién lo agarre. Por eso nunca tira: si algo falla, lo anota
 * en la caja negra y sigue.
 *
 * `forzar` reenvía aunque `ultimaEnviada` coincida. Se usa al iniciar sesión:
 * la primera vez de la corrida no hay con qué comparar y conviene asegurar que
 * la zona quede puesta antes de que la persona registre el primer día.
 */
export async function fijarZonaDelTelefono(forzar = false): Promise<void> {
  const zona = zonaDelTelefono();
  if (!zona) return;
  if (!forzar && zona === ultimaEnviada) return;
  try {
    const { error } = await supabase.rpc('fijar_zona', { p_zona: zona });
    if (error) {
      registrarError('al fijar la zona horaria', error);
      return;
    }
    ultimaEnviada = zona;
    anotar(`zona horaria: ${zona}`);
  } catch (e) {
    registrarError('al fijar la zona horaria', e);
  }
}
