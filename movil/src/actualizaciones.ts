import * as Updates from 'expo-updates';
import { anotar } from './cajaNegra';

/**
 * LAS ACTUALIZACIONES POR EL AIRE (23/9): arreglar algo, subir el JS, y que el
 * teléfono lo baje solo.
 *
 * POR QUÉ ENTRÓ RECIÉN AHORA, después de haberlo rechazado dos veces. Las dos
 * veces el argumento fue el mismo y era bueno: un canal de actualización es una
 * pieza más que se desactualiza, y mientras la app la escribía una sola persona
 * en su computadora, reconstruir era barato. Lo que cambió es quién espera: con
 * la app EN UN TELÉFONO, cada arreglo costaba una build de cinco minutos y una
 * instalación a mano, y ese precio no lo paga el que arregla sino el que quiere
 * probar. Empuja a juntar diez cambios en una tanda y a probar poco, que es
 * exactamente al revés de cómo se encontraron los bugs de estos días.
 *
 * QUÉ VIAJA POR ACÁ: el JavaScript y lo que se empaqueta con él —pantallas,
 * textos, reglas del núcleo, estilos, imágenes de `assets/`—. O sea casi todo
 * lo que se escribe en un día normal.
 *
 * QUÉ NO, Y NO HAY VUELTA: todo lo nativo. Un módulo nuevo (`expo-location`,
 * `expo-file-system`), un permiso o su texto en `Info.plist`, los
 * `UIBackgroundModes`, el ícono, el splash, subir de SDK, cambiar el bundle.
 * Eso necesita build nueva e instalación. Ver `movil/EAS.md`.
 *
 * LA VERSIÓN DE EJECUCIÓN ES LA HUELLA NATIVA (`runtimeVersion: fingerprint`)
 * y eso es lo que hace que esto sea seguro: una actualización solo le llega a
 * las builds cuyo lado nativo es idéntico. Si agrego un módulo y subo JS que lo
 * usa, la build vieja NO recibe nada, en vez de recibir un JS que llama a algo
 * que no existe y morir al abrir.
 */

/** Si esta copia de la app puede recibir actualizaciones. */
export function hayCanal(): boolean {
  // En Expo Go y en la vista web no hay canal: `isEnabled` es falso y llamar
  // a lo demás tira. En la build interna y en TestFlight, es verdadero.
  return Updates.isEnabled;
}

/** Qué JS está corriendo, para el diagnóstico. */
export function queEstoyCorriendo(): string {
  if (!Updates.isEnabled) return 'sin canal (Expo Go o web)';
  // `isEmbeddedLaunch` es el JS que vino DENTRO de la build. Si no, corre una
  // actualización bajada, y su id es lo que hay que mirar para saber cuál.
  // SIN ID TAMBIÉN ES EL DE LA BUILD: en la vista web `isEnabled` contesta que
  // sí pero no hay ninguna actualización corriendo, y decía "actualización"
  // seguido de nada, que es peor que no decir.
  if (Updates.isEmbeddedLaunch || !Updates.updateId) return 'el JS de la build';
  const id = (Updates.updateId ?? '').slice(0, 8);
  const cuando = Updates.createdAt ? ` del ${Updates.createdAt.toLocaleString()}` : '';
  return `actualización ${id}${cuando}`;
}

/**
 * Busca una actualización y la trae. Devuelve si hay una lista para aplicar.
 *
 * NO REINICIA SOLA ACÁ: reiniciar es decisión de quien llama, porque reiniciar
 * en medio de un entrenamiento sería perder el cronómetro de vista justo
 * cuando importa. Ver `buscarAlArrancar`.
 */
export async function buscarYTraer(): Promise<boolean> {
  if (!Updates.isEnabled) return false;
  try {
    const r = await Updates.checkForUpdateAsync();
    if (!r.isAvailable) {
      anotar('actualización: no hay');
      return false;
    }
    anotar('actualización: bajando');
    const t = await Updates.fetchUpdateAsync();
    anotar(`actualización: ${t.isNew ? 'lista' : 'ya la tenía'}`);
    return t.isNew;
  } catch (e) {
    // SE ANOTA, NO SE REGISTRA COMO ERROR, y la diferencia importa: lo que
    // marca un error en la caja negra ABRE el panel de fallo encima de la app.
    // Buscar una actualización falla por cosas normales —sin señal, el
    // servidor no contesta, o esto corre en Expo Go y en la vista web, donde
    // no hay canal— y ninguna de esas es una app rota. Se vio en la primera
    // corrida: el panel "Algo falló" saltaba solo a los seis segundos de
    // entrar.
    anotar(`actualización: no se pudo (${String((e as Error)?.message ?? e).slice(0, 80)})`);
    return false;
  }
}

/** Aplica lo que ya se bajó. La app arranca de nuevo con el JS nuevo. */
export async function aplicar(): Promise<void> {
  if (!Updates.isEnabled) return;
  await Updates.reloadAsync();
}

/**
 * AL ARRANCAR: buscar, traer, y aplicar EN EL MISMO ARRANQUE.
 *
 * Lo que hace `expo-updates` solo es bajarla y dejarla para la próxima vez que
 * se abra la app. Eso alcanza para una app publicada y no alcanza acá: el que
 * la está probando arregla algo, la abre, y quiere ver el arreglo — no la vez
 * siguiente.
 *
 * `puedeReiniciar` lo decide quien llama y hoy es "no hay entrenamiento
 * andando". Un reinicio con el cronómetro corriendo se ve como que la app se
 * cerró sola en medio de la serie.
 */
export async function buscarAlArrancar(puedeReiniciar: () => boolean): Promise<void> {
  if (!(await buscarYTraer())) return;
  if (!puedeReiniciar()) return anotar('actualización: lista, se aplica al cerrar');
  await aplicar();
}
