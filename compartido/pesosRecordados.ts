import type { Cliente } from '@cliente';
import { plataforma } from '@plataforma';
import { leerPerfilCache } from '@compartido/cache';
import {
  leerModosDelCatalogo,
  leerPesosPorModo,
  pesosDeBloques,
  pesosDelHistorial,
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

export type Recordados = { pesos: PesosPorModo; catalogo: ModosDelCatalogo };

const NADA: Recordados = { pesos: {}, catalogo: {} };

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
    const g = crudo ? (JSON.parse(crudo) as { de?: unknown; pesos?: unknown; catalogo?: unknown }) : null;
    const datos = g?.de === yo ? { pesos: leerPesosPorModo(g.pesos), catalogo: leerModosDelCatalogo(g.catalogo) } : NADA;
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
      const [sesiones, ejercicios] = await Promise.all([
        supabase.from('sesiones').select('bloques').neq('estado', 'corriendo').gte('inicio', desde).order('inicio'),
        supabase.from('ejercicios').select('id, carga'),
      ]);
      if (sesiones.error || ejercicios.error) return leerRecordados();
      const catalogo = leerModosDelCatalogo(
        Object.fromEntries(((ejercicios.data ?? []) as { id: string; carga?: unknown }[]).map((e) => [e.id, e.carga]))
      );
      const datos = { pesos: pesosDelHistorial(sesiones.data ?? [], catalogo), catalogo };
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
export async function sumarSesionARecordados(bloques: unknown): Promise<void> {
  alDiaDe = null;
  try {
    const yo = await quienSoy();
    if (!yo) return;
    const antes = await leerRecordados();
    await guardar(yo, { pesos: pesosDeBloques(bloques, antes.catalogo, antes.pesos), catalogo: antes.catalogo });
  } catch {
    // Es una conveniencia: no puede frenar el cierre de la sesión.
  }
}
