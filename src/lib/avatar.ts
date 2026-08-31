import type { SupabaseClient } from '@supabase/supabase-js';
import { T } from '@nucleo/textos';

export const TAMANO_MAXIMO = 8 * 1024 * 1024;

/**
 * Revisa el archivo ANTES de abrir el recorte. Devuelve el problema en
 * castellano, o null si está bien.
 */
export function problemaConLaImagen(archivo: File): string | null {
  if (!archivo.type.startsWith('image/')) return T.errores.noEsImagen;
  if (archivo.size > TAMANO_MAXIMO) {
    return T.errores.imagenPesada;
  }
  return null;
}

/**
 * Sube el avatar ya recortado y lo deja apuntado en el perfil.
 *
 * Siempre escribe en la MISMA ruta y con la misma extensión: el recorte
 * entrega jpeg, así que no quedan avatares viejos con otra extensión dando
 * vueltas en el bucket cada vez que alguien cambia de foto.
 *
 * Devuelve la URL nueva, o el mensaje del problema.
 */
export async function subirAvatar(
  supabase: SupabaseClient,
  userId: string,
  recorte: Blob
): Promise<{ url: string } | { error: string }> {
  const ruta = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage
    .from('avatares')
    .upload(ruta, recorte, { upsert: true, contentType: 'image/jpeg' });
  if (error) return { error: T.errores.noSubioFoto };

  // ?v= para que el navegador no siga mostrando la anterior desde su caché:
  // la ruta es siempre la misma, así que sin esto el cambio no se ve.
  const { data } = supabase.storage.from('avatares').getPublicUrl(ruta);
  const url = `${data.publicUrl}?v=${Date.now()}`;

  const { error: errPerfil } = await supabase
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', userId);
  if (errPerfil) return { error: T.errores.fotoSinGuardar };

  return { url };
}
