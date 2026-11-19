// LO QUE MOSS DICE DE HOY, EN ASCENT (19/11). La parte de Moss en Ascent es espejo de la de Ascent en
// Moss: las mismas reglas y en el mismo orden, para que las dos apps digan lo mismo con los mismos datos.
// Las reglas son las de Moss (su sección de Ascent, «Hoy, según el momento»); acá no se inventa ninguna.
//
// Todo en minutos desde la medianoche local y en gramos. NO importa nada, para que test:db lo cargue
// con node pelado.

export type Comida = { min: number; proteina: number; carbos: number; grasas: number };

export type Esperar = 'sinComer' | 'pocosCarbos' | 'grasaCerca' | 'pocaProteina' | 'bienComido' | 'sinAnotar';

/**
 * Qué esperar antes de entrenar, hasta dos, en el orden de Moss. `sesionMin` es la hora de la sesión;
 * si no se sabe, la de ahora. Sin nada anotado hoy, «sinAnotar» y nada más.
 */
export function queEsperar(comidas: Comida[], sesionMin: number, pesoKg: number | null): Esperar[] {
  if (!comidas.length) return ['sinAnotar'];
  const antes = comidas.filter((c) => c.min <= sesionMin);
  const salen: Esperar[] = [];
  const ultima = antes.reduce((m, c) => Math.max(m, c.min), -Infinity);
  if (!antes.length || sesionMin - ultima >= 240) salen.push('sinComer');
  const kg = pesoKg && pesoKg > 0 ? pesoKg : null;
  if (kg && antes.reduce((s, c) => s + c.carbos, 0) < kg) salen.push('pocosCarbos');
  if (antes.filter((c) => sesionMin - c.min <= 120).reduce((s, c) => s + c.grasas, 0) >= 20) salen.push('grasaCerca');
  if (kg && comidas.reduce((s, c) => s + c.proteina, 0) < 0.5 * kg) salen.push('pocaProteina');
  return salen.length ? salen.slice(0, 2) : ['bienComido'];
}

// EL CONTRATO DE MOSS (migración 0015 de Moss, 19/11): lo que devuelven moss_hoy, moss_semanas,
// moss_objetivo y moss_anio con la sesión de Ascent. Sin vínculo, null. Se lee con cuidado: lo que no
// tiene la forma esperada queda en null y ese bloque no se muestra.

export type MossHoy = {
  sinDeficit: boolean;
  noche: { dormido: number; necesidad: number; cara: number | null; deudaPalabra: 'sinDeuda' | 'baja' | 'media' | 'alta' | null } | null;
  energia: 'baja' | 'suficiente' | 'alta' | null;
  comida: { total: Macros; meta: Macros | null; comidas: Comida[] } | null;
};
export type Macros = { kcal: number; proteina: number; carbos: number | null; grasas: number | null };
export type MossSemana = { lunes: string; dormido: number | null; proteinaGKg: number | null; balance: number | null; peso: number | null };
export type MossObjetivo = { objetivo: 'bajar' | 'mantener' | 'subir'; pesoMeta: number | null; peso: number | null };
export type MossAnio = { diasConComida: number; noches: number; pesoInicio: number | null; pesoHoy: number | null };

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** El día de Moss arranca a las 4: antes de esa hora, todavía es ayer. */
export function fechaDeMoss(ahora: Date): string {
  const d = new Date(ahora.getTime() - 4 * 3600_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** La hora local de un momento ISO, en minutos desde la medianoche. */
export function minutosDe(momento: unknown): number | null {
  if (typeof momento !== 'string') return null;
  const d = new Date(momento);
  return Number.isNaN(d.getTime()) ? null : d.getHours() * 60 + d.getMinutes();
}

function macros(v: unknown): Macros | null {
  const m = obj(v);
  const kcal = num(m?.kcal);
  const proteina = num(m?.proteina);
  return m && kcal !== null && proteina !== null ? { kcal, proteina, carbos: num(m.carbohidratos), grasas: num(m.grasas) } : null;
}

export function leerMossHoy(v: unknown): MossHoy | null {
  const d = obj(v);
  if (!d) return null;
  const n = obj(d.noche);
  const dormido = num(n?.dormido);
  const necesidad = num(n?.necesidad);
  const palabra = n?.deuda_palabra;
  const c = obj(d.comida);
  const total = macros(c?.total);
  const comidas: Comida[] = Array.isArray(c?.comidas)
    ? (c.comidas as unknown[]).flatMap((x) => {
        const o = obj(x);
        const min = minutosDe(o?.momento);
        return o && min !== null ? [{ min, proteina: num(o.proteina) ?? 0, carbos: num(o.carbohidratos) ?? 0, grasas: num(o.grasas) ?? 0 }] : [];
      })
    : [];
  const e = d.energia;
  return {
    sinDeficit: d.sin_deficit === true,
    noche: dormido !== null && necesidad !== null && necesidad > 0 ? { dormido, necesidad, cara: num(n?.cara), deudaPalabra: palabra === 'sinDeuda' || palabra === 'baja' || palabra === 'media' || palabra === 'alta' ? palabra : null } : null,
    energia: e === 'baja' || e === 'suficiente' || e === 'alta' ? e : null,
    comida: total ? { total, meta: d.sin_deficit === true ? null : macros(c?.meta), comidas } : null,
  };
}

export function leerMossSemanas(v: unknown): MossSemana[] {
  return Array.isArray(v)
    ? v.flatMap((x) => {
        const o = obj(x);
        return o && typeof o.lunes === 'string' ? [{ lunes: o.lunes, dormido: num(o.dormido), proteinaGKg: num(o.proteina_g_kg), balance: num(o.balance), peso: num(o.peso) }] : [];
      })
    : [];
}

export function leerMossObjetivo(v: unknown): MossObjetivo | null {
  const o = obj(v);
  const t = o?.objetivo;
  return o && (t === 'bajar' || t === 'mantener' || t === 'subir') ? { objetivo: t, pesoMeta: num(o.peso_meta), peso: num(o.peso) } : null;
}

export function leerMossAnio(v: unknown): MossAnio | null {
  const o = obj(v);
  const dias = num(o?.dias_con_comida);
  return o && dias !== null ? { diasConComida: dias, noches: num(o.noches) ?? 0, pesoInicio: num(o.peso_inicio), pesoHoy: num(o.peso_hoy) } : null;
}

/**
 * Qué esperar con lo que Moss comparte hoy. Sin cada comida con su hora (pendiente de la privacidad de
 * Moss), solo queda la regla de la proteína, sobre el total del día.
 */
export function queEsperarHoy(comida: MossHoy['comida'], sesionMin: number, pesoKg: number | null): Esperar[] {
  // Vinculada y sin nada anotado hoy, Moss manda los totales en 0: es que no comió nada anotado, no que comió bien.
  if (!comida || (!comida.comidas.length && comida.total.kcal <= 0)) return ['sinAnotar'];
  if (comida.comidas.length) return queEsperar(comida.comidas, sesionMin, pesoKg);
  return pesoKg && pesoKg > 0 && comida.total.proteina < 0.5 * pesoKg ? ['pocaProteina'] : ['bienComido'];
}
