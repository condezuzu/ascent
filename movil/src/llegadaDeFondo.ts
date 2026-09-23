import { registrarPorSenal } from '@compartido/gimnasio';
import { anotar } from '@compartido/bitacora';
import { guardarVigilancia, leerVigilancia } from '@compartido/sesionCache';
import { VISITA_VENCIDA_MS } from '@nucleo/llegada';
import { supabase } from './supabase';
import { alLlegarDeFondo } from './plataforma/ubicacion';

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
 * - **NO arranca la sesión.** §13 dice que el cronómetro arranca recién a los
 *   siete minutos de haber llegado —uno se cambia, saluda, no empieza a
 *   entrenar en la puerta— y acá hay treinta segundos de vida, no siete
 *   minutos. Lo que sí hace es **dejar anotada la hora de llegada**: cuando
 *   abras la app, el vigilante lee esa hora y arranca la sesión FECHADA EN LA
 *   LLEGADA, no en el momento en que la abriste. El resultado es el que se
 *   quería: la sesión dice que llegaste 10:00 aunque hayas sacado el teléfono
 *   del bolsillo a las 10:40.
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
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;

    const r = await registrarPorSenal(supabase, 'ubicacion');
    await anotar('llegué (app cerrada): registré el día', {
      entró: r.registrado,
      yaEstaba: r.yaEstaba,
    });

    // LA VISITA, para que la sesión pueda arrancar fechada en la llegada.
    // Una visita de hace horas es otra visita (el bug del 15/9, en
    // `nucleo/llegada.ts`): si la guardada está vencida se empieza de cero.
    const v = await leerVigilancia();
    const sigueSiendoEsta = v && ahora - v.ultimoAdentro <= VISITA_VENCIDA_MS;
    await guardarVigilancia(
      sigueSiendoEsta
        ? { ...v, ultimoAdentro: ahora }
        : { desde: ahora, ultimoAdentro: ahora, arranco: false }
    );
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
