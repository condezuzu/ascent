import { eventos } from '@compartido/eventos';

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
export type Pestana = 'inicio' | 'ranking' | 'album' | 'stats' | 'ajustes';

export function irAPestana(p: Pestana) {
  eventos.emitir(IR_A_PESTANA, p);
}
