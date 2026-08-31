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
