import type { Cliente } from '@cliente';
import { esDiaDeDescanso, type ConfigDescanso } from '@nucleo/descansos';
import { resumenDelDia, type ResumenDelDia, type SesionDelDia } from '@nucleo/resumenDia';
import type { Carga } from '@nucleo/carga';
import { disponible } from '@nucleo/esquema';
import type { Unidad } from '@nucleo/peso';
import { T } from '@nucleo/textos';

/**
 * UN DÍA, ABIERTO: lo que se pide para mostrarlo y lo que se hace para
 * corregirlo, una sola vez para las dos apps.
 *
 * Vivía adentro de `HojaDelDia` de la web; se sacó acá al portar el
 * calendario a la app nativa (18/9). Copiado, se separa — y acá separarse
 * sería grave: corregir un día puede borrar una sesión entera.
 */

export type Destino = 'fui' | 'descanso' | 'nada';

export type DatosDelDia = {
  resumen: ResumenDelDia;
  cuantasSesiones: number;
  /** URL firmada de la foto del día, si tiene. Vence en una hora. */
  foto: string | null;
  unidad: Unidad;
};

export async function cargarDia(supabase: Cliente, uid: string, fecha: string, esFuturo: boolean): Promise<DatosDelDia> {
  const [{ data: log }, { data: catalogo }, { data: cfgs }, { data: perfil }] = await Promise.all([
    supabase.from('logs').select('id, es_descanso, origen').eq('user_id', uid).eq('fecha', fecha).maybeSingle(),
    supabase.from('ejercicios').select('id, nombre, grupo'),
    supabase.from('descansos').select('desde, dias').order('desde', { ascending: false }),
    supabase.from('profiles').select('unidad_peso').eq('id', uid).maybeSingle(),
  ]);
  const [{ data: sesiones }, { data: fotos }] = log
    ? await Promise.all([
        supabase.from('sesiones').select('id, inicio, fin, estado, series, bloques').eq('log_id', log.id),
        supabase.from('photos').select('storage_path').eq('log_id', log.id).limit(1),
      ])
    : [{ data: [] }, { data: [] }];

  const resumen = resumenDelDia({
    log,
    sesiones: (sesiones ?? []) as SesionDelDia[],
    catalogo: new Map((catalogo ?? []).map((e) => [e.id as string, e.nombre as string])),
    esFuturo,
    esDescansoConfigurado: esDiaDeDescanso((cfgs ?? []) as ConfigDescanso[], fecha),
    ejercicioSinNombre: T.resumen.ejercicioSinNombre,
    grupos: new Map((catalogo ?? []).map((e) => [e.id as string, e.grupo as string])),
  });

  const ruta = (fotos as { storage_path: string }[] | null)?.[0]?.storage_path;
  let foto: string | null = null;
  if (ruta) {
    const { data: firmada } = await supabase.storage.from('fotos').createSignedUrl(ruta, 3600);
    foto = firmada?.signedUrl ?? null;
  }
  return {
    resumen,
    cuantasSesiones: (sesiones ?? []).length,
    foto,
    unidad: perfil?.unidad_peso === 'lb' ? 'lb' : 'kg',
  };
}

/** Lo que el día ES hoy, en los términos de corregir. `null` = futuro. */
export function destinoActual(resumen: ResumenDelDia | null): Destino | null {
  if (resumen?.estado === 'entrenado') return 'fui';
  if (resumen?.estado === 'descanso') return 'descanso';
  if (resumen?.estado === 'sin-registrar') return 'nada';
  return null;
}

/**
 * Pasa el día a `destino`. `error` es el texto para mostrar; `cambio` dice si
 * el día se tocó —si ni siquiera se pudo borrar, no cambió nada y no hay que
 * avisar que cambió—.
 *
 * Siempre se borra y se vuelve a poner, nunca `update`: la fila puede tener
 * origen y planeta del día que ya no corresponden a lo nuevo. Y borrar el día
 * borra en cascada su sesión: por eso la pantalla pregunta antes (ver
 * `queHacer`).
 */
export async function corregirDia(supabase: Cliente, uid: string, fecha: string, destino: Destino) {
  const { error: eBorrar } = await supabase.from('logs').delete().eq('user_id', uid).eq('fecha', fecha);
  if (eBorrar) return { error: T.calendario.noSeSaco, cambio: false };
  if (destino !== 'nada') {
    const { error: eAgregar } = await supabase.from('logs').insert({ user_id: uid, fecha, es_descanso: destino === 'descanso' });
    if (eAgregar) return { error: T.calendario.noSeAgrego, cambio: true };
  }
  return { error: null, cambio: true };
}

/**
 * Qué hacer con un toque en "corregir":
 *   - 'nada': es lo que ya está. Sin esto, tocar "Fui" en un día que ya era
 *     "fui" lo borraba y lo volvía a poner — y borrar el día borra en cascada
 *     su sesión. Un toque de confirmar lo que ya sabías se llevaba puesto el
 *     entrenamiento.
 *   - 'confirmar': sacarle el "fui" a un día con sesión la borra; se pregunta.
 *   - 'hacer': adelante.
 */
export function queHacer(destino: Destino, actual: Destino | null, cuantasSesiones: number, confirmado: boolean) {
  if (destino === actual) return 'nada' as const;
  if (destino !== 'fui' && cuantasSesiones > 0 && !confirmado) return 'confirmar' as const;
  return 'hacer' as const;
}

/**
 * Qué significaba el número de un bloque anotado antes de los modos
 * (migración 39). Elegir el que ya tenía es "estaba bien": también saca la
 * marca. Devuelve el texto del error, o `null`.
 *
 * Se pregunta ACÁ si la base ya tiene la función (`version` es la de
 * `useVersionDelEsquema`), y no en cada pantalla: la regla es que toda llamada
 * a una función nueva pregunte al lado, y el test lo mira.
 */
export async function revisarCarga(supabase: Cliente, version: number | null, sesion: string, orden: number, carga: Carga) {
  if (!disponible('revisarCargas', version)) return T.calendario.noSeAgrego;
  const { error } = await supabase.rpc('revisar_carga', { p_sesion: sesion, p_orden: orden, p_carga: carga });
  return error ? T.calendario.noSeAgrego : null;
}
