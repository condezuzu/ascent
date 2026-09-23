import { eventos } from '@compartido/eventos';
import type { Pestana } from '@nucleo/recorrido';

/**
 * PASAR A OTRA PESTAÑA desde adentro de una pantalla: el "ir a Ajustes" de un
 * texto. En la web es un enlace; acá las pestañas son un `useState` de
 * `Pestanas` (no hay router), y una pantalla no lo ve. Va por el bus de avisos
 * y `Pestanas` escucha.
 *
 * Vive aparte y no en `Pestanas.tsx` para que una pantalla pueda pedirlo sin
 * importar el archivo que la importa a ella.
 */
export const IR_A_PESTANA = 'ascent:ir-a-pestana';

// EL TIPO VIVE EN `nucleo/` DESDE EL 24/9, con el recorrido: esa lista nombra
// las mismas cinco pantallas y tiene que nombrarlas igual. Estaba escrito acá
// cuando era el único lugar que las conocía. Se reexporta para no tocar a los
// once archivos que ya lo importaban de este.
export type { Pestana } from '@nucleo/recorrido';

export function irAPestana(p: Pestana) {
  eventos.emitir(IR_A_PESTANA, p);
}
