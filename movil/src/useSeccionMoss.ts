import { useCallback, useEffect, useState } from 'react';
import { plataforma } from '@plataforma';
import { miId } from '@compartido/quienSoy';
import { cargarMisRutinas } from '@compartido/rutinas';
import { hoyISO, restarDias } from '@nucleo/fechas';
import { anotarSeccion, leerMossGuardada } from '@compartido/mossGuardada';
import CATALOGO from '@nucleo/catalogoMuscular.json';
import { DIAS_DEL_E1RM, diasHastaListo, e1rm, estadoDeFatiga, listoEl, mejorE1rm, notaDeLaRutina, puntaje, estadoDelPuntaje, seriesPorMusculo, type EstadoDeFatiga, type EstadoDelPuntaje, type NotaDeLaRutina } from '@nucleo/puntajeMuscular';
import { estaEstancado, grupoDelAnio, proyeccionDeMeta, razonesDeEstancamiento, tendenciaDeFuerza, type GrupoDelAnio, type ProyeccionDeMeta, type RazonesDeEstancamiento, type SemanaDeEntreno, type TendenciaDeFuerza } from '@nucleo/progresoCompartido';
import { diasDeLaRutina, ejerciciosRecientes, GRUPO_A_MUSCULO, gruposDelDia, musculosEnSesiones, semanaDeEntreno, semanasParaLasRazones, type BloqueHecho, type DelCatalogo, type EjercicioDeLaSemana, type SesionHecha } from '@nucleo/semanaMuscular';
import { dentroDeLaSemana } from '@nucleo/puntajeMuscular';
import { sugerenciasDeHoy, type EntradaDeHoy, type SugerenciasDeHoy } from '@nucleo/sugerenciasDeHoy';
import { supabase } from './supabase';

/** Los años de entrenamiento de cada respuesta del cuestionario de Moss (los de su vista). */
const ANIOS: Record<string, number> = { principiante: 0, intermedio: 2, avanzado: 4 };

const CAT = CATALOGO as Record<string, DelCatalogo & { multiarticular?: boolean }>;

/** `total`: los días desde su última sesión hasta que esté listo (para el reloj). */
export type DelMusculoEnLaSeccion = { series: number; partes: Record<string, number>; puntaje: number; estado: EstadoDelPuntaje; fatiga: EstadoDeFatiga; vuelveEn: number; total: number };
export type Estancado = { id: string; nombre: string; tendencia: TendenciaDeFuerza; musculo: string; antes: SemanaDeEntreno[]; ahora: SemanaDeEntreno[]; r: RazonesDeEstancamiento };
/** Una semana de Moss (moss_semanas de 0015): sus noches, su comida y su peso. */
type SemanaDeMoss = { lunes: string; noches: number; dormido: number | null; dias_con_comida: number; proteina_g_kg: number | null; peso: number | null };
export type Meta = { id: string; ejercicio: string; nombre: string; kilos: number; reps: number; proyeccion: ProyeccionDeMeta; nivel: number | null };

export type SeccionMoss = {
  hoy: string;
  musculos: Map<string, DelMusculoEnLaSeccion>;
  /** Los ejercicios de los últimos 126 días: el detalle de un músculo y la próxima sesión salen de acá. */
  recientes: EjercicioDeLaSemana[];
  nombres: Record<string, string>;
  objetivos: Record<string, number>;
  /** El peso más alto de la última sesión con cada ejercicio (0, con el del cuerpo). */
  pesos: Record<string, number>;
  /** Los ejercicios de la sesión que toca hoy, mientras no esté hecha: hoy no suben con sueño corto o un músculo que se recupera. */
  deHoy: string[];
  sugerencias: SugerenciasDeHoy;
  nota: NotaDeLaRutina | null;
  /** Hoy, después de una noche de 6 h o menos (Moss): la próxima no sube. */
  nocheCortaHoy: boolean;
  anio: Map<string, GrupoDelAnio>;
  estancados: Estancado[];
  metas: Meta[] | null;
};

const totalDe = (xs: Parameters<typeof listoEl>[0], vuelveEn: number) => {
  const ultima = xs.at(-1)?.fecha;
  const listo = listoEl(xs);
  return ultima && listo ? Math.max(vuelveEn, Math.round((Date.parse(`${listo}T12:00:00Z`) - Date.parse(`${ultima}T12:00:00Z`)) / 86400000)) : vuelveEn;
};

