import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { Avisos } from '@nucleo/plataforma';


/**
 * EL AVISO DE FIN DE DESCANSO — y la otra mitad de la razón de migrar.
 *
 * En web esto era un `setTimeout` con la app adelante. O sea: si guardabas el
 * teléfono en el bolsillo —que es lo que hace todo el mundo entre series— el
 * aviso no llegaba nunca. Acá es una notificación local: el sistema la
 * entrega con la pantalla bloqueada y con la app cerrada (§13b).
 *
 * NO ES LA FUENTE DE LA VERDAD, igual que en web. El descanso se calcula
 * siempre contra el timestamp de fin guardado (§18.4); esto es un aviso
 * ENCIMA de eso. Si el sistema decide no entregarlo, el número que se ve al
 * volver a la app sigue estando bien.
 *
 * EL PERMISO SE PIDE CUANDO SE VA A USAR, no al abrir la app. Pedirlo en el
 * arranque gasta la única vez que el usuario va a decir que sí en una pantalla
 * donde todavía no sabe para qué es. Se pide al programar el primer descanso,
 * que es el momento en que la respuesta tiene sentido.
 *
 * EN EXPO GO ANDA EN iOS y en Android tiene límites desde SDK 53 —las
 * notificaciones locales sí, las push no—. Como esto es local y programada,
 * alcanza para probarlo antes de la build de desarrollo.
 */

// CÓMO SE MUESTRA SI LLEGA CON LA APP ABIERTA.
//
// SIN CARTEL DESDE EL 25/9. Con la app adelante, la pantalla del descanso YA
// avisa: cambia de color, vibra y suena. El cartel del sistema encima era la
// segunda mitad de *"una sola cosa, no dos"* — y la más molesta, porque baja
// desde arriba justo cuando estás mirando el número.
//
// EL SONIDO SÍ SE QUEDA: es el mismo aviso, y quitarlo dejaría el caso de la
// app abierta con el teléfono en el bolsillo sin nada que se oiga.
//
// CON "SONIDO AL TERMINAR" APAGADO NO SUENA (12/10): antes la campana del
// aviso sonaba igual, con la app abierta y con el teléfono bloqueado.
//
// Y CON LA APP ADELANTE LA NOTIFICACIÓN NO SUENA (14/10): suena la app misma,
// en el cero exacto (`sonarFin` en compartido/descanso.ts). La notificación
// llega un poco después y sonaba una segunda vez, tarde.
const sonidoAlFrente = false;
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: sonidoAlFrente,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

// EL IDENTIFICADOR ES FIJO Y SE LO DAMOS NOSOTROS ("ascent-descanso"), no el
// que inventa el sistema. Antes se guardaba el del sistema en un mapa en
// memoria, y si la app se cerraba con un descanso andando —lo normal: el
// teléfono va al bolsillo— al volver ya no había cómo cancelar ese aviso.
// Saltar el descanso dejaba sonando uno viejo.
const delSistema = (id: string) => `ascent-${id}`;

// Además del identificador del sistema, se guarda el callback: cuando la
// notificación llega con la app adelante, lo que hay que hacer es lo mismo que
// hacía el `setTimeout` de la web.
const alSonar = new Map<string, () => void>();

Notifications.addNotificationReceivedListener((n) => {
  const id = (n.request.content.data as { ascent?: string } | null)?.ascent;
  if (!id) return;
  alSonar.get(id)?.();
});

/**
 * ¿DEJASTE QUE AVISE?, SIN PREGUNTAR.
 *
 * POR QUÉ HACE FALTA APARTE de `permiso()`. Ese, si todavía no se decidió,
 * ABRE EL DIÁLOGO del sistema — es lo que tiene que hacer, porque se llama al
 * programar el primer descanso y ese es el momento en que el permiso se
 * entiende. Pero Diagnóstico solo quiere MIRAR: una pantalla de diagnóstico
 * que abre un diálogo del sistema al entrar sería una trampa.
 *
 * Y HACE FALTA. El permiso se pide recién en el primer descanso, así que se
 * puede haber dicho que no hace semanas, en el gimnasio, con el dedo apurado.
 * Desde afuera eso se ve igual que una campana rota: el descanso termina y no
 * suena nada. Esto lo separa en un renglón.
 */
export async function comoEstanLosAvisos(): Promise<'si' | 'no' | 'sin-decidir' | 'no-se'> {
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) return 'si';
    // `canAskAgain` en falso: ya dijo que no y el sistema no vuelve a
    // preguntar. Es el caso que hay que poder distinguir, porque la única
    // salida es Ajustes de iOS.
    return p.canAskAgain ? 'sin-decidir' : 'no';
  } catch {
    return 'no-se';
  }
}

