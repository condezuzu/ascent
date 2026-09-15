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

/**
 * LAS FILAS DE `sesiones` como las devuelve Supabase con `logs(fecha)`
 * embebido, pasadas a `SesionConBloques`. El embebido puede venir como objeto
 * o como lista según cómo lo infiera el cliente; una sesión sin día no se usa.
 *
 * Vive acá y no en cada app para que la web y la nativa lean lo mismo.
 */
export function sesionesConFecha(filas: unknown): SesionConBloques[] {
  if (!Array.isArray(filas)) return [];
  return filas.flatMap((s) => {
    if (!s || typeof s !== 'object') return [];
    const x = s as { id?: unknown; bloques?: unknown; logs?: unknown };
    const log = Array.isArray(x.logs) ? x.logs[0] : x.logs;
    const fecha = log && typeof log === 'object' ? (log as { fecha?: unknown }).fecha : undefined;
    if (typeof fecha !== 'string') return [];
    return [{ id: typeof x.id === 'string' ? x.id : undefined, fecha, bloques: x.bloques }];
  });
}

/** Los grupos que aparecen en lo anotado, en el orden de la interfaz: los filtros. */
export function gruposAnotados(sesiones: SesionConBloques[], catalogo: Catalogo): string[] {
  const vistos = new Set<string>();
  for (const s of sesiones) {
    for (const b of leerBloques(s.bloques)) {
      const g = catalogo.get(b.ejercicio)?.grupo;
      if (g) vistos.add(g);
    }
  }
  return ORDEN_GRUPOS.filter((g) => vistos.has(g));
}

/** La semana que se lee debajo de las barras: la tocada, o la última con algo. */
export function semanaParaLeer(semanas: Semana[], tocada: number | null): number {
  if (tocada !== null && tocada >= 0 && tocada < semanas.length) return tocada;
  return semanas.reduce((ult, s, i) => (s.series > 0 ? i : ult), semanas.length - 1);
}

/** Los días con bloques por revisar (migración 39). */
export function fechasPorRevisar(sesiones: SesionConBloques[]): Set<string> {
  const fechas = new Set<string>();
  for (const s of sesiones) if (leerBloques(s.bloques).some((b) => b.supuesta)) fechas.add(s.fecha);
  return fechas;
}

export type FilaDeMusculo = {
  grupo: string;
  semanas: Semana[];
  /** Si hace `umbral` semanas o más que no aparece: la fila lo dice en voz baja. */
  dejado: GrupoDejado | null;
};

/**
 * LA PANTALLA ENTERA EN FILAS: un músculo por fila, con sus semanas.
 *
 * NO DICE "VOLUMEN". Quien va al gimnasio sabe qué es una serie y no qué es
 * volumen, así que cada fila son barras chicas —una por semana— de cuántas
 * series hiciste de ese músculo. Los kilos son la misma fila en otra unidad.
 *
 * "DÓNDE NO ESTÁS ENTRENANDO" DEJÓ DE SER UNA SECCIÓN: una fila con las barras
 * de la derecha vacías ya lo muestra, y el texto queda como una nota chica al
 * lado del nombre.
 *
 * TODAS LAS FILAS COMPARTEN LA ESCALA (`tope`): con una escala por fila, tres
 * series de core y treinta de pierna dibujarían barras del mismo alto.
 */
export function filasPorMusculo(
  sesiones: SesionConBloques[],
  catalogo: Catalogo,
  { hoy, semanas, umbral }: { hoy: string; semanas: number; umbral: number }
): { filas: FilaDeMusculo[]; topeSeries: number; topeKilos: number } {
  const dejados = new Map(gruposDejados(sesiones, catalogo, { hoy, semanas: umbral }).map((d) => [d.grupo, d]));
  const filas = gruposAnotados(sesiones, catalogo).map((grupo) => ({
    grupo,
    semanas: volumenPorSemana(sesiones, catalogo, { hoy, semanas, grupo }),
    dejado: dejados.get(grupo) ?? null,
  }));
  const todas = filas.flatMap((f) => f.semanas);
  return {
    filas,
    topeSeries: Math.max(0, ...todas.map((s) => s.series)),
    topeKilos: Math.max(0, ...todas.map((s) => s.kilos)),
  };
}

