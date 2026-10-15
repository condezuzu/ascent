/**
 * LAS RUTINAS GUARDADAS (14/10/2026).
 *
 * Hasta acá la rutina era un subproducto de entrenar: se deducía de las
 * sesiones de las últimas cuatro semanas (`nucleo/rutina.ts`). Ahora es algo
 * propio, que se mira, se edita, se copia y se pega. Una cuenta puede tener
 * VARIAS ("Entrenamiento 1", "Entrenamiento 2"), cada una con su semana entera
 * —días de descanso incluidos—, y UNA activa.
 *
 * La semana es una lista de 7 días, en el orden de `Date.getDay()`: el 0 es el
 * domingo. Lo que se muestra va de lunes a domingo (`ORDEN_SEMANA`).
 *
 * NUNCA PESOS: un día de rutina dice qué ejercicios y cuántas series (o
 * cuántos minutos, si el ejercicio se mide en tiempo). El peso de cada uno sale
 * de la última vez, como siempre.
 *
 * NO IMPORTA NADA del teléfono: se prueba con node pelado.
 */
import type { DiaDeRutina } from './rutina.ts';
import { T } from './textos.ts';

export type EjercicioDelDia = { ejercicio: string; series: number; minutos?: number };
export type DiaDeSemana = { descanso: boolean; ejercicios: EjercicioDelDia[] };
export type Rutina = { id: string; nombre: string; activa: boolean; dias: DiaDeSemana[] };

/** Lunes primero: como se lee una semana de gimnasio. */
export const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0] as const;
/** Los mismos topes que pone la base (`rutina_dias_limpios`). */
export const MAX_EJERCICIOS_POR_DIA = 30;
export const MAX_SERIES = 99;
export const MAX_MINUTOS = 600;
export const MAX_RUTINAS = 10;

export function semanaVacia(): DiaDeSemana[] {
  return Array.from({ length: 7 }, () => ({ descanso: false, ejercicios: [] }));
}

// Solo un número es un número: "3" como texto vale 0, igual que en la base.
const entero = (v: unknown, tope: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(tope, Math.round(v))) : 0);

/**
 * Lo que llega de la base o del teléfono, con la forma que tiene que tener.
 * Basura → semana vacía. LAS MISMAS REGLAS que `rutina_dias_limpios` en la base:
 * `test:db` les pasa los mismos datos a las dos. Un día de descanso no tiene ejercicios.
 */
export function diasLimpios(crudo: unknown): DiaDeSemana[] {
  const lista = Array.isArray(crudo) ? crudo : [];
  return Array.from({ length: 7 }, (_, i) => {
    const d = lista[i] as { descanso?: unknown; ejercicios?: unknown } | null | undefined;
    const ejercicios = (Array.isArray(d?.ejercicios) ? d.ejercicios : [])
      .slice(0, MAX_EJERCICIOS_POR_DIA)
      .filter((e): e is { ejercicio: string; series?: unknown; minutos?: unknown } => !!e && typeof e === 'object' && !Array.isArray(e) && typeof (e as { ejercicio?: unknown }).ejercicio === 'string' && (e as { ejercicio: string }).ejercicio !== '')
      .map((e) => {
        const x: EjercicioDelDia = { ejercicio: e.ejercicio.slice(0, 80), series: entero(e.series, MAX_SERIES) };
        if (typeof e.minutos === 'number') x.minutos = entero(e.minutos, MAX_MINUTOS);
        return x;
      });
    return d?.descanso === true ? { descanso: true, ejercicios: [] } : { descanso: false, ejercicios };
  });
}

/** La semana deducida del historial (solo trae los días que tienen sesiones), como semana entera. */
export function semanaDeLaDeducida(dias: DiaDeRutina[]): DiaDeSemana[] {
  const s = semanaVacia();
  for (const d of dias)
    if (d.dia >= 0 && d.dia <= 6)
      s[d.dia] = { descanso: false, ejercicios: d.ejercicios.map((e) => (e.minutos ? { ejercicio: e.ejercicio, series: e.series, minutos: e.minutos } : { ejercicio: e.ejercicio, series: e.series })) };
  return s;
}

export function hayAlgo(dias: DiaDeSemana[]): boolean {
  return dias.some((d) => d.descanso || d.ejercicios.length > 0);
}

