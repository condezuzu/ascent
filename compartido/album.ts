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
  /** URL firmada: vence en una hora. La foto entera, para el visor. */
  url: string;
  /**
   * La misma foto achicada a 400 px, para la grilla (19/9). Las fotos se
   * guardan a 1600 px y la celda mide un tercio de pantalla: bajar la entera
   * por cada miniatura era lo que hacía tardar el álbum. Si no se pudo
   * pedir, es la entera.
   */
  miniatura: string;
  ruta: string;
  fecha: string;
  planeta: string | null;
  visibilidad: 'privada' | 'amigos';
  esSubida: boolean;
};

export type DatosDeAlbum = { celdas: Celda[]; miRango: number; miPlaneta: string | null };

/** Cuántas miniaturas se piden a la vez: una por foto, sin inundar la red. */
const MINIATURAS_A_LA_VEZ = 12;
/**
 * Solo las de arriba llevan miniatura: son las que se ven al abrir, y cada
 * una es un pedido. Con cien fotos, pedirlas todas antes de mostrar nada eran
 * nueve tandas en fila. Las de más abajo cargan la entera cuando se llega a
 * ellas (la grilla las pide perezosas).
 */
const MINIATURAS_PRIMERAS = 18;

/** Las miniaturas de estas rutas, en el mismo orden (`null` si alguna no se pudo). */
export async function miniaturas(supabase: Cliente, rutas: string[]): Promise<(string | null)[]> {
  const salida: (string | null)[] = [];
  for (let i = 0; i < rutas.length; i += MINIATURAS_A_LA_VEZ) {
    const tanda = await Promise.all(
      rutas.slice(i, i + MINIATURAS_A_LA_VEZ).map((r) =>
        supabase.storage
          .from('fotos')
          .createSignedUrl(r, 3600, { transform: { width: 400, height: 400, resize: 'cover', quality: 70 } })
          .then(({ data }) => data?.signedUrl ?? null)
          .catch(() => null)
      )
    );
    salida.push(...tanda);
  }
  return salida;
}

export async function cargarAlbum(supabase: Cliente, uid: string): Promise<DatosDeAlbum | null> {
  // El perfil y las fotos A LA VEZ (19/9): uno no depende del otro, y en fila
  // eran dos viajes esperando uno detrás del otro.
  const [{ data: p }, { data: fotos, error: errFotos }] = await Promise.all([
    supabase.from('profiles').select('rango_actual, racha_actual').eq('id', uid).single(),
    supabase
      .from('photos')
      .select('id, storage_path, visibilidad, es_subida_de_rango, log_id, creado')
      .eq('user_id', uid)
      .order('creado', { ascending: false }),
  ]);
  const miRango = p?.rango_actual ?? 1;
  const miPlaneta = p ? planetaDeDia(p.racha_actual) : null;
  if (errFotos) return null;
  if (!fotos || fotos.length === 0) return { celdas: [], miRango, miPlaneta };

  const logIds = fotos.map((f) => f.log_id).filter(Boolean) as string[];
  const rutas = fotos.map((f) => f.storage_path as string);
  // Los días, las URL y las miniaturas, también a la vez.
  const [{ data: logsDatos }, { data: firmadas }, chicas] = await Promise.all([
    logIds.length
      ? supabase.from('logs').select('id, fecha, planeta_del_dia').in('id', logIds)
      : Promise.resolve({ data: [] as { id: string; fecha: string; planeta_del_dia: string | null }[] }),
    supabase.storage.from('fotos').createSignedUrls(rutas, 3600),
    miniaturas(supabase, rutas.slice(0, MINIATURAS_PRIMERAS)),
  ]);
  const mapa = new Map((logsDatos ?? []).map((l) => [l.id, l]));

  return {
    miRango,
    miPlaneta,
    celdas: fotos.map((f, i) => {
      const log = f.log_id ? mapa.get(f.log_id) : null;
      return {
        id: f.id as string,
        url: firmadas?.[i]?.signedUrl ?? '',
        miniatura: chicas[i] ?? firmadas?.[i]?.signedUrl ?? '',
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
