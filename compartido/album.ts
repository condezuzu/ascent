import type { Cliente } from '@cliente';
import { MESES, aISO } from '@nucleo/fechas';
import { cuerpoDe } from '@nucleo/rangos';
import { disponible } from '@nucleo/esquema';
import { versionDelEsquema } from '@compartido/esquema';
import { T } from '@nucleo/textos';
import { rutaDeMiniatura } from '@nucleo/foto';

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
   * La misma foto a 400 px, para la grilla: un archivo aparte, al lado de la
   * entera (`rutaDeMiniatura`). Vacía si todavía no existe —una foto de antes
   * del 8/10, o una subida a la que no le llegó la suya—: la celda usa la
   * entera y el teléfono del dueño la genera (`completarMiniaturas`).
   */
  miniatura: string;
  ruta: string;
  fecha: string;
  planeta: string | null;
  /** El día de racha en que se sacó (item 6.4): "día 41". `null` = sin dato. */
  dia: number | null;
  visibilidad: 'privada' | 'amigos';
  esSubida: boolean;
};

export type DatosDeAlbum = { celdas: Celda[]; miRango: number; miPlaneta: string | null };

/**
 * Las miniaturas de estas rutas, en el mismo orden (`null` donde no existe).
 *
 * UN SOLO PEDIDO PARA TODAS. Antes era un pedido por foto, con la
 * transformación de imágenes del servidor —que es del plan pago y con cupo—, y
 * por eso se pedían solo las primeras 18. Ahora son archivos de verdad: se
 * firman todas juntas y la que no existe vuelve con su error, que es como se
 * sabe cuáles faltan.
 */
export async function miniaturas(supabase: Cliente, rutas: string[]): Promise<(string | null)[]> {
  if (rutas.length === 0) return [];
  try {
    const { data } = await supabase.storage.from('fotos').createSignedUrls(rutas.map(rutaDeMiniatura), 3600);
    return rutas.map((_, i) => (data?.[i] && !data[i].error && data[i].signedUrl ? data[i].signedUrl : null));
  } catch {
    return rutas.map(() => null);
  }
}

export async function cargarAlbum(supabase: Cliente, uid: string): Promise<DatosDeAlbum | null> {
  // El perfil y las fotos A LA VEZ (19/9): uno no depende del otro, y en fila
  // eran dos viajes esperando uno detrás del otro.
  const [{ data: p }, { data: fotos, error: errFotos }] = await Promise.all([
    supabase.from('profiles').select('racha_actual').eq('id', uid).single(),
    supabase
      .from('photos')
      .select('id, storage_path, visibilidad, es_subida_de_rango, log_id, creado')
      .eq('user_id', uid)
      .order('creado', { ascending: false }),
  ]);
  // El rango y el planeta, los dos de la racha: ver `cuerpoDe`.
  const { rango: miRango, planeta: miPlaneta } = cuerpoDe(p?.racha_actual);
  if (errFotos) return null;
  if (!fotos || fotos.length === 0) return { celdas: [], miRango, miPlaneta };

  const logIds = fotos.map((f) => f.log_id).filter(Boolean) as string[];
  const rutas = fotos.map((f) => f.storage_path as string);
  // `racha_del_dia` recién existe con la migración 57 (item 6.4). Sin ella, la
  // columna no está y pedirla haría fallar TODA la consulta: se pide solo cuando
  // el esquema ya la tiene; hasta entonces el álbum anda igual, sin el "día N".
  const conDia = disponible('diaDeRacha', await versionDelEsquema(supabase).catch(() => null));
  const colsLog = conDia ? 'id, fecha, planeta_del_dia, racha_del_dia' : 'id, fecha, planeta_del_dia';
  // Los días, las URL y las miniaturas, también a la vez.
  const [{ data: logsDatos }, { data: firmadas }, chicas] = await Promise.all([
    logIds.length
      ? supabase.from('logs').select(colsLog).in('id', logIds)
      : Promise.resolve({ data: [] as { id: string; fecha: string; planeta_del_dia: string | null; racha_del_dia: number | null }[] }),
    supabase.storage.from('fotos').createSignedUrls(rutas, 3600),
    miniaturas(supabase, rutas),
  ]);
  // El cast: `select(colsLog)` con una columna variable le saca el tipo a
  // supabase-js (no puede parsear un string de runtime). Es la misma forma en los
  // dos casos, con `racha_del_dia` opcional según el esquema.
  type LogFila = { id: string; fecha: string; planeta_del_dia: string | null; racha_del_dia?: number | null };
  const mapa = new Map(((logsDatos ?? []) as unknown as LogFila[]).map((l) => [l.id, l]));

  return {
    miRango,
    miPlaneta,
    celdas: fotos.map((f, i) => {
      const log = f.log_id ? mapa.get(f.log_id) : null;
      return {
        id: f.id as string,
        url: firmadas?.[i]?.signedUrl ?? '',
        miniatura: chicas[i] ?? '',
        ruta: f.storage_path as string,
        // Sin log (la foto quedó huérfana al corregir el día: photos.log_id es
        // ON DELETE SET NULL) la fecha sale de `creado`, PERO en local, no en
        // UTC: `.slice(0,10)` cortaba el día en UTC y una foto de las 22:30 en
        // Montevideo caía al día —y a veces al mes— siguiente. (29/9)
        fecha: (log?.fecha as string | undefined) ?? aISO(new Date(f.creado as string)),
        planeta: (log?.planeta_del_dia as string | null | undefined) ?? null,
        dia: (log?.racha_del_dia as number | null | undefined) ?? null,
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
  // La miniatura se va con ella: si no existe, borrarla no es un error.
  const { error: errArchivo } = await supabase.storage.from('fotos').remove([ruta, rutaDeMiniatura(ruta)]);
  if (errArchivo) return false;
  const { error: errFila } = await supabase.from('photos').delete().eq('id', id);
  return !errFila;
}

/**
 * HASTA DÓNDE SE MUESTRA LA GRILLA EN ORDEN: la primera celda que todavía no
 * cargó. Una celda SIN foto que pedir —la fila existe y el archivo no— cuenta
 * como lista: no va a avisar nunca que cargó, y esperarla dejaba invisibles a
 * todas las que venían después (4/10).
 */
export function cargadasEnOrden(cargadas: ReadonlySet<number>, sinFoto: ReadonlySet<number>): number {
  let hasta = 0;
  while (cargadas.has(hasta) || sinFoto.has(hasta)) hasta++;
  return hasta;
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
