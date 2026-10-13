import { numeroDeRango, planetaDeDia } from '@nucleo/reglas';
import { RANGOS } from '@nucleo/rangos';
import { paletaDe, type Paleta } from '@nucleo/paletas';

export type Esquema = 53 | 54;

/**
 * LA PROPUESTA: el rango de alguien sale de UN dato —su racha— y de UNA regla,
 * la del cliente. Número, nombre, planeta y paleta se piden juntos, así que no
 * pueden contradecirse, esté la base en el esquema que esté.
 *
 * `profiles.rango_actual` deja de leerse para dibujar: es la copia de la base,
 * y la base puede ir una migración atrás (o adelante) del cliente.
 */
export type RangoVisto = { n: number; nombre: string; planeta: string | null; paleta: Paleta };

export function rangoVisto(racha: number): RangoVisto {
  const n = numeroDeRango(racha);
  const planeta = n === 4 ? planetaDeDia(racha) : null;
  return { n, nombre: RANGOS[n - 1].nombre, planeta, paleta: paletaDe(n, planeta) };
}

/** Lo que la base GUARDA en `rango_actual`, según el esquema en que esté producción. */
export function guardadoEnLaBase(racha: number, esquema: Esquema): number {
  // El 53 es `least(8, greatest(0, r) / 10 + 1)`: ocho rangos de diez días.
  if (esquema === 53) return Math.min(8, Math.floor(Math.max(0, racha) / 10) + 1);
  return numeroDeRango(racha);
}

/**
 * LO QUE HACE LA APP HOY: el fondo, la insignia y la paleta salen del número
 * guardado; el nombre (Stats → Rangos) y el planeta los calcula el cliente con
 * la racha. Dos cuentas para el mismo dato.
 */
export function comoHoy(racha: number, esquema: Esquema) {
  const dibuja = guardadoEnLaBase(racha, esquema);
  const planeta = planetaDeDia(racha);
  return {
    dice: RANGOS[numeroDeRango(racha) - 1].nombre,
    dibuja,
    // Sin nombre = un número que este cliente ya no conoce (el 8 de la base vieja).
    nombreDeLoQueDibuja: RANGOS[dibuja - 1]?.nombre ?? null,
    planeta,
    paleta: paletaDe(dibuja, planeta),
    coinciden: dibuja === numeroDeRango(racha),
  };
}

export type Tramo = { desde: number; hasta: number; dice: string; dibuja: string | null; coinciden: boolean };

/** Los días de racha agrupados por lo que la app de hoy dice y dibuja. */
export function tramos(esquema: Esquema, tope: number): Tramo[] {
  const lista: Tramo[] = [];
  for (let r = 0; r <= tope; r++) {
    const h = comoHoy(r, esquema);
    const ultimo = lista[lista.length - 1];
    if (ultimo && ultimo.dice === h.dice && ultimo.dibuja === h.nombreDeLoQueDibuja) ultimo.hasta = r;
    else lista.push({ desde: r, hasta: r, dice: h.dice, dibuja: h.nombreDeLoQueDibuja, coinciden: h.coinciden });
  }
  return lista;
}
