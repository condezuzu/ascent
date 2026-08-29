/**
 * PREPARAR UNA FOTO ANTES DE SUBIRLA.
 *
 * POR QUÉ EXISTE, Y NO ES POR EL TAMAÑO. Hasta ahora el archivo iba del
 * `<input type="file">` al storage **tal cual salió de la cámara**, con todo su
 * EXIF adentro. El EXIF de una foto de teléfono trae, entre otras cosas, las
 * **coordenadas GPS de dónde se sacó**. O sea: cada foto de progreso que se
 * comparte con un amigo venía con la ubicación del gimnasio —o de la casa—
 * adjunta, para cualquiera que descargue el archivo y lo abra con algo que
 * lea metadatos. Eso es una fuga, no un detalle.
 *
 * Volver a codificar en un canvas resuelve eso de raíz: el blob que sale son
 * píxeles nuevos y **no tiene ningún metadato**. No hay que saber qué campos
 * borrar, porque no se copia ninguno.
 *
 * Y DE PASO, LA ORIENTACIÓN. Se decodifica pidiendo que la orientación del
 * EXIF se aplique a los píxeles. Si una foto salía dada vuelta o espejada por
 * un flag de EXIF, queda derecha para siempre y se ve igual en todos lados.
 *
 * OJO CON LO QUE ESTO **NO** ARREGLA: si la cámara frontal grabó la imagen ya
 * espejada en los píxeles, sin ningún flag, acá no hay nada que detectar —el
 * archivo es una foto legítima de algo que está al revés— y darlas vuelta
 * todas rompería las que están bien.
 *
 * SI NO SE PUEDE, NO SE SUBE. La alternativa sería mandar el original, y el
 * original es justo el que tiene las coordenadas. Fallar y decirlo es mejor
 * que cumplir a medias una promesa de privacidad.
 *
 * PARA LA MIGRACIÓN: esto usa canvas, que en Expo no existe. El equivalente es
 * `expo-image-manipulator`, que hace las tres cosas (orientar, achicar,
 * recodificar) en una llamada. Va al mismo lugar que `RecorteCircular`, que ya
 * arrastra la misma deuda.
 */

// El lado largo al que se achica. Una foto de progreso mirada en un teléfono
// no necesita los 4000 px del sensor, y subir doce megas por un subsuelo con
// mala señal es la forma más segura de que la foto no llegue nunca.
const LADO_MAXIMO = 1600;
const CALIDAD = 0.86;

export type FotoLista =
  | { ok: true; blob: Blob; tipo: 'image/jpeg' }
  | { ok: false };

/** Decodifica aplicando la orientación del EXIF. Dos caminos, por soporte. */
async function decodificar(archivo: File): Promise<CanvasImageSource & { width: number; height: number }> {
  // El camino bueno: `createImageBitmap` con `imageOrientation` hornea la
  // orientación en los píxeles y no necesita el DOM.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    } catch {
      /* algunos navegadores no aceptan las opciones: se cae al de abajo */
    }
  }
  // El de respaldo: un `<img>`. Los navegadores de hoy ya le aplican la
  // orientación del EXIF solos (`image-orientation: from-image` es el valor
  // inicial), así que dibujarlo en un canvas da el mismo resultado.
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight });
  } finally {
    // Se suelta enseguida: el bitmap ya está decodificado y dejar el objeto
    // vivo mantiene el archivo entero en memoria hasta que se recargue.
    URL.revokeObjectURL(url);
  }
}

export async function prepararFoto(archivo: File): Promise<FotoLista> {
  try {
    const fuente = await decodificar(archivo);
    const { width: w0, height: h0 } = fuente;
    if (!w0 || !h0) return { ok: false };

    const escala = Math.min(1, LADO_MAXIMO / Math.max(w0, h0));
    const w = Math.round(w0 * escala);
    const h = Math.round(h0 * escala);

    const lienzo = document.createElement('canvas');
    lienzo.width = w;
    lienzo.height = h;
    const ctx = lienzo.getContext('2d');
    if (!ctx) return { ok: false };
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(fuente, 0, 0, w, h);
    if ('close' in fuente && typeof fuente.close === 'function') fuente.close();

    const blob = await new Promise<Blob | null>((listo) =>
      lienzo.toBlob(listo, 'image/jpeg', CALIDAD)
    );
    if (!blob) return { ok: false };
    return { ok: true, blob, tipo: 'image/jpeg' };
  } catch {
    return { ok: false };
  }
}
