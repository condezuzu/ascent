import type { Cliente } from '@cliente';
import { MESES } from '@nucleo/fechas';
import { planetaDeDia } from '@nucleo/rangos';
import { T } from '@nucleo/textos';

/**
 * LO QUE MUESTRA EL ÁLBUM, pedido una sola vez para las dos apps.
 *
 * Vivía adentro de la pantalla de la web; se sacó acá al portar el Álbum a la
 * app nativa, por la misma razón que Ranking: copiado, se separa.
 *
 * Devuelve `null` cuando NO SE PUDO preguntar: "no se pudieron traer tus
 * fotos" y "ninguna foto todavía" son cosas distintas y la pantalla tiene que
 * poder decir la correcta.
 */

export type Celda = {
  id: string;
  /** URL firmada: vence en una hora. */
  url: string;
  ruta: string;
  fecha: string;
  planeta: string | null;
  visibilidad: 'privada' | 'amigos';
  esSubida: boolean;
};

export type DatosDeAlbum = { celdas: Celda[]; miRango: number; miPlaneta: string | null };

export async function cargarAlbum(supabase: Cliente, uid: string): Promise<DatosDeAlbum | null> {
  const { data: p } = await supabase.from('profiles').select('rango_actual, racha_actual').eq('id', uid).single();
  const miRango = p?.rango_actual ?? 1;
  const miPlaneta = p ? planetaDeDia(p.racha_actual) : null;

  const { data: fotos, error: errFotos } = await supabase
    .from('photos')
    .select('id, storage_path, visibilidad, es_subida_de_rango, log_id, creado')
    .eq('user_id', uid)
    .order('creado', { ascending: false });
  if (errFotos) return null;
  if (!fotos || fotos.length === 0) return { celdas: [], miRango, miPlaneta };

  const logIds = fotos.map((f) => f.log_id).filter(Boolean) as string[];
  const { data: logsDatos } = logIds.length
    ? await supabase.from('logs').select('id, fecha, planeta_del_dia').in('id', logIds)
    : { data: [] as { id: string; fecha: string; planeta_del_dia: string | null }[] };
  const mapa = new Map((logsDatos ?? []).map((l) => [l.id, l]));

  const { data: firmadas } = await supabase.storage.from('fotos').createSignedUrls(
    fotos.map((f) => f.storage_path as string),
    3600
  );

  return {
    miRango,
    miPlaneta,
    celdas: fotos.map((f, i) => {
      const log = f.log_id ? mapa.get(f.log_id) : null;
      return {
        id: f.id as string,
        url: firmadas?.[i]?.signedUrl ?? '',
        ruta: f.storage_path as string,
        fecha: (log?.fecha as string | undefined) ?? (f.creado as string).slice(0, 10),
        planeta: (log?.planeta_del_dia as string | null | undefined) ?? null,
        visibilidad: f.visibilidad as 'privada' | 'amigos',
        esSubida: !!f.es_subida_de_rango,
      };
    }),
  };
}

export async function cambiarVisibilidad(supabase: Cliente, id: string, nueva: 'privada' | 'amigos') {
  const { error } = await supabase.from('photos').update({ visibilidad: nueva }).eq('id', id);
  return !error;
}

/**
 * Quita la foto: primero el ARCHIVO, después la fila. En ese orden a propósito:
 * si falla lo segundo queda una fila sin archivo, que la grilla muestra vacía y
 * se puede volver a quitar; al revés quedaría un archivo que ya nadie ve y que
 * sigue ocupando lugar para siempre.
 */
export async function quitarFoto(supabase: Cliente, id: string, ruta: string) {
  const { error: errArchivo } = await supabase.storage.from('fotos').remove([ruta]);
  if (errArchivo) return false;
  const { error: errFila } = await supabase.from('photos').delete().eq('id', id);
  return !errFila;
}

/** Las fotos por mes, en el orden en que vienen (la más nueva primero). */
export function porMes(celdas: Celda[]) {
  const meses: { clave: string; titulo: string; desde: number; fotos: Celda[] }[] = [];
  celdas.forEach((c, i) => {
    const clave = c.fecha.slice(0, 7);
    const ultimo = meses[meses.length - 1];
    if (ultimo?.clave === clave) return ultimo.fotos.push(c);
    const [anio, mes] = clave.split('-');
    meses.push({ clave, titulo: T.calendario.mesYAnio(MESES[Number(mes) - 1], Number(anio)), desde: i, fotos: [c] });
  });
  return meses;
}
