import type { Cliente } from '@cliente';
import { plataforma } from '@plataforma';
import { leerPerfilCache } from '@compartido/cache';
import { encolar, estaPendiente } from '@compartido/cola';
import { versionDelEsquema } from '@compartido/esquema';
import { disponible } from '@nucleo/esquema';
import { hoyISO } from '@nucleo/fechas';
import { claveDeSubida, leerSubidas, marcasDelDia, subidasDeLaBase, subidasTrasLaSesion, type Subida, type Subidas } from '@nucleo/subir';
import type { Carga } from '@nucleo/carga';
import {
  leerModosDelCatalogo,
  leerPesosPorModo,
  pesosDeBloques,
  pesosDelHistorial,
  leerMaximos,
  maximosDeBloques,
  maximosDelHistorial,
  listosParaSubir,
  type MaximosDeLaUltima,
  type ModosDelCatalogo,
  type PesosPorModo,
} from '@nucleo/pesoRecordado';

/**
 * EL ÚLTIMO PESO POR EJERCICIO Y MODO, en este teléfono.
 *
 * La verdad está en la base: son los bloques de las sesiones guardadas. Esto es
 * la copia para el gimnasio sin señal, igual que `cargas.ts` con el modo: si
 * ayer hiciste remo con mancuernas a 20, hoy en el subsuelo cambiar a "por
 * mancuerna" tiene que proponer 20 sin esperar a nadie.
 *
 * SE REEMPLAZA ENTERA cada vez que la base contesta, y no se le va sumando de a
 * una serie: así una corrección —la etiqueta de un bloque, un peso mal anotado—
 * no deja en la copia el número de antes. Lo de HOY no vive acá: sale de los
 * bloques de la sesión, que ya están en el teléfono (`nucleo/pesoRecordado.ts`).
 *
 * ES DE UNA CUENTA. Va con el id de quien la guardó; con otra cuenta en el
 * mismo teléfono no se lee: proponerle a alguien los pesos de otro es peor que
 * no proponer nada.
 */
const CLAVE = 'ascent:pesos-por-modo';

/** La misma ventana que `como_arranca`: un peso de hace un año no se propone. */
const DIAS = 90;

// `maximos` (10/10): lo más pesado de la última vez de cada ejercicio, para la
// lista. Sale de las mismas sesiones y viaja en la misma copia.
// `subidas` (10/10): las marcas de "la próxima, más". La verdad está en la base
// (migración 65); esta copia es para proponer el peso sin señal.
// `paraSubir` (15/10): los ejercicios listos para subir de peso (`listosParaSubir`), para el globito.
export type Recordados = { pesos: PesosPorModo; catalogo: ModosDelCatalogo; maximos: MaximosDeLaUltima; subidas: Subidas; paraSubir: MaximosDeLaUltima };

const NADA: Recordados = { pesos: {}, catalogo: {}, maximos: {}, subidas: {}, paraSubir: {} };

// En memoria y fuera del hook: `useSesion` tiene dos instancias (Inicio y el
// vigilante) y las dos tienen que ver lo mismo sin pedirlo dos veces.
let memo: { de: string; datos: Recordados } | null = null;
// De quién es lo que ya se trajo de la base en esta corrida. Por cuenta: al
// cambiar de cuenta sin cerrar la app hay que volver a pedir.
let alDiaDe: string | null = null;
let enVuelo: Promise<Recordados> | null = null;

async function quienSoy(): Promise<string | null> {
  return (await leerPerfilCache())?.id ?? null;
}

/** La copia del teléfono. Sin red: es lo que se usa en el mismo gesto. */
export async function leerRecordados(): Promise<Recordados> {
  try {
    const yo = await quienSoy();
    if (!yo) return NADA;
    if (memo?.de === yo) return memo.datos;
    const crudo = await plataforma.almacenamiento.leer(CLAVE);
    const g = crudo
      ? (JSON.parse(crudo) as { de?: unknown; pesos?: unknown; catalogo?: unknown; maximos?: unknown; subidas?: unknown; paraSubir?: unknown })
      : null;
    const datos =
      g?.de === yo
        ? {
            pesos: leerPesosPorModo(g.pesos),
            catalogo: leerModosDelCatalogo(g.catalogo),
            maximos: leerMaximos(g.maximos),
            subidas: leerSubidas(g.subidas),
            paraSubir: leerMaximos(g.paraSubir),
          }
        : NADA;
    memo = { de: yo, datos };
    return datos;
  } catch {
    return NADA;
  }
}

async function guardar(de: string, datos: Recordados) {
  memo = { de, datos };
  try {
    await plataforma.almacenamiento.guardar(CLAVE, JSON.stringify({ de, ...datos }));
  } catch {
    // Sin almacenamiento sigue andando con lo que hay en memoria.
  }
}

/**
 * El historial, de la base. Si no contesta —sin señal— devuelve la copia: lo
 * que no puede pasar es que un error de red deje a alguien sin propuesta.
 *
 * La sesión que está corriendo NO entra: lo de hoy sale de los bloques del
 * teléfono, que están más al día que la base y se corrigen en el acto.
 */
