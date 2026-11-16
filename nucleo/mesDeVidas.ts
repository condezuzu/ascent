/**
 * EL MES DE LAS VIDAS (12/11, sección 22 de la galería, variante B): el mes en un cuadrado, de lunes a
 * domingo, con qué días fuiste, cuáles descansaste, cuáles cubrió una vida y cuáles no fuiste. Reemplaza la
 * demostración de las vidas en Stats (la racha repetida, el número de días y una semana de ejemplo).
 *
 * Puro: se prueba con node pelado.
 */

export type DiaDelMes = 'fui' | 'descanso' | 'vida' | 'no' | 'hoy' | 'futuro';
export type CeldaDelMes = { fecha: string; dia: number; que: DiaDelMes } | null;

/** Las celdas del mes de `hoy`, de lunes a domingo; `null` son los huecos antes del día 1. */
export function mesDeVidas(hoy: string, fui: Set<string>, descansos: Set<string>, vidas: Set<string>): CeldaDelMes[] {
  const [y, m] = hoy.split('-').map(Number);
  const primero = new Date(Date.UTC(y, m - 1, 1));
  const dias = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const antes = (primero.getUTCDay() + 6) % 7;
  const celdas: CeldaDelMes[] = Array.from({ length: antes }, () => null);
  for (let d = 1; d <= dias; d++) {
    const fecha = `${hoy.slice(0, 8)}${String(d).padStart(2, '0')}`;
    // Lo hecho manda: un día registrado es «fui» aunque hoy todavía no termine.
    const que: DiaDelMes = fui.has(fecha)
      ? 'fui'
      : vidas.has(fecha)
        ? 'vida'
        : descansos.has(fecha)
          ? 'descanso'
          : fecha === hoy
            ? 'hoy'
            : fecha > hoy
              ? 'futuro'
              : 'no';
    celdas.push({ fecha, dia: d, que });
  }
  return celdas;
}

/** Las vidas usadas en el mes de `hoy`, en orden. */
export function vidasDelMes(hoy: string, vidas: Iterable<string>): string[] {
  return [...vidas].filter((f) => f.slice(0, 7) === hoy.slice(0, 7) && f <= hoy).sort();
}
