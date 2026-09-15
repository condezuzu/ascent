/**
 * EL VOLUMEN: qué venís haciendo, en kilos y en series.
 *
 * SIN REPETICIONES, a propósito (`spec/peso-y-estadistica.md` §1.5): el volumen
 * es `peso × series`, no `peso × reps × series`. No es el número de un libro de
 * entrenamiento y no se lo presenta como tal: sirve para comparar tus semanas
 * entre sí, que es para lo único que se lo usa acá.
 *
 * LOS KILOS SON LOS QUE SE MOVIERON, con el modo que quedó escrito EN CADA
 * BLOQUE (`carga.ts`): "30 por mancuerna" son 60, la goblet de 30 son 30, y
 * "dominadas con 20 de lastre" son 20 —el peso corporal no se suma, decisión
 * del humano—. Nunca se lee el modo del catálogo para un bloque ya hecho:
 * reclasificar un ejercicio no puede cambiar el volumen de hace un mes.
 *
 * LAS SERIES CUENTAN AUNQUE NO TENGAN PESO. Quien no anota pesos tiene su
 * volumen en series igual; los kilos son una capa encima.
 *
 * LO QUE LA APP SABE ES LO QUE SE ANOTÓ, no lo que se entrenó. Por eso "dónde
 * no estás entrenando" solo habla si en esas semanas SÍ se anotaron
 * ejercicios: a quien dejó de usar el selector no se le avisa que dejó pierna.
 *
 * NO IMPORTA NADA salvo `carga` y `fechas`: se prueba con node pelado.
 */

import { cargaValida, kilosMovidos, type Carga } from './carga.ts';
import { deISO, restarDias } from './fechas.ts';
import { ORDEN_ZONAS, ZONAS } from './ejercicios.ts';

/** Un bloque leído de la base sin confiar en la forma. */
export type BloqueLeido = {
  ejercicio: string;
  series: number;
  /** Uno por serie, en kilos; `null` las que se hicieron sin anotar. */
  pesos: (number | null)[];
  /** El modo del bloque; `total` si no tiene (antes de la 38). */
  carga: Carga;
  /** Se anotó antes de que existieran los modos y puede estar mal (migración 39). */
  supuesta: boolean;
  /** Posición en la lista guardada, desde 1: la que usa `revisar_carga`. */
  orden: number;
};

export function leerBloques(crudo: unknown): BloqueLeido[] {
  if (!Array.isArray(crudo)) return [];
  return crudo.flatMap((b, i) => {
    if (!b || typeof b !== 'object') return [];
    const x = b as { ejercicio?: unknown; series?: unknown; pesos?: unknown; carga?: unknown; carga_supuesta?: unknown };
    const s = Number(x.series);
    if (typeof x.ejercicio !== 'string' || !Number.isFinite(s) || s <= 0) return [];
    const n = Math.floor(s);
    const lista = Array.isArray(x.pesos) ? x.pesos : [];
    // Uno por serie: lo que venga de más se ignora y lo que falte es null.
    const pesos = Array.from({ length: n }, (_, j) => {
      const v = Number(lista[j]);
      return lista[j] !== null && Number.isFinite(v) && v > 0 ? v : null;
    });
    return [
      {
        ejercicio: x.ejercicio,
        series: n,
        pesos,
        carga: cargaValida(x.carga) ?? 'total',
        supuesta: x.carga_supuesta === true && pesos.some((p) => p !== null),
        orden: i + 1,
      },
    ];
  });
}

/** Los kilos que se movieron en un bloque: la suma de sus series con peso. */
export function kilosDelBloque(b: Pick<BloqueLeido, 'pesos' | 'carga'>): number {
  const total = b.pesos.reduce<number>((t, p) => (p === null ? t : t + kilosMovidos(p, b.carga)), 0);
  return Math.round(total * 100) / 100;
}

export type Catalogo = Map<string, { nombre: string; grupo: string }>;

/** Los grupos en el orden de la interfaz (el mismo del selector), no alfabético. */
export const ORDEN_GRUPOS: string[] = ORDEN_ZONAS.flatMap((z) => ZONAS[z]);

function ordenDeGrupo(g: string): number {
  const i = ORDEN_GRUPOS.indexOf(g);
  return i === -1 ? ORDEN_GRUPOS.length : i;
}

export type VolumenDeGrupo = { grupo: string; kilos: number; series: number };

/**
 * EL VOLUMEN POR MÚSCULO de un conjunto de bloques (un día, una semana).
 * Solo los grupos que tuvieron algo, en el orden de la interfaz. Un ejercicio
 * que ya no está en el catálogo no tiene grupo y queda afuera: repartirlo en
 * "otros" sería inventarle un músculo.
 */
export function volumenPorGrupo(bloques: BloqueLeido[], catalogo: Catalogo): VolumenDeGrupo[] {
  const por = new Map<string, VolumenDeGrupo>();
  for (const b of bloques) {
    const grupo = catalogo.get(b.ejercicio)?.grupo;
    if (!grupo) continue;
    const v = por.get(grupo) ?? { grupo, kilos: 0, series: 0 };
    v.kilos = Math.round((v.kilos + kilosDelBloque(b)) * 100) / 100;
    v.series += b.series;
    por.set(grupo, v);
  }
  return [...por.values()].sort((a, b) => ordenDeGrupo(a.grupo) - ordenDeGrupo(b.grupo));
}

/** Una sesión con su día (el del registro, en hora del usuario) y sus bloques crudos. */
export type SesionConBloques = { id?: string; fecha: string; bloques: unknown };

