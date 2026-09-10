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

// Cómo se muestra si llega con la app ABIERTA. Sin esto, iOS se la guarda para
// el centro de notificaciones y el usuario no ve nada: justo el caso de estar
// mirando la pantalla del descanso cuando termina.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: false,
  }),
});

// Lo programado por id, para poder cancelarlo. `expo-notifications` devuelve
// su propio identificador y hay que quedárselo: el `id` que usa la app es el
// nuestro —"descanso"— y no el del sistema.
const programados = new Map<string, string>();

// Además del identificador del sistema, se guarda el callback: cuando la
// notificación llega con la app adelante, lo que hay que hacer es lo mismo que
// hacía el `setTimeout` de la web.
const alSonar = new Map<string, () => void>();

Notifications.addNotificationReceivedListener((n) => {
  const id = (n.request.content.data as { ascent?: string } | null)?.ascent;
  if (!id) return;
  alSonar.get(id)?.();
});

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
      const delSistema = await Notifications.scheduleNotificationAsync({
        content: {
          // El texto vive acá y no en `nucleo/textos.ts` a propósito: es lo
          // único de la app que se lee FUERA de la app, en la pantalla
          // bloqueada, y no comparte contexto con ninguna pantalla.
          title: 'Ascent',
          body: 'Se terminó el descanso.',
          data: { ascent: id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, Math.round(enSegundos)),
          repeats: false,
        },
      });
      programados.set(id, delSistema);
    } catch {
      /* si no se pudo programar, la cuenta de la pantalla sigue igual */
    }
  },

  async cancelar(id) {
    alSonar.delete(id);
    const delSistema = programados.get(id);
    if (!delSistema) return;
    programados.delete(id);
    try {
      await Notifications.cancelScheduledNotificationAsync(delSistema);
    } catch {
      /* ya había sonado o ya no existía */
    }
  },
};