export function traerRecordados(supabase: Cliente): Promise<Recordados> {
  if (!enVuelo) {
    enVuelo = (async () => {
      const yo = await quienSoy();
      if (!yo) return NADA;
      const desde = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000).toISOString();
      const conSubidas = disponible('subirPeso', await versionDelEsquema(supabase).catch(() => null));
      const [sesiones, ejercicios, marcas] = await Promise.all([
        supabase.from('sesiones').select('bloques').neq('estado', 'corriendo').gte('inicio', desde).order('inicio'),
        supabase.from('ejercicios').select('id, carga'),
        conSubidas ? supabase.rpc('mis_subidas') : Promise.resolve({ data: null, error: null }),
      ]);
      if (sesiones.error || ejercicios.error) return leerRecordados();
      // LAS MARCAS: manda la base, que sabe cuáles ya se gastaron. Salvo la que
      // este teléfono cambió y todavía no subió: esa es más nueva. Y si la base
      // no contestó, se queda la copia.
      const copia = (await leerRecordados()).subidas;
      let subidas = copia;
      if (conSubidas && !marcas.error) {
        const deLaBase = subidasDeLaBase(marcas.data);
        subidas = {};
        for (const clave of new Set([...Object.keys(deLaBase), ...Object.keys(copia)])) {
          const vale = (await estaPendiente('marcar_subida', clave)) ? copia[clave] : deLaBase[clave];
          if (vale) subidas[clave] = vale;
        }
      }
      const catalogo = leerModosDelCatalogo(
        Object.fromEntries(((ejercicios.data ?? []) as { id: string; carga?: unknown }[]).map((e) => [e.id, e.carga]))
      );
      const datos = {
        pesos: pesosDelHistorial(sesiones.data ?? [], catalogo),
        catalogo,
        maximos: maximosDelHistorial(sesiones.data ?? [], catalogo),
        subidas,
        paraSubir: listosParaSubir(sesiones.data ?? [], catalogo),
      };
      await guardar(yo, datos);
      alDiaDe = yo;
      return datos;
    })()
      .catch(() => leerRecordados())
      .finally(() => {
        enVuelo = null;
      });
  }
  return enVuelo;
}

/** Lo más al día que se pueda: de la base una vez por sesión, y si no la copia. */
/**
 * MARCAR (o sacar, con `null`) "la próxima, más" de un ejercicio. Primero en el
 * teléfono —el toque se ve en el acto y vale sin señal— y después a la base,
 * por la cola: es de la cuenta, no del aparato.
 */
export async function marcarSubida(supabase: Cliente, ejercicio: string, carga: Carga, s: Subida | null): Promise<void> {
  const yo = await quienSoy();
  if (!yo) return;
  const antes = await leerRecordados();
  const subidas = { ...antes.subidas };
  const clave = claveDeSubida(ejercicio, carga);
  if (s) subidas[clave] = s;
  else delete subidas[clave];
  await guardar(yo, { ...antes, subidas });
  if (!disponible('subirPeso', await versionDelEsquema(supabase).catch(() => null))) return;
  // El modo viaja SIEMPRE, también al sacarla: es lo que dice cuál de las del ejercicio.
  await encolar(supabase, {
    rpc: 'marcar_subida',
    args: { p_ejercicio: ejercicio, p_carga: carga, p_peso: s?.peso ?? null, p_series: s?.series ?? null, p_dia: s?.dia ?? null },
  });
}

/**
 * SACAR LAS MARCAS DE HOY DE UN EJERCICIO QUE YA NO ESTÁ EN LA SESIÓN (se
 * corrigió por otro, o se quitó su bloque). Ver `ejerciciosQueSeFueron`.
 */
export async function quitarMarcasDeHoy(supabase: Cliente, ejercicio: string, dia: string): Promise<void> {
  const { subidas } = await leerRecordados();
  for (const clave of marcasDelDia(subidas, ejercicio, dia)) await marcarSubida(supabase, ejercicio, subidas[clave].carga, null);
}

export async function recordadosAlDia(supabase: Cliente): Promise<Recordados> {
  const yo = await quienSoy();
  if (yo && alDiaDe === yo) return leerRecordados();
  return traerRecordados(supabase);
}

/**
 * AL TERMINAR UNA SESIÓN: sus bloques pasan a ser historial. Se suman a la
 * copia en el acto —por si la próxima vez no hay señal— y se marca que hay que
 * volver a pedirle a la base, que es la que manda.
 */
export async function sumarSesionARecordados(bloques: unknown, dia: string = hoyISO()): Promise<void> {
  alDiaDe = null;
  try {
    const yo = await quienSoy();
    if (!yo) return;
    const antes = await leerRecordados();
    await guardar(yo, {
      pesos: pesosDeBloques(bloques, antes.catalogo, antes.pesos),
      catalogo: antes.catalogo,
      maximos: maximosDeBloques(bloques, antes.catalogo, antes.maximos),
      // El día es el de la SESIÓN: terminar pasada la medianoche no puede
      // gastar las marcas que se pusieron en ella.
      subidas: subidasTrasLaSesion(antes.subidas, bloques, dia, antes.catalogo),
      // Sin el historial no se puede recalcular: queda el de antes hasta que conteste la base.
      paraSubir: antes.paraSubir,
    });
  } catch {
    // Es una conveniencia: no puede frenar el cierre de la sesión.
  }
}