/** "a", "a y b", "a, b y c" (o "a and b" en inglés). */
export function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(', ')} ${T.rutina.y} ${partes[partes.length - 1]}`;
}

/**
 * QUÉ SE ENTRENA ESE DÍA, en una línea: los grupos de sus ejercicios, en el
 * orden en que aparecen y sin repetir. `''` si no hay nada; `descanso` si es
 * un día de descanso. El nombre del día lo pone quien lo dibuja.
 */
export function tituloDelDia(dia: DiaDeSemana, grupoDe: (ejercicio: string) => string | null | undefined, descanso: string): string {
  if (dia.descanso) return descanso;
  const grupos: string[] = [];
  for (const e of dia.ejercicios) {
    const g = grupoDe(e.ejercicio);
    if (!g) continue;
    // El músculo en el idioma de la app (15/10): en inglés salía "Monday — pecho".
    const nombre = T.rutina.musculos[g] ?? g;
    if (!grupos.includes(nombre)) grupos.push(nombre);
  }
  const t = enumerar(grupos);
  return t ? t[0].toUpperCase() + t.slice(1) : '';
}

/** Los ejercicios de hoy en la rutina activa, para sembrar la sesión. Vacío = no hay nada que proponer. */
export function ejerciciosDeHoy(rutina: Pick<Rutina, 'dias'> | null | undefined, diaDeLaSemana: number): string[] {
  const d = rutina?.dias?.[diaDeLaSemana];
  if (!d || d.descanso) return [];
  const vistos = new Set<string>();
  return d.ejercicios.map((e) => e.ejercicio).filter((e) => (vistos.has(e) ? false : (vistos.add(e), true)));
}

// ── EDITAR: cada función devuelve una semana NUEVA, sin tocar la que recibe ──

const conDia = (dias: DiaDeSemana[], i: number, cambio: (d: DiaDeSemana) => DiaDeSemana) =>
  dias.map((d, j) => (j === i ? cambio({ descanso: d.descanso, ejercicios: d.ejercicios.map((e) => ({ ...e })) }) : d));

export function agregarEjercicio(dias: DiaDeSemana[], dia: number, ejercicio: string, comoTiempo = false): DiaDeSemana[] {
  return conDia(dias, dia, (d) =>
    d.ejercicios.length >= MAX_EJERCICIOS_POR_DIA
      ? d
      : { descanso: false, ejercicios: [...d.ejercicios, comoTiempo ? { ejercicio, series: 0, minutos: 20 } : { ejercicio, series: 3 }] }
  );
}

export function quitarEjercicio(dias: DiaDeSemana[], dia: number, indice: number): DiaDeSemana[] {
  return conDia(dias, dia, (d) => ({ ...d, ejercicios: d.ejercicios.filter((_, i) => i !== indice) }));
}

/** Series (o minutos, si el ejercicio se mide en tiempo) más o menos. Nunca baja de 1. */
export function cambiarCantidad(dias: DiaDeSemana[], dia: number, indice: number, signo: 1 | -1): DiaDeSemana[] {
  return conDia(dias, dia, (d) => ({
    ...d,
    ejercicios: d.ejercicios.map((e, i) => {
      if (i !== indice) return e;
      if (e.minutos !== undefined) return { ...e, minutos: Math.max(1, Math.min(MAX_MINUTOS, e.minutos + signo * 5)) };
      return { ...e, series: Math.max(1, Math.min(MAX_SERIES, e.series + signo)) };
    }),
  }));
}

export function subirEjercicio(dias: DiaDeSemana[], dia: number, indice: number): DiaDeSemana[] {
  if (indice <= 0) return dias;
  return conDia(dias, dia, (d) => {
    const e = [...d.ejercicios];
    [e[indice - 1], e[indice]] = [e[indice], e[indice - 1]];
    return { ...d, ejercicios: e };
  });
}

/** Arrastrar (15/10): el de `desde` pasa a quedar en `hasta` y los del medio se corren uno. */
export function moverEjercicio(dias: DiaDeSemana[], dia: number, desde: number, hasta: number): DiaDeSemana[] {
  const n = dias[dia]?.ejercicios.length ?? 0;
  if (desde === hasta || desde < 0 || desde >= n) return dias;
  return conDia(dias, dia, (d) => {
    const e = [...d.ejercicios];
    const [movido] = e.splice(desde, 1);
    e.splice(Math.max(0, Math.min(hasta, e.length)), 0, movido);
    return { ...d, ejercicios: e };
  });
}

/** Día de descanso: prenderlo vacía el día (un descanso no tiene ejercicios); apagarlo lo deja vacío para cargar. */
export function marcarDescanso(dias: DiaDeSemana[], dia: number, descanso: boolean): DiaDeSemana[] {
  return conDia(dias, dia, () => ({ descanso, ejercicios: [] }));
}

/**
 * COPIAR UN DÍA A OTRO. Si el destino ya tiene ejercicios se elige qué hacer:
 * `reemplazar` (queda igual al de origen) o `agregar` (se suman al final, sin
 * repetir los que ya estaban). Nunca se pisa callado: quien llama pregunta
 * antes (`hayQuePreguntarAlCopiar`).
 */
export function copiarDia(dias: DiaDeSemana[], desde: number, hasta: number, modo: 'reemplazar' | 'agregar'): DiaDeSemana[] {
  if (desde === hasta) return dias;
  const origen = dias[desde];
  return conDia(dias, hasta, (d) => {
    if (modo === 'reemplazar' || d.descanso) return { descanso: origen.descanso, ejercicios: origen.ejercicios.map((e) => ({ ...e })) };
    const ya = new Set(d.ejercicios.map((e) => e.ejercicio));
    const suma = origen.ejercicios.filter((e) => !ya.has(e.ejercicio)).map((e) => ({ ...e }));
    return { descanso: false, ejercicios: [...d.ejercicios, ...suma].slice(0, MAX_EJERCICIOS_POR_DIA) };
  });
}

export function hayQuePreguntarAlCopiar(dias: DiaDeSemana[], hasta: number): boolean {
  return dias[hasta].ejercicios.length > 0;
}

/** "Entrenamiento N" con el primer N libre. */
export function nombreNuevo(existentes: string[], base: string): string {
  for (let n = 1; ; n++) {
    const nombre = `${base} ${n}`;
    if (!existentes.includes(nombre)) return nombre;
  }
}
