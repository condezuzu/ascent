import { aKilos, pasoDePeso, pesoCorto, pesoRedondeado, type Unidad } from './peso.ts';
import { pesoValido } from './bloques.ts';

/**
 * LO QUE HACE EL CAMPO DE PESO, sin la pantalla. Lo usan las dos apps
 * (`src/components/CampoPeso.tsx` y `movil/src/CampoPeso.tsx`), y vive acá
 * para que se pruebe con node pelado.
 *
 * POR QUÉ SE SACÓ DE LOS COMPONENTES (15/9): el peso pasó a mostrarse con coma
 * ("62,5"), y el campo leía de vuelta el número que mostraba con `Number(...)`.
 * `Number("62,5")` es `NaN`: el + y el − habrían dejado de andar en el
 * gimnasio. Ahora las cuentas usan el número y el texto es solo para leer.
 *
 * NO IMPORTA NADA salvo `peso` y `bloques`.
 */

/** Lo que muestra el campo para un peso guardado. Vacío = sin peso. */
export function textoDelCampo(kg: number | null | undefined, unidad: Unidad): string {
  return kg ? pesoCorto(kg, unidad) : '';
}

/** Deja escribir solo lo que puede ser un número, con punto o con coma. */
export function limpiarTecleo(texto: string): string {
  return texto.replace(/[^0-9.,]/g, '').slice(0, 6);
}

/**
 * AL SALIR DEL CAMPO: qué peso queda. `cambia: false` si es el mismo que ya
 * estaba —con o sin coma, o redondeado igual—, y entonces no se escribe nada.
 */
export function confirmarCampo(
  texto: string,
  kg: number | null | undefined,
  unidad: Unidad
): { cambia: boolean; kg: number | null } {
  const escrito = texto.trim();
  const actual = kg ?? null;
  if (escrito === '') return { cambia: actual !== null, kg: null };
  const v = pesoValido(escrito);
  const enKilos = v === null ? null : pesoValido(aKilos(v, unidad));
  return { cambia: enKilos !== actual, kg: enKilos };
}

/** Un toque en + o −: el disco chico. Sin peso no hace nada (`undefined`). */
export function pasoDelCampo(kg: number | null | undefined, unidad: Unidad, signo: 1 | -1): number | null | undefined {
  if (!kg) return undefined;
  const nuevo = Math.max(0, pesoRedondeado(kg, unidad) + signo * pasoDePeso(unidad));
  return nuevo === 0 ? null : pesoValido(aKilos(nuevo, unidad));
}
