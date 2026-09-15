import type { Cliente } from '@cliente';
import { rutaDeFoto } from '@nucleo/foto';

/**
 * SUBIR LA FOTO DEL DÍA Y COLGARLA DEL REGISTRO. La misma para la web y la app
 * nativa: la ruta del storage, la fila de `photos` y su visibilidad. Lo que
 * cambia entre las dos es cómo se prepara la imagen antes (quitarle el EXIF,
 * achicarla), y eso lo hace cada una con lo que tiene.
 *
 * `datos` ya viene preparado: sin metadatos y achicado. Nunca el original de
 * la cámara, que trae las coordenadas de dónde se sacó.
 */
export async function subirFotoDelDia(
  supabase: Cliente,
  {
    datos,
    dia,
    logId,
    visible,
    subioRango,
  }: {
    datos: Blob | ArrayBuffer | Uint8Array;
    dia: string;
    logId: string | null;
    visible: boolean;
    subioRango: boolean;
  }
): Promise<'ok' | 'sin-sesion' | 'no-subio'> {
  const { data: usuario } = await supabase.auth.getUser();
  const uid = usuario.user?.id;
  if (!uid) return 'sin-sesion';
  const ruta = rutaDeFoto(uid, dia, Date.now());
  const { error: errSubida } = await supabase.storage.from('fotos').upload(ruta, datos, { contentType: 'image/jpeg' });
  if (errSubida) return 'no-subio';
  const { error } = await supabase.from('photos').insert({
    user_id: uid,
    log_id: logId,
    storage_path: ruta,
    visibilidad: visible ? 'amigos' : 'privada',
    es_subida_de_rango: subioRango,
  });
  return error ? 'no-subio' : 'ok';
}
