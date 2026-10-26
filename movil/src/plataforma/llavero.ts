import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type * as SecureStoreTipos from 'expo-secure-store';
import { LLAVERO_COMPARTIDO } from '@nucleo/vinculoConMoss';

/**
 * EL LLAVERO COMPARTIDO CON MOSS (D27), del lado nativo: el grupo del equipo que solo leen las
 * apps de `XF9N8X9KJG`. Lo que se guarda y cómo se lee está en `nucleo/vinculoConMoss.ts`.
 *
 * GUARDA IGUAL QUE MOSS, y no es un detalle: Moss escribe con `expo-secure-store` 58 y Ascent con
 * el 15 (SDK 54), y los dos arman la consulta igual —servicio con `:no-auth` al escribir sin
 * biometría, la clave en `kSecAttrAccount` y `kSecAttrGeneric`, el grupo en
 * `kSecAttrAccessGroup`—. Si un día cambia uno solo, la otra app deja de ver lo escrito sin un
 * error. Por eso las opciones son estas tres y nunca otras.
 *
 * PUEDE NO ESTAR, como el módulo de la Live Activity: en la vista web (:8090) no hay llavero, y
 * un dev client anterior a esta build no trae el módulo. `requireOptionalNativeModule` contesta
 * `null` en vez de tirar, y entonces nada se guarda y todo se lee vacío. Nada de esto tira nunca:
 * sin llavero, vincular desde Ascent no ofrece la sesión de Moss, y nada más.
 */
type SecureStore = typeof SecureStoreTipos;

let cargado: SecureStore | null | undefined;
function secureStore(): SecureStore | null {
  if (cargado !== undefined) return cargado;
  cargado = null;
  try {
    if (Platform.OS === 'ios' && requireOptionalNativeModule('ExpoSecureStore')) {
      // Recién acá: importarlo arriba, sin el módulo nativo, tira al cargar la app.
      cargado = require('expo-secure-store') as SecureStore;
    }
  } catch {
    cargado = null;
  }
  return cargado;
}

function opciones(s: SecureStore): SecureStoreTipos.SecureStoreOptions {
  return {
    keychainService: LLAVERO_COMPARTIDO.servicio,
    accessGroup: LLAVERO_COMPARTIDO.grupo,
    // Sin migrar a otro teléfono: es un token de una hora, y la otra app tiene que estar en ESTE.
    keychainAccessible: s.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  };
}

export const llavero = {
  async leer(clave: string): Promise<string | null> {
    const s = secureStore();
    if (!s) return null;
    try {
      return await s.getItemAsync(clave, opciones(s));
    } catch {
      return null;
    }
  },

  async guardar(clave: string, valor: string): Promise<boolean> {
    const s = secureStore();
    if (!s) return false;
    try {
      await s.setItemAsync(clave, valor, opciones(s));
      return true;
    } catch {
      return false;
    }
  },

  async borrar(clave: string): Promise<void> {
    const s = secureStore();
    if (!s) return;
    try {
      await s.deleteItemAsync(clave, opciones(s));
    } catch {
      /* lo que no se pudo borrar vence solo: es un token de una hora */
    }
  },
};
