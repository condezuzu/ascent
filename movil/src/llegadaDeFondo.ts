import { anotarLlegadaPendiente, registrarPorSenal, reintentarLlegadaPendiente } from '@compartido/gimnasio';
import { anotar } from '@compartido/bitacora';
import { supabase } from './supabase';
import { quienSoy } from '@compartido/quienSoy';
import { aISO } from '@nucleo/fechas';
import { alLlegarDeFondo, alSalirDeFondo } from './plataforma/ubicacion';

/**
 * LLEGASTE AL GIMNASIO CON LA APP CERRADA (§13). Lo que en web no se podía.
 *
 * Esto es la función central de Ascent y hasta hoy en el teléfono no estaba:
 * ibas al gimnasio y el día no entraba solo. El puerto de ubicación ya sabía
 * registrar la zona en el sistema operativo desde la migración, pero **no lo
 * llamaba nadie**, así que la app nativa hacía lo mismo que la web — entrar si
 * la abrías estando ahí — teniendo a mano lo único que la web no tiene.
 *
 * POR QUÉ ES UN MÓDULO SUELTO Y NO UN COMPONENTE. Cuando iOS despierta a la
 * app por el geofence, la levanta en segundo plano por unos segundos y **no
 * dibuja nada**: no hay pantalla, no hay árbol de React, no hay efecto que
 * corra. Lo único que pasa seguro es que el bundle se evalúa. Así que lo que
 * tiene que ocurrir en ese despertar va acá, en el cuerpo del módulo, y no
 * adentro de un `useEffect` que en ese momento no existe.
 *
 * QUÉ HACE Y QUÉ NO HACE, que es la parte pensada:
 *
 * - **Registra el día.** Es lo único que no puede esperar: es para lo que
 *   existe la función.
 * - **NO arranca la sesión**, ni ahora ni después (15/10): llegar registra el
 *   día y el cronómetro lo arranca la persona. Hasta el 15/10 dejaba anotada la
 *   hora de llegada para que el vigilante arrancara la sesión fechada ahí.
 *
 * La hora de llegada la da el despertar, que es lo más cerca de la puerta que
 * se puede estar. Por eso no se mide el GPS acá: ya lo midió el sistema, y
 * encender la antena con treinta segundos de presupuesto es gastarlos en
 * confirmar algo que ya sabemos.
 */
async function llegue() {
  const ahora = Date.now();
  try {
    // SIN SESIÓN NO SE PREGUNTA NADA. El fence sigue registrado después de
    // cerrar sesión hasta que alguien lo suelte, así que este despertar puede
    // caer sin usuario: pedir el RPC ahí es un 401 y una línea de error en la
    // caja negra por algo que es normal.
    //
    // "SIN SESIÓN" Y "NO PUDE SABER" NO SON LO MISMO (13/10). Con el token
    // vencido y sin datos, preguntar quién soy falla; antes eso se tomaba por
    // "no hay nadie" y se salía sin dejar rastro: ni día, ni visita, ni una
    // línea en la bitácora.
    const yo = await quienSoy(supabase);
    if (yo.estado === 'sin') return;

    // EL DÍA. Si no entró —sin datos en la puerta— queda pendiente y lo
    // reintenta el vigilante la próxima vez que la app esté abierta.
    const dia = aISO(new Date(ahora));
    const r = yo.estado === 'con' ? await registrarPorSenal(supabase, 'ubicacion') : { registrado: false, yaEstaba: false };
    const entro = r.registrado || r.yaEstaba;
    if (!entro) await anotarLlegadaPendiente(dia);
    await anotar('llegué (app cerrada): registré el día', {
      entró: r.registrado,
      yaEstaba: r.yaEstaba,
      quedóPendiente: !entro,
    });
  } catch (e) {
    // NO PUEDE TIRAR. Lo que esto devuelve es lo que iOS usa para saber que
    // puede dormir a la app; una promesa rechazada acá es una tarea en segundo
    // plano que falla, y iOS las castiga despertando cada vez menos.
    await anotar('llegué (app cerrada): falló', { por: String((e as Error)?.message ?? e) });
  }
}

// EN EL CUERPO DEL MÓDULO A PROPÓSITO: ver el comentario de arriba. Lo único
// que hace es dejar la función a mano, así que importar esto no cuesta nada ni
// enciende ninguna antena.
alLlegarDeFondo(llegue);

/**
 * TE FUISTE DEL GIMNASIO CON LA APP CERRADA (14/10): si el día quedó pendiente
 * al llegar —sin datos en la puerta—, se reintenta ahora, que afuera suele haber
 * señal. Si ya es otro día, `reintentarLlegadaPendiente` lo tira sin escribir.
 */
async function meFui() {
  try {
    if ((await quienSoy(supabase)).estado !== 'con') return;
    const r = await reintentarLlegadaPendiente(supabase, aISO(new Date()));
    if (r !== 'nada') await anotar('me fui (app cerrada): llegada pendiente', { resultado: r });
  } catch (e) {
    await anotar('me fui (app cerrada): falló', { por: String((e as Error)?.message ?? e) });
  }
}

alSalirDeFondo(meFui);