/** El lunes de la semana de una fecha. La semana del gimnasio empieza el lunes. */
export function lunesDe(fecha: string): string {
  const dia = deISO(fecha).getDay(); // 0 = domingo
  return restarDias(fecha, (dia + 6) % 7);
}

export type Semana = { desde: string; kilos: number; series: number };

/**
 * LAS ÚLTIMAS `semanas` SEMANAS, la más vieja primero y la actual al final,
 * INCLUIDAS LAS VACÍAS: una semana sin gimnasio es un hueco en las barras, no
 * una barra que desaparece y corre a las demás.
 *
 * `grupo` filtra por músculo; `null` es todo, incluidas las series de
 * ejercicios que ya no están en el catálogo.
 */
export function volumenPorSemana(
  sesiones: SesionConBloques[],
  catalogo: Catalogo,
  { hoy, semanas, grupo = null }: { hoy: string; semanas: number; grupo?: string | null }
): Semana[] {
  const actual = lunesDe(hoy);
  const lista: Semana[] = Array.from({ length: semanas }, (_, i) => ({
    desde: restarDias(actual, 7 * (semanas - 1 - i)),
    kilos: 0,
    series: 0,
  }));
  const indice = new Map(lista.map((s, i) => [s.desde, i]));
  for (const s of sesiones) {
    const i = indice.get(lunesDe(s.fecha));
    if (i === undefined) continue;
    for (const b of leerBloques(s.bloques)) {
      if (grupo !== null && catalogo.get(b.ejercicio)?.grupo !== grupo) continue;
      lista[i].kilos = Math.round((lista[i].kilos + kilosDelBloque(b)) * 100) / 100;
      lista[i].series += b.series;
    }
  }
  return lista;
}

export type Maximo = {
  ejercicio: string;
  nombre: string;
  /** El número como se escribió: "30" de "30 por mancuerna". */
  peso: number;
  carga: Carga;
  /** Lo que se movió en esa serie. Es lo que se compara. */
  kilos: number;
  /** La PRIMERA vez que se llegó a ese máximo: repetirlo no lo hace más nuevo. */
  fecha: string;
  /** La última vez que se hizo el ejercicio, con o sin peso. Ordena la lista. */
  ultimaVez: string;
};

/**
 * EL PESO MÁXIMO DE CADA EJERCICIO. Se compara por kilos movidos y no por el
 * número escrito: zancadas con barra de 60 y con dos mancuernas de 30 son el
 * mismo máximo, y "60" contra "30" diría lo contrario.
 *
 * En orden de lo último que hiciste: lo que estás entrenando ahora arriba, lo
 * que dejaste hace meses abajo.
 */
export function maximosPorEjercicio(sesiones: SesionConBloques[], catalogo: Catalogo): Maximo[] {
  const ordenadas = [...sesiones].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  const por = new Map<string, Maximo>();
  for (const s of ordenadas) {
    for (const b of leerBloques(s.bloques)) {
      const nombre = catalogo.get(b.ejercicio)?.nombre;
      if (!nombre) continue;
      const previo = por.get(b.ejercicio);
      if (previo) previo.ultimaVez = s.fecha;
      for (const p of b.pesos) {
        if (p === null) continue;
        const kilos = kilosMovidos(p, b.carga);
        const actual = por.get(b.ejercicio);
        // Estrictamente mayor: el mismo máximo otro día no mueve la fecha.
        if (!actual || kilos > actual.kilos) {
          por.set(b.ejercicio, { ejercicio: b.ejercicio, nombre, peso: p, carga: b.carga, kilos, fecha: s.fecha, ultimaVez: s.fecha });
        }
      }
    }
  }
  return [...por.values()].sort((a, b) =>
    a.ultimaVez !== b.ultimaVez ? (a.ultimaVez < b.ultimaVez ? 1 : -1) : a.nombre.localeCompare(b.nombre)
  );
}

export type GrupoDejado = { grupo: string; ultima: string; semanas: number };

/**
 * DÓNDE NO ESTÁS ENTRENANDO: grupos que aparecieron antes y hace `semanas` o
 * más que no aparecen.
 *
 * SOLO SI EN ESAS SEMANAS SE ANOTARON EJERCICIOS. Si no hay ninguno, no se
 * sabe nada: la persona dejó de usar el selector, no dejó de entrenar, y el
 * aviso sería exactamente el que hace que se apaguen los avisos.
 *
 * Describe, no receta: devuelve el grupo, desde cuándo y cuántas semanas. Las
 * palabras están en `textos.ts`.
 */
export function gruposDejados(
  sesiones: SesionConBloques[],
  catalogo: Catalogo,
  { hoy, semanas }: { hoy: string; semanas: number }
): GrupoDejado[] {
  const desde = restarDias(hoy, semanas * 7);
  const ultima = new Map<string, string>();
  let anotoEnLaVentana = false;
  for (const s of sesiones) {
    for (const b of leerBloques(s.bloques)) {
      const grupo = catalogo.get(b.ejercicio)?.grupo;
      if (!grupo) continue;
      if (s.fecha > desde) anotoEnLaVentana = true;
      const u = ultima.get(grupo);
      if (!u || s.fecha > u) ultima.set(grupo, s.fecha);
    }
  }
  if (!anotoEnLaVentana) return [];
  return [...ultima]
    .filter(([, f]) => f <= desde)
    .map(([grupo, f]) => ({
      grupo,
      ultima: f,
      semanas: Math.floor(Math.round((deISO(hoy).getTime() - deISO(f).getTime()) / 86400000) / 7),
    }))
    .sort((a, b) => ordenDeGrupo(a.grupo) - ordenDeGrupo(b.grupo));
}
