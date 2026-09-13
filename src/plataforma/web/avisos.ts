import type { Avisos, AvisosRemotos } from '@nucleo/plataforma';

// En web el aviso solo existe con la app ADELANTE: el navegador no despierta
// una PWA cerrada, y con la pantalla bloqueada no corre nada. Así que
// `programar` es un `setTimeout` y nada más.
//
// La cuenta NO sale de acá. El descanso siempre se calcula contra el timestamp
// de fin guardado (§18.4); esto es un aviso encima de eso. Si el teléfono
// suspende la app y el timeout no dispara, el tiempo que se ve sigue bien.
const pendientes = new Map<string, ReturnType<typeof setTimeout>>();

/** La clave VAPID llega en base64 de URL y `subscribe` la quiere en bytes. */
function aBytes(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4);
  const crudo = atob((base64 + relleno).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(crudo.length));
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
  return bytes;
}

/**
 * EN iPHONE, WEB PUSH SOLO EXISTE CON LA APP INSTALADA. Safari en una pestaña
 * no tiene `PushManager` directamente; recién aparece cuando la app se abre
 * desde la pantalla de inicio (iOS 16.4 en adelante). Por eso "no hay
 * PushManager" en un iPhone no quiere decir "no se puede": quiere decir
 * "instalala primero", y así se dice.
 */
function esIphoneSinInstalar(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
  const instalada =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !instalada;
}

async function registro(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  // Se registra acá también y no solo en `RegistroPWA`: ese solo registra en
  // producción, y sin service worker no hay a quién mandarle el push.
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

const remotosWeb: AvisosRemotos = {
  async estado() {
    if (typeof window === 'undefined') return 'no-disponible';
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return esIphoneSinInstalar() ? 'hay-que-instalar' : 'no-disponible';
    }
    if (Notification.permission === 'denied') return 'bloqueado';
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub && Notification.permission === 'granted' ? 'activo' : 'apagado';
  },

  async activar(clavePublica) {
    if (!('Notification' in window) || !('PushManager' in window)) return null;
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') return null;
    const reg = await registro();
    if (!reg) return null;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clavePublica) }));
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
    return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
  },

  async desactivar() {
    if (!('serviceWorker' in navigator)) return null;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (!sub) return null;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    return endpoint;
  },
};

export const avisosWeb: Avisos = {
  remotos: remotosWeb,

  conPantallaBloqueada() {
    return false;
  },

  async permiso() {
    // No se pide el permiso de notificaciones del navegador: con la app
    // adelante no hace falta, y pedirlo sin usarlo gasta la única vez que el
    // usuario va a decir que sí.
    return true;
  },

  async programar(id, enSegundos, alSonar) {
    await this.cancelar(id);
    pendientes.set(
      id,
      setTimeout(() => {
        pendientes.delete(id);
        alSonar();
      }, Math.max(0, enSegundos) * 1000)
    );
  },

  async cancelar(id) {
    const t = pendientes.get(id);
    if (t === undefined) return;
    clearTimeout(t);
    pendientes.delete(id);
  },
};
