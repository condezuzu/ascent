/**
 * UNA PROMESA QUE NO PUEDE ESPERAR PARA SIEMPRE.
 *
 * EL BUG QUE ESTO EXISTE PARA QUE NO VUELVA. Activar el aviso diario llamaba a
 * `activar()`, que adentro hace `await navigator.serviceWorker.ready`. Esa
 * promesa solo resuelve cuando hay un service worker ACTIVO — y el nuestro
 * nunca instalaba, porque su lista de archivos a cachear tenía uno que no
 * existe y `addAll` es todo o nada.
 *
 * O sea que `ready` no resolvía NUNCA. Y una promesa que no resuelve no es un
 * error: no entra al `catch`, no dispara el `finally`, no deja rastro. El
 * control quedaba girando en silencio y así estuvo meses.
 *
 * Un `try/catch` bien puesto no atrapa esto. Lo único que lo atrapa es un
 * reloj.
 *
 * NO CANCELA NADA, y no puede: una promesa no se cancela. Si la de verdad
 * termina después, su resultado se descarta. Eso está bien acá —quien llama ya
 * dio el intento por perdido y lo dijo en pantalla— pero hay que saberlo antes
 * de usar esto para algo que escriba.
 *
 * NO IMPORTA NADA, así que `test:db` lo carga con node pelado.
 */

export type Resultado<T> = { listo: true; valor: T } | { listo: false };

/** Cuánto se espera a que el navegador registre la suscripción de avisos. */
export const LIMITE_SUSCRIPCION_MS = 15_000;

export function conLimite<T>(
  promesa: Promise<T>,
  ms: number,
  // El reloj entra por parámetro para poder probarlo sin esperar de verdad.
  dormir: (ms: number) => Promise<void> = (x) => new Promise((r) => setTimeout(r, x))
): Promise<Resultado<T>> {
  return Promise.race([
    promesa.then((valor) => ({ listo: true as const, valor })),
    dormir(ms).then(() => ({ listo: false as const })),
  ]);
}
