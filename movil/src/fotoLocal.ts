import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { anotar } from './cajaNegra';

/**
 * LAS MINIATURAS DEL ÁLBUM, GUARDADAS EN EL TELÉFONO (14/10/2026).
 *
 * El álbum tardaba en mostrar las fotos la primera vez que se abría en el día:
 * cada apertura de la app firma enlaces NUEVOS, y el teléfono guarda las
 * imágenes por enlace, así que para él eran fotos que nunca había visto y las
 * bajaba todas otra vez. Ahora se guardan por su RUTA, que no cambia nunca (una
 * foto nueva tiene una ruta nueva): la segunda vez salen del disco.
 *
 * Se baja UNA vez y se muestra el archivo: no se muestra el enlace mientras
 * tanto, que sería bajarla dos veces. Si no se puede bajar, queda el enlace.
 * En la web no hace nada.
 */
const listas = new Map<string, string>();
const enCamino = new Map<string, Promise<string>>();
const A_LA_VEZ = 6;
let bajando = 0;
const esperando: (() => void)[] = [];

async function turno<T>(hacer: () => Promise<T>): Promise<T> {
  if (bajando >= A_LA_VEZ) await new Promise<void>((r) => esperando.push(r));
  bajando++;
  try {
    return await hacer();
  } finally {
    bajando--;
    esperando.shift()?.();
  }
}

async function traer(clave: string, url: string): Promise<string> {
  const FS = await import('expo-file-system/legacy');
  const carpeta = `${FS.cacheDirectory}grilla/`;
  const destino = `${carpeta}${clave.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const ya = await FS.getInfoAsync(destino);
  if (ya.exists && (ya as { size?: number }).size) return destino;
  return turno(async () => {
    await FS.makeDirectoryAsync(carpeta, { intermediates: true }).catch(() => undefined);
    const parcial = `${destino}.parte`;
    const r = await FS.downloadAsync(url, parcial);
    if (r.status !== 200) {
      await FS.deleteAsync(parcial, { idempotent: true }).catch(() => undefined);
      return url;
    }
    // A medio bajar no se guarda con el nombre bueno: un corte dejaría una foto rota para siempre.
    await FS.moveAsync({ from: parcial, to: destino });
    return destino;
  });
}

/** El archivo del teléfono si ya está; si no, lo baja y después lo da. `null` mientras tanto. */
export function useFotoLocal(clave: string, url: string): string | null {
  const [uri, setUri] = useState<string | null>(() => (Platform.OS === 'web' || !url ? url || null : (listas.get(clave) ?? null)));
  useEffect(() => {
    if (Platform.OS === 'web' || !url) return setUri(url || null);
    const ya = listas.get(clave);
    if (ya) return setUri(ya);
    let vivo = true;
    let p = enCamino.get(clave);
    if (!p) {
      p = traer(clave, url).catch((e) => {
        anotar(`foto local: ${String(e).slice(0, 120)}`);
        return url;
      });
      enCamino.set(clave, p);
    }
    void p.then((u) => {
      enCamino.delete(clave);
      if (u !== url) listas.set(clave, u);
      if (vivo) setUri(u);
    });
    return () => {
      vivo = false;
    };
  }, [clave, url]);
  return uri;
}
