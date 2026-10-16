import type { Cliente } from '@cliente';
import type { Celda } from '@compartido/album';
import { CACHE_DE_FOTO } from '@compartido/firmas';
import { rutaDeMiniatura } from '@nucleo/foto';
import { prepararMiniatura } from './foto';

/**
 * LAS MINIATURAS QUE FALTAN, hechas por el navegador del dueño (15/10). Lo mismo que
 * `movil/src/miniaturas.ts` hace en el teléfono: baja la entera —que igual iba a
 * bajar para mostrarla—, la achica y la sube. Solo las propias (la carpeta es del
 * dueño), de a una, en silencio y con tope por apertura.
 */
const POR_APERTURA = 24;
let andando = false;

export async function completarMiniaturas(supabase: Cliente, celdas: Celda[]): Promise<number> {
  if (andando) return 0;
  const faltan = celdas.filter((c) => !c.miniatura && c.url).slice(0, POR_APERTURA);
  if (faltan.length === 0) return 0;
  andando = true;
  let hechas = 0;
  try {
    for (const c of faltan) {
      try {
        const r = await fetch(c.url);
        if (!r.ok) continue;
        const chica = await prepararMiniatura(await r.blob());
        if (!chica) continue;
        const { error } = await supabase.storage
          .from('fotos')
          .upload(rutaDeMiniatura(c.ruta), chica, { contentType: 'image/jpeg', upsert: true, cacheControl: CACHE_DE_FOTO });
        if (!error) hechas++;
      } catch {
        // Esta no salió: queda para la próxima apertura.
      }
    }
  } finally {
    andando = false;
  }
  return hechas;
}
