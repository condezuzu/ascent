export type Unidad = 'kg' | 'lb';

const LIBRAS_POR_KILO = 2.2046226218;

/**
 * El peso SIEMPRE se guarda en kilos. La unidad es de presentación y nada
 * más: si se guardara en libras, cambiar la preferencia reinterpretaría todo
 * el historial y la tendencia daría un salto que nunca ocurrió.
 */
export function deKilos(kilos: number, unidad: Unidad): number {
  return unidad === 'lb' ? kilos * LIBRAS_POR_KILO : kilos;
}

export function aKilos(valor: number, unidad: Unidad): number {
  return unidad === 'lb' ? valor / LIBRAS_POR_KILO : valor;
}

/** Los límites de la base (20 a 400 kg) expresados en la unidad del usuario. */
export function limites(unidad: Unidad): { min: number; max: number } {
  return { min: deKilos(20, unidad), max: deKilos(400, unidad) };
}

export function esUnidad(v: unknown): v is Unidad {
  return v === 'kg' || v === 'lb';
}

/**
 * LA MEDIA MÓVIL DE SIETE DÍAS — por FECHA, no por registros.
 *
 * ERA UN BUG, y de los que no se ven mirando el gráfico. La versión anterior
 * promediaba los ÚLTIMOS SIETE REGISTROS: para quien se pesa todos los días
 * eso son siete días, pero para quien se pesa tres veces por semana son dos
 * semanas y media. El rótulo decía "tendencia 7 días" y el número era otro.
 *
 * POR QUÉ SE SUAVIZA. El peso oscila casi un kilo por razones que no tienen
 * nada que ver con entrenar —sal, agua, la hora—, y una línea con esos dientes
 * se lee como progreso o como fracaso según el día que toque mirar.
 *
 * DEVUELVE EL CRUDO TAMBIÉN. La línea se dibuja con el suavizado, que es lo
 * que se puede afirmar; el número que se muestra al tocar un día es el CRUDO,
 * que es lo que esa persona pesó. Mostrar el suavizado ahí sería inventar un
 * número que nunca estuvo en la balanza — el mismo error por el que esta
 * pantalla ya borró una vez el mínimo y el máximo.
 */
export type PesoDia = { fecha: string; valor: number; suave: number };

export function suavizarPorFecha(
  pesos: { fecha: string; valor: number }[],
  dias = 7
): PesoDia[] {
  const ms = (iso: string) => new Date(iso + 'T00:00:00').getTime();
  const ventana = (dias - 1) * 24 * 3600 * 1000;
  return pesos.map((p, i) => {
    const desde = ms(p.fecha) - ventana;
    let suma = 0;
    let n = 0;
    // Hacia atrás desde el propio punto: la ventana es [fecha-6, fecha], o
    // sea que un punto nunca se promedia con datos que todavía no existían.
    for (let j = i; j >= 0; j--) {
      if (ms(pesos[j].fecha) < desde) break;
      suma += pesos[j].valor;
      n++;
    }
    return { fecha: p.fecha, valor: p.valor, suave: suma / n };
  });
}

/** Los últimos N días de una serie ya ordenada. `null` = todo. */
export function ultimosDias<T extends { fecha: string }>(
  serie: T[],
  dias: number | null
): T[] {
  if (dias === null || serie.length === 0) return serie;
  const fin = new Date(serie[serie.length - 1].fecha + 'T00:00:00').getTime();
  const desde = fin - (dias - 1) * 24 * 3600 * 1000;
  return serie.filter((p) => new Date(p.fecha + 'T00:00:00').getTime() >= desde);
}