export type EjercicioDelCatalogo = {
  id: string;
  nombre: string;
  grupo: string;
  orden?: number;
  admite_peso?: boolean;
  cuenta_dots?: boolean;
};

export type MarcaParaMaximo = { ejercicio: string; peso: number; fecha: string };

export type MaximoDeLista = {
  peso: number;
  carga: Carga;
  kilos: number;
  fecha: string;
};

export type FilaDeMaximo = { ejercicio: string; nombre: string; maximo: MaximoDeLista | null };

export type GrupoDeMaximos = {
  /** `null` son los tres del DOTS, sueltos y arriba como en el selector. */
  grupo: string | null;
  filas: FilaDeMaximo[];
  /** Cuántos del grupo tienen un máximo. */
  conPeso: number;
};

/**
 * EL PESO MÁXIMO DE TODO EL CATÁLOGO, en el orden del selector.
 *
 * EL PEDIDO (15/9): "solo muestra lo de hoy". No era un error de la cuenta
 * sino del diseño: la lista salía SOLO de los pesos anotados en series, que se
 * guardan desde la migración 36, y no miraba las marcas. Ahora es la misma
 * lista con la que se elige al entrenar —los tres del DOTS arriba y después
 * cada músculo—, con el máximo de cada uno o nada.
 *
 * DOS FUENTES, UNA CUENTA: lo más pesado que se MOVIÓ, en una serie (con su
 * modo: 30 por mancuerna son 60) o en una marca (el peso levantado, no el 1RM
 * estimado, que es una cuenta y no algo que pasó). Si empatan, gana la fecha
 * más vieja: repetirlo no lo hace más nuevo.
 *
 * Quedan afuera los que no admiten peso (plancha): su fila estaría siempre
 * vacía, y ahí el guion no significaría "todavía no".
 */
export function maximosDelCatalogo(
  sesiones: SesionConBloques[],
  marcas: MarcaParaMaximo[],
  catalogo: EjercicioDelCatalogo[]
): GrupoDeMaximos[] {
  const mapa: Catalogo = new Map(catalogo.map((e) => [e.id, { nombre: e.nombre, grupo: e.grupo }]));
  const mejor = new Map<string, MaximoDeLista>();
  const proponer = (ejercicio: string, m: MaximoDeLista) => {
    const actual = mejor.get(ejercicio);
    if (!actual || m.kilos > actual.kilos || (m.kilos === actual.kilos && m.fecha < actual.fecha)) {
      mejor.set(ejercicio, m);
    }
  };
  for (const m of maximosPorEjercicio(sesiones, mapa)) {
    proponer(m.ejercicio, { peso: m.peso, carga: m.carga, kilos: m.kilos, fecha: m.fecha });
  }
  for (const m of marcas) {
    const peso = Number(m.peso);
    if (!Number.isFinite(peso) || peso <= 0 || typeof m.fecha !== 'string') continue;
    proponer(m.ejercicio, { peso, carga: 'total', kilos: peso, fecha: m.fecha });
  }

  const orden = (a: EjercicioDelCatalogo, b: EjercicioDelCatalogo) =>
    (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre);
  const armar = (grupo: string | null, suyos: EjercicioDelCatalogo[]): GrupoDeMaximos[] => {
    if (suyos.length === 0) return [];
    const filas = [...suyos].sort(orden).map((e) => ({ ejercicio: e.id, nombre: e.nombre, maximo: mejor.get(e.id) ?? null }));
    return [{ grupo, filas, conPeso: filas.filter((f) => f.maximo).length }];
  };
  const conPeso = catalogo.filter((e) => e.admite_peso !== false);
  return [
    ...armar(null, conPeso.filter((e) => e.cuenta_dots)),
    ...ORDEN_GRUPOS.flatMap((g) => armar(g, conPeso.filter((e) => e.grupo === g && !e.cuenta_dots))),
  ];
}
