import { useEffect } from 'react';
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

/**
 * LA PESTAÑA QUE PASÓ A ESTAR ACTIVA.
 *
 * EXISTE POR EL ARREGLO DEL TITILEO (23/9). Antes, cambiar de pestaña
 * DESMONTABA la anterior y montaba la nueva: feo —ese remonte era el
 * parpadeo— pero tenía un efecto de regalo, que era que cada pantalla
 * volvía a pedir sus datos al abrirse. Ahora las pestañas se quedan
 * montadas, así que ese regalo hay que pagarlo a mano: sin esto, sumás una
 * foto en Inicio, vas al Álbum, y no está.
 */
export const PESTANA_ACTIVA = 'ascent:pestana-activa';

/**
 * Volver a pedir los datos cada vez que ESTA pestaña pasa a estar activa.
 *
 * No corre al montarse: la pantalla ya pide sus datos al abrirse por
 * primera vez, y pedirlos dos veces seguidas es un viaje de red al pedo en
 * el momento en que más se nota.
 */
export function useRecargarAlVolver(mia: Pestana, recargar: () => void) {
  useEffect(
    () =>
      eventos.escuchar(PESTANA_ACTIVA, (cual) => {
        if (cual === mia) recargar();
      }),
    [mia, recargar]
  );
}