/**
 * ¿ESTA BUILD PUEDE RECIBIR AVISOS REMOTOS? (13/10/2026) — solo Diagnóstico.
 *
 * Para saber si "alguien quiere unirse" puede avisar con la app cerrada sin
 * una build nueva, no alcanza con leer que el plugin pone el permiso: hay que
 * pedirle el token a Apple desde una build de verdad. Sin el permiso
 * compilado, Apple contesta con un error que lo dice.
 *
 * Pide dos cosas y no manda nada: el token del APARATO (Apple: prueba el
 * permiso) y el de EXPO (prueba el camino por el que se mandaría). No abre el
 * diálogo de permisos. Del token se muestra el largo y el principio: entero
 * sirve para mandarle avisos a este teléfono.
 */
export async function probarAvisoRemoto(): Promise<{ aparato: string; expo: string }> {
  const conLimite = <T,>(p: Promise<T>): Promise<T> =>
    // Sin el permiso, o en un simulador, Apple puede no contestar nunca.
    Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new Error('no contestó en 20 s')), 20000))]);
  const decir = (token: unknown) => {
    const t = typeof token === 'string' ? token : JSON.stringify(token);
    return `SÍ: ${t.length} caracteres, empieza ${t.slice(0, 8)}…`;
  };
  const fallo = (e: unknown) => `NO: ${String((e as { message?: unknown } | null)?.message ?? e).slice(0, 160)}`;
  const aparato = await conLimite(Notifications.getDevicePushTokenAsync()).then((t) => decir(t.data), fallo);
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  const expo = await conLimite(Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).then((t) => decir(t.data), fallo);
  return { aparato, expo };
}

export const avisosNativos: Avisos = {
  conPantallaBloqueada() {
    return true;
  },

  async permiso() {
    try {
      const actual = await Notifications.getPermissionsAsync();
      if (actual.granted) return true;
      // `canAskAgain` en falso significa que ya dijo que no y el sistema no va
      // a volver a preguntar: insistir abriría un diálogo que no aparece.
      if (!actual.canAskAgain) return false;
      const pedido = await Notifications.requestPermissionsAsync();
      return pedido.granted;
    } catch {
      return false;
    }
  },

  async programar(id, enSegundos, cuandoSuene, opciones) {
    const conSonido = opciones?.sonido !== false;
    // El fin se fija acá: lo que tardan cancelar y el permiso no lo corre.
    const hasta = Date.now() + enSegundos * 1000;
    await this.cancelar(id);
    if (!(await this.permiso())) return;
    try {
      alSonar.set(id, cuandoSuene);
      await Notifications.scheduleNotificationAsync({
        identifier: delSistema(id),
        content: {
          // El texto vive acá y no en `nucleo/textos.ts` a propósito: es lo
          // único de la app que se lee FUERA de la app, en la pantalla
          // bloqueada, y no comparte contexto con ninguna pantalla.
          title: 'Ascent',
          body: 'Se terminó el descanso.',
          // LA CAMPANA NUESTRA Y NO LA DEL SISTEMA (25/9). *"La campana se
          // escucha poco. Con música puesta no la escuché."* El sonido de
          // fábrica de iOS es corto y discreto a propósito —está pensado para
          // un mensaje— y contra música con auriculares no llega. Este es el
          // mismo archivo que suena adentro de la app: tres toques, al 95% de
          // la escala y con las frecuencias arriba, donde la música casi nunca
          // tiene energía.
          //
          // El archivo tiene que estar en el BUNDLE, no en el JavaScript: lo
          // reproduce el sistema, no la app. Por eso va declarado en
          // `app.json` y por eso este cambio necesita una build.
          sound: conSonido ? 'campana.wav' : false,
          // TIME SENSITIVE: atraviesa el modo de concentración. Un temporizador
          // que no suena porque tenés "No molestar" puesto en el gimnasio es un
          // temporizador roto, y es exactamente cuando se usa.
          interruptionLevel: 'timeSensitive',
          data: { ascent: id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          // iOS acepta fracciones de segundo; Android las trunca y sonaría antes de tiempo.
          seconds: Platform.OS === 'ios' ? Math.max(0.1, (hasta - Date.now()) / 1000) : Math.max(1, Math.ceil((hasta - Date.now()) / 1000)),
          repeats: false,
        },
      });
    } catch {
      /* si no se pudo programar, la cuenta de la pantalla sigue igual */
    }
  },

  async cancelar(id) {
    alSonar.delete(id);
    try {
      await Notifications.cancelScheduledNotificationAsync(delSistema(id));
    } catch {
      /* ya había sonado o ya no existía */
    }
    // Y LA QUE YA SONÓ SE VA DEL CENTRO DE NOTIFICACIONES (12/10). Se pasa por
    // acá al empezar el descanso siguiente y al saltar uno: sin esto quedaba
    // un "Se terminó el descanso" por cada serie del entrenamiento.
    try {
      await Notifications.dismissNotificationAsync(delSistema(id));
    } catch {
      /* no estaba */
    }
  },
};