const fechaDe = (s: { logs?: unknown }) => {
  const l = s.logs as { fecha?: string } | { fecha?: string }[] | undefined;
  return (Array.isArray(l) ? l[0]?.fecha : l?.fecha) ?? null;
};

/**
 * LA SECCIÓN DE MOSS EN ASCENT (19/11, spec/musculos-compartido.md): lo de Ascent (las sesiones con su RIR, la
 * rutina, las marcas) y lo de Moss (la noche, las metas de fuerza), pasado por las cuentas compartidas. Lo que no se
 * pudo leer queda vacío y su bloque no se muestra.
 */
/** Las sesiones hechas (no abandonadas) desde un día, y hasta otro sin incluirlo. */
type SesionConTiempo = SesionHecha & { terminada: boolean; minutos: number | null };
async function sesionesDesde(uid: string, desde: string, hasta?: string): Promise<SesionConTiempo[]> {
  let q = supabase.from('sesiones').select('bloques, estado, inicio, fin, logs!inner(fecha)').eq('user_id', uid).neq('estado', 'abandonada').gte('logs.fecha', desde);
  if (hasta) q = q.lt('logs.fecha', hasta);
  const { data } = await q;
  return ((data ?? []) as { bloques?: unknown; logs?: unknown; estado?: string; inicio?: string; fin?: string | null }[]).flatMap((s) => {
    const fecha = fechaDe(s);
    const minutos = s.inicio && s.fin ? Math.round((Date.parse(s.fin) - Date.parse(s.inicio)) / 60000) : null;
    return fecha && Array.isArray(s.bloques) ? [{ fecha, bloques: s.bloques as BloqueHecho[], terminada: s.estado === 'terminada', minutos }] : [];
  });
}

/**
 * `activa`: la cuenta está vinculada. Desde el 23/11 carga apenas se entra a Stats, no al tirar, y lo de hoy guardado en
 * el teléfono sale al instante mientras se pregunta de nuevo; `abierta` vuelve a preguntar al entrar a Moss.
 */
