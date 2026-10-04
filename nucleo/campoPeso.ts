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
  // LO QUE SE VE, CONFIRMADO TAL CUAL, ES EL MISMO PESO (4/10). En libras el
  // campo muestra redondeado a la media libra, y volver de ahí a kilos da otro
  // número: 60 kg se ve "132,5" y vuelve como 60,1. Entrar y salir sin escribir
  // corría el peso guardado. Se compara contra el número a la vista.
  if (actual !== null && v !== null && v === pesoRedondeado(actual, unidad)) return { cambia: false, kg: actual };
  const enKilos = v === null ? null : pesoValido(aKilos(v, unidad));
  return { cambia: enKilos !== actual, kg: enKilos };
}

/**
 * SI HAY QUE AVISAR AL SALIR DEL CAMPO. Que el número cambie, obvio. Y también
 * que la persona haya TECLEADO el mismo que ya estaba: el peso puede ser una
 * propuesta de la app (`pesoPropuesto` en `bloques.ts`), y escribirlo a mano
 * lo vuelve suyo. Sin esto, reescribir "60" sobre un 60 propuesto no llegaba a
 * nadie, y el próximo cambio de modo se lo llevaba puesto.
 *
 * Entrar al campo y salir sin tocar nada NO avisa: eso no es escribir.
 */
export function hayQueAvisar(r: { cambia: boolean; kg: number | null }, tecleo: boolean): boolean {
  return r.cambia || (tecleo && r.kg !== null);
}

/** Un toque en + o −: el disco chico. Sin peso no hace nada (`undefined`). */
export function pasoDelCampo(kg: number | null | undefined, unidad: Unidad, signo: 1 | -1): number | null | undefined {
  if (!kg) return undefined;
  const nuevo = Math.max(0, pesoRedondeado(kg, unidad) + signo * pasoDePeso(unidad));
  return nuevo === 0 ? null : pesoValido(aKilos(nuevo, unidad));
}
