import { kilosMovidos, llevaNumero, type Carga } from './carga.ts';
import { restarDias } from './fechas.ts';
import { diaYMes, diasEntre, largoDe, lineaRecta, marcasDeTiempo, type MarcaDeTiempo } from './grafico.ts';
import { leerBloques, type MarcaParaMaximo, type SesionConBloques } from './volumen.ts';

/**
 * EL PROGRESO DE UN EJERCICIO (propuesta 13 de la galería, aprobada el 1/11).
 *
 * Cada punto es un día: su serie más pesada. Se compara por kilos movidos, como la lista de
 * máximos, y se muestra el número que se agarró: 18 por mancuerna son 36. Una sesión sin peso no
 * dibuja nada, porque no es cero. Una marca anotada a mano no es una sesión: va suelta, sin
 * tocar la línea. Sin ella, la lista diría 120 y el gráfico 110.
 */
export type PuntoDeProgreso = {
  fecha: string;
  peso: number;
  carga: Carga;
  kilos: number;
  reps?: number;
  tipo: 'sesion' | 'marca';
};

export type Progreso = { sesiones: PuntoDeProgreso[]; marcas: PuntoDeProgreso[] };

const porFecha = (a: PuntoDeProgreso, b: PuntoDeProgreso) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0);

export function progresoPorEjercicio(sesiones: SesionConBloques[], marcas: MarcaParaMaximo[]): Map<string, Progreso> {
  const dias = new Map<string, Map<string, PuntoDeProgreso>>();
  for (const s of sesiones) {
    for (const b of leerBloques(s.bloques)) {
      if (!llevaNumero(b.carga)) continue;
      b.pesos.forEach((peso, j) => {
        if (peso === null) return;
        const kilos = kilosMovidos(peso, b.carga);
        const suyos = dias.get(b.ejercicio) ?? new Map<string, PuntoDeProgreso>();
        dias.set(b.ejercicio, suyos);
        const actual = suyos.get(s.fecha);
        const reps = b.reps[j];
        if (!actual || kilos > actual.kilos) {
          suyos.set(s.fecha, { fecha: s.fecha, peso, carga: b.carga, kilos, tipo: 'sesion', ...(reps !== null && { reps }) });
        } else if (kilos === actual.kilos && reps !== null && reps > (actual.reps ?? 0)) {
          actual.reps = reps;
        }
      });
    }
  }

  const sueltas = new Map<string, Map<string, PuntoDeProgreso>>();
  for (const m of marcas) {
    const peso = Number(m.peso);
    if (!Number.isFinite(peso) || peso <= 0 || typeof m.fecha !== 'string') continue;
    // «¿La guardo como marca?» la guarda con el día de la sesión: ese punto ya la está diciendo.
    const sesion = dias.get(m.ejercicio)?.get(m.fecha);
    if (sesion && sesion.kilos >= peso) continue;
    const suyas = sueltas.get(m.ejercicio) ?? new Map<string, PuntoDeProgreso>();
    sueltas.set(m.ejercicio, suyas);
    const actual = suyas.get(m.fecha);
    if (actual && actual.kilos >= peso) continue;
    const reps = Number(m.reps);
    suyas.set(m.fecha, { fecha: m.fecha, peso, carga: 'total', kilos: peso, tipo: 'marca', ...(Number.isInteger(reps) && reps > 0 && { reps }) });
  }

  const salida = new Map<string, Progreso>();
  for (const ejercicio of new Set([...dias.keys(), ...sueltas.keys()])) {
    salida.set(ejercicio, {
      sesiones: [...(dias.get(ejercicio)?.values() ?? [])].sort(porFecha),
      marcas: [...(sueltas.get(ejercicio)?.values() ?? [])].sort(porFecha),
    });
  }
  return salida;
}

export function ventanaDeProgreso(p: Progreso, dias: number | null, hoy: string): Progreso {
  if (dias === null) return p;
  const desde = restarDias(hoy, dias);
  return { sesiones: p.sesiones.filter((s) => s.fecha >= desde), marcas: p.marcas.filter((m) => m.fecha >= desde) };
}

/**
 * LOS RANGOS QUE SE OFRECEN. Con menos de dos sesiones sería una pantalla vacía, y uno que
 * muestra lo mismo que el siguiente es un botón que no hace nada.
 */
export function rangosDeProgreso(p: Progreso, hoy: string, rangos: (number | null)[] = [30, 90, null]): (number | null)[] {
  const cuantos = (d: number | null) => {
    const v = ventanaDeProgreso(p, d, hoy);
    return { sesiones: v.sesiones.length, total: v.sesiones.length + v.marcas.length };
  };
  const salen = rangos.filter((d, i) => {
    const este = cuantos(d);
    if (este.sesiones < 2) return false;
    return i === rangos.length - 1 || este.total !== cuantos(rangos[i + 1]).total;
  });
  return salen.length > 1 ? salen : [];
}

