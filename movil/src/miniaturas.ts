import { Image, Platform } from 'react-native';
import { rutaDeMiniatura } from '@nucleo/foto';
import type { Celda } from '@compartido/album';
import { anotar } from './cajaNegra';
import { prepararMiniatura } from './foto';
import { supabase } from './supabase';

/**
 * LAS MINIATURAS QUE FALTAN, hechas por el teléfono del dueño (8/10).
 *
 * Las fotos de antes del 8/10 no tienen miniatura, y a una foto nueva le puede
 * faltar la suya (se cortó la señal entre un archivo y el otro). En vez de un
 * arreglo de una sola vez, el álbum las va haciendo: baja la entera —que igual
 * iba a bajar para mostrarla—, la achica y la sube. Se arregla solo, y sirve
 * para cualquier caso raro que aparezca después.
 *
 * SOLO LAS PROPIAS: la carpeta es del dueño y nadie más puede escribir ahí.
 *
 * DE A UNA Y EN SILENCIO. No frena ni avisa nada: si falla, la celda sigue
 * mostrando la entera y se vuelve a intentar la próxima vez que se abra el
 * álbum. Con tope por apertura, para que alguien con muchas fotos viejas no
 * se quede bajándolas todas de un saque con datos móviles.
 *
 * NO PROBADO EN EL TELÉFONO desde acá: bajar a un archivo y achicarlo usa
 * módulos nativos que la vista web no tiene. En la web no hace nada.
 */
const POR_APERTURA = 24;
let andando = false;

export async function completarMiniaturas(celdas: Celda[]): Promise<number> {
  if (Platform.OS === 'web' || andando) return 0;
  const faltan = celdas.filter((c) => !c.miniatura && c.url).slice(0, POR_APERTURA);
  if (faltan.length === 0) return 0;
  andando = true;
  let hechas = 0;
  try {
    // Se pide acá y no arriba: en la vista web este módulo no existe.
    const FS = await import('expo-file-system/legacy');
    for (const c of faltan) {
      const destino = `${FS.cacheDirectory}mini-${c.id}.jpg`;
      try {
        const bajada = await FS.downloadAsync(c.url, destino);
        if (bajada.status !== 200) continue;
        const medidas = await new Promise<{ ancho: number; alto: number }>((listo) =>
          Image.getSize(
            bajada.uri,
            (ancho, alto) => listo({ ancho, alto }),
            () => listo({ ancho: 0, alto: 0 })
          )
        );
        const datos = await prepararMiniatura(bajada.uri, medidas.ancho, medidas.alto);
        if (!datos) continue;
        const { error } = await supabase.storage
          .from('fotos')
          .upload(rutaDeMiniatura(c.ruta), datos, { contentType: 'image/jpeg', upsert: true });
        if (!error) hechas++;
      } catch {
        // Esta no salió: queda para la próxima apertura.
      } finally {
        FS.deleteAsync(destino, { idempotent: true }).catch(() => {});
      }
    }
  } catch (e) {
    anotar(`miniaturas: no se pudieron completar (${String((e as Error)?.message ?? e).slice(0, 80)})`);
  } finally {
    andando = false;
  }
  if (hechas > 0) anotar(`miniaturas: ${hechas} hechas de ${faltan.length} que faltaban`);
  return hechas;
}
