import type { Cliente } from '@cliente';
import { miId } from '@compartido/quienSoy';
import { rutaDeFoto, rutaDeMiniatura } from '@nucleo/foto';
import { eventos } from '@compartido/eventos';

/** Se sumó, se quitó o cambió una foto: el álbum que esté montado tiene que volver a pedir. */
export const FOTOS_CAMBIO = 'ascent:fotos-cambio';

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
    miniatura,
    dia,
    logId,
    visible,
    subioRango,
    sello,
  }: {
    datos: Blob | ArrayBuffer | Uint8Array;
    /** La misma foto a 400 px (`rutaDeMiniatura`). Si no viene o no sube, se hace después. */
    miniatura?: Blob | ArrayBuffer | Uint8Array | null;
    dia: string;
    logId: string | null;
    visible: boolean;
    subioRango: boolean;
    /**
     * CUÁNDO SE ELIGIÓ LA FOTO: es lo que le da nombre al archivo. Lo fija la
     * hoja al elegirla y lo manda igual en cada intento, así reintentar es
     * volver a subir LA MISMA foto y no otra. Sin él, el nombre salía de la hora
     * de cada intento: si el primero había entrado y se perdió la respuesta, el
     * segundo dejaba dos fotos iguales en el álbum (13/10).
     */
    sello?: number;
  }
): Promise<'ok' | 'sin-sesion' | 'no-subio'> {
  // El id sale de la sesión guardada, sin viaje: la RLS es la que cuida la
  // escritura. Con `getUser`, sin conexión esto daba 'sin-sesion' antes de
  // intentar nada.
  const uid = await miId(supabase);
  if (!uid) return 'sin-sesion';
  const ruta = rutaDeFoto(uid, dia, sello ?? Date.now());
  // `upsert`: el reintento pisa el archivo del intento anterior en vez de chocar con él.
  const { error: errSubida } = await supabase.storage.from('fotos').upload(ruta, datos, { contentType: 'image/jpeg', upsert: true });
  if (errSubida) return 'no-subio';
  // LA MINIATURA NO FRENA LA FOTO: si no sube, el álbum la genera la primera
  // vez que la muestra (`completarMiniaturas`).
  if (miniatura) {
    await supabase.storage
      .from('fotos')
      .upload(rutaDeMiniatura(ruta), miniatura, { contentType: 'image/jpeg', upsert: true })
      .catch(() => null);
  }
  // ¿La fila ya entró en un intento anterior? Entonces ya está: no se anota dos veces.
  const { data: ya, error: eMirar } = await supabase.from('photos').select('id').eq('storage_path', ruta).limit(1);
  if (eMirar) return 'no-subio';
  if (ya && ya.length > 0) {
    eventos.emitir(FOTOS_CAMBIO);
    return 'ok';
  }
  const { error } = await supabase.from('photos').insert({
    user_id: uid,
    log_id: logId,
    storage_path: ruta,
    visibilidad: visible ? 'amigos' : 'privada',
    es_subida_de_rango: subioRango,
  });
  if (error) return 'no-subio';
  eventos.emitir(FOTOS_CAMBIO);
  return 'ok';
}