/** La diferencia entre dos puntos: en el número que se agarró, salvo que hayan cambiado de modo. */
export function cambioDeProgreso(a: PuntoDeProgreso, b: PuntoDeProgreso): number {
  return a.carga === b.carga ? b.peso - a.peso : b.kilos - a.kilos;
}

export type PuntoDibujado = PuntoDeProgreso & { x: number; y: number };

export const MARGENES_PROGRESO = { arriba: 30, abajo: 26, izquierda: 8, derecha: 10 };

/**
 * DÓNDE VA CADA COSA. El alto abarca al menos un quinto del peso: si no, 2,5 kg sobre 60
 * parecerían un abismo, y con un solo peso no habría escala.
 */
export function trazarProgreso(p: Progreso, ancho: number, alto: number) {
  const m = MARGENES_PROGRESO;
  const todos = [...p.sesiones, ...p.marcas];
  if (todos.length === 0) return null;
  const fechas = todos.map((t) => t.fecha).sort();
  const desde = fechas[0];
  const hasta = fechas[fechas.length - 1];
  const dias = Math.max(1, diasEntre(desde, hasta));
  const soloUna = desde === hasta;
  const kilos = todos.map((t) => t.kilos);
  const tope = Math.max(...kilos);
  const piso = Math.min(...kilos);
  const falta = Math.max(0, tope * 0.2 - (tope - piso)) / 2;
  const aire = (tope - piso + 2 * falta) * 0.08;
  const min = piso - falta - aire;
  const max = tope + falta + aire;
  const base = alto - m.abajo;
  const xDe = (fecha: string) =>
    soloUna ? m.izquierda + (ancho - m.izquierda - m.derecha) * 0.2 : m.izquierda + (diasEntre(desde, fecha) / dias) * (ancho - m.izquierda - m.derecha);
  const yDe = (k: number) => m.arriba + (1 - (k - min) / (max - min)) * (base - m.arriba);
  const dibujar = (t: PuntoDeProgreso): PuntoDibujado => ({ ...t, x: xDe(t.fecha), y: yDe(t.kilos) });

  const sesiones = p.sesiones.map(dibujar);
  const marcas = p.marcas.map(dibujar);
  const hayLinea = sesiones.length > 1;
  const linea = hayLinea ? lineaRecta(sesiones) : '';
  const area = hayLinea ? `${linea} L${sesiones[sesiones.length - 1].x.toFixed(1)},${base} L${sesiones[0].x.toFixed(1)},${base} Z` : '';
  const primero = dibujar(todos.reduce((a, b) => (b.fecha < a.fecha ? b : a)));
  // Con una sola, lo que va a haber: punteado, como el gráfico del peso sin datos.
  const fantasma = hayLinea
    ? ''
    : `M${(primero.x + 8).toFixed(1)},${primero.y.toFixed(1)} C${(primero.x + 90).toFixed(1)},${(primero.y - 6).toFixed(1)} ${(ancho - 120).toFixed(1)},${m.arriba + 44} ${(ancho - m.derecha).toFixed(1)},${m.arriba + 12}`;
  const record = [...marcas, ...sesiones].find((t) => t.kilos === tope) ?? null;
  const tiempo: MarcaDeTiempo[] = soloUna ? [{ x: primero.x, texto: diaYMes(desde) }] : marcasDeTiempo(desde, hasta, xDe, ancho);

  return {
    sesiones,
    marcas,
    // Para leer con el dedo: en el orden del tiempo, sean sesiones o marcas.
    puntos: [...sesiones, ...marcas].sort((a, b) => a.x - b.x),
    linea,
    area,
    fantasma,
    largo: largoDe(sesiones) * 1.02,
    base,
    record,
    primero: hayLinea && sesiones[0] !== record ? sesiones[0] : null,
    tiempo,
  };
}

/** La línea chiquita de cada fila: solo la forma, cada una con su propia escala. */
export function trazarLineaChiquita(p: Progreso, ancho: number, alto: number, margen = 3) {
  const ses = p.sesiones;
  if (ses.length < 2) return null;
  const kilos = ses.map((s) => s.kilos);
  const min = Math.min(...kilos);
  const max = Math.max(...kilos);
  const total = Math.max(1, diasEntre(ses[0].fecha, ses[ses.length - 1].fecha));
  const puntos = ses.map((s) => ({
    x: margen + (diasEntre(ses[0].fecha, s.fecha) / total) * (ancho - 2 * margen),
    y: alto - margen - ((s.kilos - min) / Math.max(1, max - min)) * (alto - 2 * margen),
  }));
  return { linea: lineaRecta(puntos), fin: puntos[puntos.length - 1] };
}
