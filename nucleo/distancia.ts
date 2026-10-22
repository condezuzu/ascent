import { conComa, type Unidad } from './peso.ts';
import { distanciaValida } from './bloques.ts';

/**
 * LA DISTANCIA DEL CARDIO (21/10). Se guarda SIEMPRE en kilómetros, como el peso en kilos: la
 * unidad es de presentación. Quien pesa en libras la ve en millas.
 */
export type UnidadDistancia = 'km' | 'mi';

const KM_POR_MILLA = 1.609344;

export function unidadDeDistancia(unidadPeso: Unidad): UnidadDistancia {
  return unidadPeso === 'lb' ? 'mi' : 'km';
}

export function deKm(km: number, u: UnidadDistancia): number {
  return u === 'mi' ? km / KM_POR_MILLA : km;
}

/** Lo escrito en la unidad de la persona, en kilómetros válidos (o `null`). Lee punto y coma. */
export function kmEscritos(texto: string, u: UnidadDistancia): number | null {
  const v = distanciaValida(texto.trim());
  return v === null ? null : distanciaValida(u === 'mi' ? v * KM_POR_MILLA : v);
}

/** Para mostrar: con dos decimales como mucho y sin ceros de más, con el separador del idioma. */
export function distanciaCorta(km: number, u: UnidadDistancia): string {
  return conComa(String(Math.round(deKm(km, u) * 100) / 100));
}
