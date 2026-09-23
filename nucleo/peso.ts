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

/**
 * EL PESO DE UNA SERIE COMO NÚMERO, en la unidad de la persona y redondeado
 * como son los discos: libras al medio (en libras nadie carga 137,21) y kilos
 * a la centésima (61,25 existe).
 *
 * Es el que se usa PARA HACER CUENTAS —el + y el − del campo—. Para mostrar,
 * `pesoCorto`: con coma, un texto así no se puede volver a pasar por `Number`.
 */
export function pesoRedondeado(kg: number, unidad: Unidad): number {
  const v = deKilos(kg, unidad);
  return unidad === 'lb' ? Math.round(v * 2) / 2 : Math.round(v * 100) / 100;
}

/**
 * UN NÚMERO CON COMA DECIMAL, como se escribe en Uruguay: 62,5 y no 62.5. Sin
 * separador de miles a propósito: un peso no llega a mil, y "1.000" se leería
 * como uno.
 */
export function conComa(n: number | string): string {
  return String(n).replace('.', ',');
}

/** El peso de UNA SERIE para mostrar, sin ceros de más: 60, 62,5, 61,25. */
export function pesoCorto(kg: number, unidad: Unidad): string {
  return conComa(pesoRedondeado(kg, unidad));
}

/** Lo que suma o resta un toque en el campo de peso: el disco chico de cada lado. */
export function pasoDePeso(unidad: Unidad): number {
  return unidad === 'lb' ? 5 : 2.5;
}

export function esUnidad(v: unknown): v is Unidad {
  return v === 'kg' || v === 'lb';
}

/**
 * LA CUENTA DEL GRÁFICO SE MUDÓ A `nucleo/tendencia.ts` (23/9), porque dejó de
 * ser del peso: los pasos de Apple Health quieren la misma media móvil, las
 * mismas ventanas y el mismo arrastre. Lo único del peso era la conversión a
 * libras, y eso es lo que queda acá abajo.
 *
 * Se reexporta todo para que nada de lo que ya importaba de `peso.ts` —la web,
 * la nativa y los tests— tuviera que cambiar de línea.
 */
import { trazarSerie, type PuntoDia } from './tendencia.ts';

export {
  suavizarPorFecha,
  ultimosDias,
  trazarSerie,
  puntoMasCercano,
  type PuntoDia,
} from './tendencia.ts';

/** El nombre de siempre para un punto del gráfico del peso. */
export type PesoDia = PuntoDia;

/**
 * EL GRÁFICO DEL PESO: la serie en la unidad elegida y su tendencia.
 *
 * LA CONVERSIÓN VA ANTES DE SUAVIZAR y no después. Da lo mismo porque pasar a
 * libras es multiplicar, pero así el número que se muestra al tocar un día sale
 * de la misma serie que la línea y no de dos caminos distintos.
 */
export function trazarPeso(
  pesos: { fecha: string; valor: number }[],
  unidad: Unidad,
  dias: number | null,
  ancho: number,
  alto: number,
  ventana = 7
) {
  return trazarSerie(
    pesos.map((p) => ({ fecha: p.fecha, valor: deKilos(p.valor, unidad) })),
    dias,
    ancho,
    alto,
    ventana,
    // 0,4 de aire cuando la serie es plana: cuatro décimas de kilo es lo que
    // se mueve una balanza sin que haya pasado nada.
    0.4
  );
}
