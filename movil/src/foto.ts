import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { CALIDAD_FOTO, CALIDAD_MINIATURA, LADO_MINIATURA, medidasDeMiniatura, medidasParaSubir } from '@nucleo/foto';

/**
 * PREPARAR UNA FOTO ANTES DE SUBIRLA, en nativo. Lo mismo que `src/lib/foto.ts`
 * hace con canvas: la foto se VUELVE A CODIFICAR, así que sale sin EXIF —sin
 * las coordenadas de dónde se sacó— y achicada al mismo tamaño que en la web.
 *
 * SI NO SE PUEDE, NO SE SUBE: la alternativa sería el original, que es justo
 * el que tiene la ubicación.
 */
export async function prepararFoto(
  uri: string,
  ancho: number,
  alto: number
): Promise<{ ok: true; datos: Uint8Array } | { ok: false }> {
  try {
    const medidas = medidasParaSubir(ancho || 1600, alto || 1600);
    const acciones = ancho && alto && medidas.ancho < ancho ? [{ resize: { width: medidas.ancho } }] : [];
    const r = await manipulateAsync(uri, acciones, { compress: CALIDAD_FOTO, format: SaveFormat.JPEG, base64: true });
    if (!r.base64) return { ok: false };
    const crudo = atob(r.base64);
    const datos = new Uint8Array(crudo.length);
    for (let i = 0; i < crudo.length; i++) datos[i] = crudo.charCodeAt(i);
    return { ok: true, datos };
  } catch {
    return { ok: false };
  }
}

/**
 * LA MINIATURA DE UNA FOTO (8/10): 400 px en el lado corto, para la grilla del
 * álbum. Sale de la misma imagen que se sube, con el mismo módulo. `null` si no
 * se pudo: la foto sube igual y la miniatura se hace después.
 */
export async function prepararMiniatura(uri: string, ancho: number, alto: number): Promise<Uint8Array | null> {
  try {
    const medidas = medidasDeMiniatura(ancho || LADO_MINIATURA, alto || LADO_MINIATURA);
    const acciones = ancho && alto ? [{ resize: { width: medidas.ancho } }] : [{ resize: { width: LADO_MINIATURA } }];
    const r = await manipulateAsync(uri, acciones, { compress: CALIDAD_MINIATURA, format: SaveFormat.JPEG, base64: true });
    if (!r.base64) return null;
    const crudo = atob(r.base64);
    const datos = new Uint8Array(crudo.length);
    for (let i = 0; i < crudo.length; i++) datos[i] = crudo.charCodeAt(i);
    return datos;
  } catch {
    return null;
  }
}
