import { deISO, MESES } from './fechas.ts';
import { T } from './textos.ts';

/**
 * LO QUE COMPARTEN LOS GRÁFICOS DE LÍNEA DE LA NATIVA (1/11): el peso, los pasos y el progreso
 * de un ejercicio. El tiempo va a escala: sin eso, tres semanas sin pesarse ocupan lo mismo que
 * un día, y un rótulo de fecha abajo mentiría.
 */

export type Punto = { x: number; y: number };
export type MarcaDeTiempo = { x: number; texto: string };

export function diasEntre(a: string, b: string): number {
  // Redondeado: un cambio de hora hace que dos medianoches disten 23 o 25 horas.
  return Math.round((deISO(b).getTime() - deISO(a).getTime()) / 86400000);
}

const f = (n: number) => n.toFixed(1);

export function lineaRecta(puntos: Punto[]): string {
  return puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${f(p.x)},${f(p.y)}`).join(' ');
}

/**
 * LA CURVA DE UNA TENDENCIA: cúbica monótona (Fritsch-Carlson). Pasa por cada punto y nunca se
 * sale de lo que hay entre dos: una curva común se pasaría de largo en cada giro y dibujaría
 * un peso que nadie pesó.
 */
export function curvaSuave(puntos: Punto[]): string {
  const n = puntos.length;
  if (n < 3) return lineaRecta(puntos);
  const dx = puntos.slice(1).map((p, i) => p.x - puntos[i].x);
  const pendiente = puntos.slice(1).map((p, i) => (dx[i] > 0 ? (p.y - puntos[i].y) / dx[i] : 0));
  const tangente = puntos.map((_, i) => {
    if (i === 0) return pendiente[0];
    if (i === n - 1) return pendiente[n - 2];
    const a = pendiente[i - 1];
    const b = pendiente[i];
    if (a * b <= 0) return 0;
    return (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / a + (dx[i] + 2 * dx[i - 1]) / b);
  });
  let d = `M${f(puntos[0].x)},${f(puntos[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const t = dx[i] / 3;
    d += ` C${f(puntos[i].x + t)},${f(puntos[i].y + tangente[i] * t)} ${f(puntos[i + 1].x - t)},${f(puntos[i + 1].y - tangente[i + 1] * t)} ${f(puntos[i + 1].x)},${f(puntos[i + 1].y)}`;
  }
  return d;
}

/** Lo que mide el trazo, para dibujarlo de a poco: un guion más corto que la línea se repetiría. */
export function largoDe(puntos: Punto[]): number {
  return puntos.slice(1).reduce((t, p, i) => t + Math.hypot(p.x - puntos[i].x, p.y - puntos[i].y), 0);
}

export function masCercano(xs: number[], x: number): number {
  let mejor = 0;
  xs.forEach((v, i) => {
    if (Math.abs(v - x) < Math.abs(xs[mejor] - x)) mejor = i;
  });
  return mejor;
}

/** VoiceOver recorre los puntos de a uno. Sin ninguno elegido, arranca en el último: lo más nuevo. */
export function pasoDeVoiceOver(cuantos: number, elegido: number | null, adelante: boolean): number {
  const desde = elegido ?? cuantos - 1;
  return Math.max(0, Math.min(cuantos - 1, desde + (adelante ? 1 : -1)));
}

const mesCorto = (m: number) => MESES[m].slice(0, 3);

/** «12 oct», para rotular un eje. */
export function diaYMes(iso: string): string {
  const d = deISO(iso);
  return T.fechas.diaYMes(d.getDate(), mesCorto(d.getMonth()));
}

/**
 * LOS RÓTULOS DE ABAJO. Hasta mes y medio, días; después, el primero de cada mes. Con más de
 * un año no entran todos: se saltean, y enero dice el año.
 */
export function marcasDeTiempo(
  desde: string,
  hasta: string,
  xDe: (fecha: string) => number,
  ancho: number
): MarcaDeTiempo[] {
  const total = diasEntre(desde, hasta);
  if (total <= 0) return [];
  const crudas: MarcaDeTiempo[] = [];
  if (total <= 45) {
    const paso = Math.max(7, Math.ceil(total / 4));
    const d = deISO(desde);
    for (let n = 0; n <= total; n += paso) {
      const dia = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
      const iso = aIso(dia);
      crudas.push({ x: xDe(iso), texto: diaYMes(iso) });
    }
  } else {
    const inicio = deISO(desde);
    const paso = Math.max(1, Math.ceil(total / 30 / 7));
    const m = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 1);
    // El primer mes de la grilla cae en un múltiplo del paso: enero queda adentro cuando se saltean.
    while (m.getMonth() % paso !== 0) m.setMonth(m.getMonth() + 1);
    for (; aIso(m) <= hasta; m.setMonth(m.getMonth() + paso)) {
      const conAno = m.getMonth() === 0 && total > 300;
      crudas.push({ x: xDe(aIso(m)), texto: conAno ? String(m.getFullYear()) : mesCorto(m.getMonth()) });
    }
  }
  // Ni contra el borde ni encimados.
  const salida: MarcaDeTiempo[] = [];
  for (const c of crudas) {
    if (c.x < 14 || c.x > ancho - 14) continue;
    if (salida.length && c.x - salida[salida.length - 1].x < 40) continue;
    salida.push(c);
  }
  return salida;
}

function aIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * LOS NÚMEROS DE LA ESCALA: redondos, y adentro de lo que se ve. Son una regla, no datos: nadie
 * los lee como un peso que pesó, que era el error de mostrar los bordes del dibujo.
 */
export function marcasDeEscala(min: number, max: number, cuantas = 3): number[] {
  if (!(max > min)) return [];
  const bruto = (max - min) / cuantas;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((k) => k * potencia).find((p) => p >= bruto) ?? 10 * potencia;
  const salida: number[] = [];
  for (let v = Math.ceil(min / paso) * paso; v <= max; v += paso) salida.push(Math.round(v * 1000) / 1000);
  return salida;
}
