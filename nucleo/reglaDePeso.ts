import { deKilos, limites, type Unidad } from './peso.ts';

/**
 * ANOTAR EL PESO CON EL NÚMERO GRANDE, − Y + Y LA REGLA (20/10, la B de la galería).
 * Todo en décimas de la unidad de la persona: un toque mueve una décima, apretado de a
 * una unidad, y la regla corre una décima cada `PX_POR_DECIMA` píxeles.
 */
export const PX_POR_DECIMA = 9;
/** Apretado: espera esto antes de repetir, y después repite cada `REPETIR_MS`. */
export const APRETADO_MS = 450;
export const REPETIR_MS = 160;

const decimas = (x: number) => Math.round(x * 10) / 10;

/** El número que se puede anotar más cerca, dentro de los límites de la base. */
export function pesoAcotado(valor: number, unidad: Unidad): number {
  const { min, max } = limites(unidad);
  // Los límites en libras no caen en décimas: se redondean hacia adentro.
  return decimas(Math.min(Math.floor(max * 10) / 10, Math.max(Math.ceil(min * 10) / 10, valor)));
}

/** Desde dónde arranca: el último peso anotado, o un número redondo si no hay ninguno. */
export function pesoInicial(ultimoEnKilos: number | null, unidad: Unidad): number {
  return pesoAcotado(ultimoEnKilos == null ? (unidad === 'lb' ? 150 : 70) : deKilos(ultimoEnKilos, unidad), unidad);
}

/** Arrastrar la regla a la izquierda sube el número: la regla viene desde la derecha. */
export function pesoArrastrado(desde: number, dx: number, unidad: Unidad): number {
  return pesoAcotado(desde - dx / PX_POR_DECIMA / 10, unidad);
}

export type MarcaDeRegla = { x: number; alto: 'entero' | 'medio' | 'decima'; etiqueta: string | null };

/** Las rayitas que entran en `ancho` píxeles con `valor` en el medio. */
export function marcasDeRegla(valor: number, ancho: number): MarcaDeRegla[] {
  const centro = Math.round(valor * 10);
  const media = Math.ceil(ancho / 2 / PX_POR_DECIMA) + 1;
  const marcas: MarcaDeRegla[] = [];
  for (let d = centro - media; d <= centro + media; d++) {
    const entero = d % 10 === 0;
    marcas.push({
      x: ancho / 2 + (d - valor * 10) * PX_POR_DECIMA,
      alto: entero ? 'entero' : d % 5 === 0 ? 'medio' : 'decima',
      etiqueta: entero ? String(d / 10) : null,
    });
  }
  return marcas;
}