export function useSeccionMoss(activa: boolean, abierta: boolean) {
  const [datos, setDatos] = useState<SeccionMoss | null>(null);
  // Ya se intentó una vez: recién ahí, sin datos, tiene sentido mostrar «Desvincular» sola.
  const [intentada, setIntentada] = useState(false);
  useEffect(() => {
    void (async () => {
      const uid = await miId(supabase);
      const g = uid ? await leerMossGuardada(uid) : null;
      if (g?.vinculada && g.hoy === hoyISO() && g.seccion) setDatos((d) => d ?? (g.seccion as SeccionMoss));
    })();
  }, []);
  const cargar = useCallback(async () => {
    try {
      await cargarYa();
    } finally {
      setIntentada(true);
    }
  }, []);
  const cargarYa = async () => {
    const uid = await miId(supabase);
    const { data: hoyDeLaBase } = await supabase.rpc('mi_hoy');
    if (!uid || typeof hoyDeLaBase !== 'string') return;
    const hoy = hoyDeLaBase;
    const desde = [restarDias(hoy, DIAS_DEL_E1RM - 1), `${hoy.slice(0, 4)}-01-01`].sort()[0];
    const [ses, ejs, prs, rutinas, mossHoy, metas, primerDia, mossAyer] = await Promise.all([
      sesionesDesde(uid, desde),
      supabase.from('ejercicios').select('id, nombre, grupo'),
      supabase.from('prs').select('ejercicio, fecha').eq('user_id', uid),
      cargarMisRutinas(supabase).catch(() => null),
      supabase.schema('moss').rpc('moss_hoy', { p_fecha: hoy }),
      supabase.schema('moss').rpc('metas_de_fuerza'),
      supabase.from('logs').select('fecha').eq('user_id', uid).order('fecha').limit(1),
      supabase.schema('moss').rpc('moss_hoy', { p_fecha: restarDias(hoy, 1) }),
    ]);
    const sesiones = ses;
    const filas = (ejs.data ?? []) as { id: string; nombre: string; grupo: string }[];
    const nombres = Object.fromEntries(filas.map((e) => [e.id, e.nombre]));
    const grupoDe = Object.fromEntries(filas.map((e) => [e.id, e.grupo]));
    const grupoDePropio = Object.fromEntries(filas.filter((e) => e.id.startsWith('propio_')).map((e) => [e.id, e.grupo]));
    const activa = rutinas?.find((r) => r.activa) ?? null;
    const objetivos: Record<string, number> = {};
    for (const d of activa?.dias ?? []) for (const e of d.ejercicios) if (e.reps && !objetivos[e.ejercicio]) objetivos[e.ejercicio] = e.reps;

    const recientes = ejerciciosRecientes(sesiones, hoy, CAT, grupoDePropio, objetivos);
    const semana = recientes.filter((e) => dentroDeLaSemana(e.fecha, hoy));
    const fatiga = musculosEnSesiones(recientes, CAT);
    const musculos = new Map<string, DelMusculoEnLaSeccion>();
    for (const [m, x] of seriesPorMusculo(semana)) {
      const vuelveEn = diasHastaListo(listoEl(fatiga.get(m) ?? []), hoy);
      const p = puntaje(x.series);
      musculos.set(m, { ...x, puntaje: p, estado: estadoDelPuntaje(p), fatiga: estadoDeFatiga(vuelveEn), vuelveEn, total: totalDe(fatiga.get(m) ?? [], vuelveEn) });
    }
    // Un músculo que no tuvo series esta semana pero todavía se recupera también se muestra (como fatigado).
    for (const [m, xs] of fatiga) {
      const vuelveEn = diasHastaListo(listoEl(xs), hoy);
      if (!musculos.has(m) && vuelveEn > 0) musculos.set(m, { series: 0, partes: {}, puntaje: 0, estado: 'sinEntrenar', fatiga: estadoDeFatiga(vuelveEn), vuelveEn, total: totalDe(xs, vuelveEn) });
    }

    // Tu año: el grupo de lo que más trabajó cada día.
    const delDia = new Map<string, BloqueHecho[]>();
    for (const s of sesiones) if (s.fecha.startsWith(hoy.slice(0, 4))) delDia.set(s.fecha, [...(delDia.get(s.fecha) ?? []), ...s.bloques]);
    const anio = new Map<string, GrupoDelAnio>();
    for (const [f, bs] of delDia) {
      const g = grupoDelAnio(gruposDelDia(bs, grupoDe));
      if (g) anio.set(f, g);
    }

    // La tendencia de fuerza de un ejercicio: un punto por sesión, el mejor e1RM, en semanas desde hoy (hoy es 0).
    const entrenado = typeof primerDia.data?.[0]?.fecha === 'string' && restarDias(hoy, 182) >= primerDia.data[0].fecha;
    const tendenciaDe = (id: string) => {
      const puntos = sesiones.flatMap((s) => {
        const series = s.bloques.filter((b) => b.ejercicio === id).flatMap((b) => Array.from({ length: b.series }, (_, i) => ({ peso: b.pesos?.[i] ?? 0, reps: b.reps?.[i] ?? null })));
        const v = mejorE1rm(series);
        return v === null ? [] : [{ t: (Date.parse(`${s.fecha}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 86400000 / 7, e1rm: v }];
      });
      return tendenciaDeFuerza(puntos, { hoy: 0, entrenado });
    };

    // Estancados: los multiarticulares de la rutina con alguna marca (sin rutina, los de las últimas 4 semanas).
    const ultimaMarca = new Map<string, string>();
    for (const p of (prs.data ?? []) as { ejercicio: string; fecha: string }[]) if ((ultimaMarca.get(p.ejercicio) ?? '') < p.fecha) ultimaMarca.set(p.ejercicio, p.fecha);
    const candidatos = activa
      ? [...new Set(activa.dias.flatMap((d) => d.ejercicios.map((e) => e.ejercicio)))]
      : [...new Set(recientes.filter((e) => e.fecha >= restarDias(hoy, 27)).map((e) => e.id))];
    const quietos = candidatos
      .filter((id) => CAT[id]?.multiarticular && ultimaMarca.has(id))
      .flatMap((id) => {
        const t = tendenciaDe(id);
        const sinMarca = Math.floor((Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${ultimaMarca.get(id)}T12:00:00Z`)) / 86400000 / 7);
        return estaEstancado(t, sinMarca) ? [{ id, t, semanas: semanasParaLasRazones(ultimaMarca.get(id)!, hoy) }] : [];
      });

    // Por qué: como calcularTodo de Moss, comparando las 6 semanas hasta la última marca con las de después.
    let estancados: Estancado[] = [];
    if (quietos.length) {
      const primera = quietos.map((q) => q.semanas.antes[0]).sort()[0];
      const [viejas, semanasMoss, objetivo] = await Promise.all([
        primera < desde ? sesionesDesde(uid, primera, desde) : Promise.resolve([]),
        supabase.schema('moss').rpc('moss_semanas', { p_desde: primera }),
        supabase.schema('moss').rpc('moss_objetivo'),
      ]);
      const todas = [...viejas, ...sesiones].filter((x) => x.fecha < hoy);
      const deMoss = new Map(((Array.isArray(semanasMoss.data) ? semanasMoss.data : []) as SemanaDeMoss[]).map((w) => [w.lunes, w]));
      const conPeso = [...deMoss.values()].filter((w) => w.peso);
      const [previa, ultima] = conPeso.slice(-2);
      const o = objetivo.data as { objetivo?: string; sin_deficit?: boolean; baja_semanal?: number | null; experiencia?: string | null } | null;
      // Lo que baja por semana y la experiencia, los de Moss (su 0017); sin ellos, el peso de las dos últimas semanas
      // con peso y los años desde el primer registro de Ascent.
      const baja = typeof o?.baja_semanal === 'number' ? o.baja_semanal : previa && ultima ? ((previa.peso! - ultima.peso!) / ultima.peso!) * 100 : null;
      const anios = o?.experiencia ? ANIOS[o.experiencia] : undefined;
      const dormido = (lunes: string[]) => {
        const ws = lunes.flatMap((l) => (deMoss.get(l)?.dormido != null ? [deMoss.get(l)!] : []));
        const noches = ws.reduce((a, w) => a + w.noches, 0);
        return noches >= 3 ? ws.reduce((a, w) => a + w.dormido! * w.noches, 0) / noches : null;
      };
      const desdeElPrimero = typeof primerDia.data?.[0]?.fecha === 'string' ? (Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${primerDia.data[0].fecha}T12:00:00Z`)) / 86400000 / 365 : null;
      const conSesion = (l: string) => todas.some((x) => x.fecha >= l && x.fecha < restarDias(l, -7));
      estancados = quietos.flatMap(({ id, t, semanas }) => {
        const musculo = CAT[id]?.principal[0] ?? GRUPO_A_MUSCULO[grupoDePropio[id] ?? ''];
        if (!musculo) return [];
        const semana = (l: string) => semanaDeEntreno(todas, l, id, musculo, CAT, grupoDePropio);
        const antes = semanas.antes.filter(conSesion).map(semana);
        const ahora = semanas.ahora.filter(conSesion).map(semana);
        const r = razonesDeEstancamiento({
          antes, ahora,
          objetivo: o?.objetivo === 'bajar' || o?.objetivo === 'subir' ? o.objetivo : 'mantener',
          sinDeficit: !!o?.sin_deficit,
          bajaSemanal: baja,
          // La proteína ya viene en g por kilo: con peso 1, la cuenta compartida la deja igual. Sin peso, no hay comida que mirar.
          comida: semanas.ahora.map((l) => {
            const w = deMoss.get(l);
            return w && w.proteina_g_kg != null ? { dias: w.dias_con_comida, proteina: w.proteina_g_kg } : { dias: 0, proteina: 0 };
          }),
          pesoKg: 1,
          sueno: { antes: dormido(semanas.antes), ahora: dormido(semanas.ahora) },
          anios: anios ?? (desdeElPrimero === null ? null : Math.floor(desdeElPrimero)),
        });
        return [{ id, nombre: nombres[id] ?? id, tendencia: t, musculo, antes, ahora, r }];
      });
    }

    // La sesión de hoy, como la arma Moss: la hecha (terminada) o la que toca según la rutina activa; sin rutina, la del
    // mismo día de la semana en las últimas 4 semanas, que también da cuánto suele durar.
    const dia = new Date(`${hoy}T12:00:00Z`).getUTCDay();
    const referencia = [...sesiones].reverse().find((s) => s.fecha < hoy && s.fecha >= restarDias(hoy, 28) && new Date(`${s.fecha}T12:00:00Z`).getUTCDay() === dia) ?? null;
    const hechasHoy = sesiones.filter((s) => s.fecha === hoy && s.terminada);
    const deLaRutina = activa?.dias[dia];
    const prevista = activa ? (deLaRutina && !deLaRutina.descanso && deLaRutina.ejercicios.length ? deLaRutina.ejercicios.map((e) => e.ejercicio) : null) : (referencia?.bloques.flatMap((b) => (b.ejercicio ? [b.ejercicio] : [])) ?? null);
    const idsDeHoy = hechasHoy.length ? hechasHoy.flatMap((s) => s.bloques.flatMap((b) => (b.ejercicio ? [b.ejercicio] : []))) : prevista;
    const musculosDeHoy: string[] = [...new Set((idsDeHoy ?? []).flatMap((id): readonly string[] => CAT[id]?.principal ?? (GRUPO_A_MUSCULO[grupoDePropio[id] ?? ''] ? [GRUPO_A_MUSCULO[grupoDePropio[id]]] : [])))];

    const pesos: Record<string, number> = {};
    for (const s of sesiones) for (const b of s.bloques) if (b.ejercicio) pesos[b.ejercicio] = Math.max(0, ...(b.pesos ?? []).map((x) => x ?? 0));

    const noche = (mossHoy.data as { noche?: { dormido?: number | null; necesidad?: number | null; deuda_palabra?: EntradaDeHoy['deuda'] } | null } | null)?.noche;
    type Macros = { kcal?: number; proteina?: number; carbohidratos?: number; grasas?: number };
    const comidaDeAyer = (mossAyer.data as { comida?: { total?: Macros; meta?: Macros | null } } | null)?.comida;
    const t = comidaDeAyer?.total;
    const m = comidaDeAyer?.meta;
    const sugerencias = sugerenciasDeHoy({
      sesion: idsDeHoy ? { musculos: musculosDeHoy, minutos: (hechasHoy.length ? hechasHoy.reduce((t, s) => t + (s.minutos ?? 0), 0) : referencia?.minutos) || 60, hecha: hechasHoy.length > 0 } : null,
      sinRecuperar: musculosDeHoy.filter((m) => (musculos.get(m)?.vuelveEn ?? 0) > 0),
      objetivo: 'musculo',
      // Moss no sube a qué hora te despertaste: solo cuenta lo dormido.
      noche: typeof noche?.dormido === 'number' ? { dormido: noche.dormido, despertoAntes: null } : null,
      deuda: noche?.deuda_palabra ?? null,
      // Lo que Moss calculó para esa noche; sin ella, lo de fábrica de Moss para un adulto (8 h).
      necesidad: noche?.necesidad ?? 480,
      // La hora de acostarse es de Moss (su periodo de melatonina) y no la sube: sin ella, el texto no la dice.
      acostarse: null,
      ayer: m && (t?.kcal ?? 0) > 0
        ? {
          kcal: t?.kcal ?? 0, proteina: t?.proteina ?? 0, carbohidratos: t?.carbohidratos ?? 0, grasas: t?.grasas ?? 0,
          metaKcal: m.kcal ?? 0, metaProteina: m.proteina ?? 0, metaCarbohidratos: m.carbohidratos ?? 0, metaGrasas: m.grasas ?? 0,
        }
        : null,
      // Moss no sube si hay un trastorno de la alimentación marcado.
      cuidadoConLaComida: false,
    });
    const filasMetas = metas.error || !Array.isArray(metas.data) ? null : (metas.data as { id: string; ejercicio: string; kilos: number; reps: number }[]);
    const nueva: SeccionMoss = {
      hoy,
      musculos,
      recientes,
      nombres,
      objetivos,
      pesos,
      deHoy: hechasHoy.length ? [] : (prevista ?? []),
      sugerencias,
      nota: activa ? notaDeLaRutina(diasDeLaRutina(activa.dias, CAT, grupoDePropio)) : null,
      nocheCortaHoy: typeof noche?.dormido === 'number' && noche.dormido <= 360,
      anio,
      estancados,
      metas: filasMetas?.map((m) => {
        const t = tendenciaDe(m.ejercicio);
        return { ...m, nombre: nombres[m.ejercicio] ?? m.ejercicio, nivel: t.nivel, proyeccion: proyeccionDeMeta(t, e1rm(m.kilos, m.reps) ?? m.kilos) };
      }) ?? null,
    };
    setDatos(nueva);
    void anotarSeccion(uid, hoy, nueva);
  };
  useEffect(() => {
    if (!activa) return;
    void cargar();
    if (!abierta) return;
    return plataforma.ciclo.alCambiar((visible) => {
      if (visible) void cargar();
    });
  }, [activa, abierta, cargar]);
  return { datos, intentada, recargar: cargar };
}
