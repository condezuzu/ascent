import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

/**
 * QUÉ ESTÁ CORRIENDO: la versión de la app y la OTA. En un archivo propio, sin
 * depender de nada de la app: lo usa `supabase.ts` para decirle a la base con
 * qué versión llega cada pedido, y desde ahí no se puede importar algo que a su
 * vez importe a `supabase.ts`.
 */
export function versionApp(): string {
  return (Constants.expoConfig?.version ?? 'desconocida').slice(0, 100);
}

export function versionOta(): string {
  // `updateId` es null cuando corre la build incrustada (sin OTA aplicada);
  // ahí lo que identifica la versión es la huella de ejecución.
  const id = Updates.updateId ?? `incrustada@${Updates.runtimeVersion ?? '?'}`;
  return id.slice(0, 100);
}

/** Con qué versión se mandó algo: la de la app y la OTA que está corriendo. */
export function versionCompleta(): string {
  return `${versionApp()} · ${versionOta()}`.slice(0, 100);
}

/**
 * LA VERSIÓN, EN UN ENCABEZADO DE CADA PEDIDO (migración 63). No había forma de
 * saber qué versión corre la gente: solo se veía a quien tuvo un error o mandó
 * una sugerencia. La base la lee de acá en `pantalla_inicio`, que ya se llama
 * en cada apertura, y la anota en el perfil: sin tabla nueva y sin pedido extra.
 *
 * Va en `X-Client-Info`, que la librería ya manda, y no en uno propio. Solo
 * letras sin acento: es un encabezado.
 */
export function encabezadoDeVersion(): string {
  try {
    return `ascent/${versionApp()} ${versionOta()}`.replace(/[^\x20-\x7E]/g, '').slice(0, 100);
  } catch {
    return 'ascent/desconocida';
  }
}
