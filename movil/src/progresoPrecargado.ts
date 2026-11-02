import type { Unidad } from '@nucleo/peso';
import type { Progreso } from '@nucleo/progreso';

export type DatosDeProgreso = {
  ejercicio: string;
  nombre: string;
  progreso: Progreso;
  unidad: Unidad;
  rango: number;
  planeta: string | null;
};

/**
 * LO QUE STATS YA TIENE, para que la pantalla abra dibujada y no con una rueda mientras entra
 * deslizando. Si no hay nada (se abrió directo), la pantalla lo pide sola.
 */
let dejados: DatosDeProgreso | null = null;

export function dejarProgreso(datos: DatosDeProgreso): void {
  dejados = datos;
}

export function tomarProgreso(ejercicio: string): DatosDeProgreso | null {
  return dejados?.ejercicio === ejercicio ? dejados : null;
}
