import * as Notifications from 'expo-notifications';
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
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
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

  async programar(id, enSegundos, cuandoSuene) {
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
          sound: 'campana.wav',
          // TIME SENSITIVE: atraviesa el modo de concentración. Un temporizador
          // que no suena porque tenés "No molestar" puesto en el gimnasio es un
          // temporizador roto, y es exactamente cuando se usa.
          interruptionLevel: 'timeSensitive',
          data: { ascent: id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, Math.round(enSegundos)),
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
  },
};
