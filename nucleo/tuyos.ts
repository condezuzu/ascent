// "TUYOS": los ejercicios que esta persona hace de verdad, arriba del árbol.
//
// EL PROBLEMA. Elegir ejercicio son dos toques —zona y músculo— y recién ahí
// la lista. Está bien para explorar cien ejercicios, y está mal para la
// realidad: casi todo el mundo repite entre cinco y diez, y los repite todas
// las semanas. Bajar el mismo árbol cada vez para llegar siempre al mismo
// renglón es pagar el precio de los cien cada vez que se usan los ocho.
//
// LO QUE NO SE TOCA: el resto del árbol queda exactamente igual, en su orden
// de siempre. Esto AGREGA un atajo arriba, no reordena nada abajo. Un menú que
// se acomoda solo obliga a leerlo entero cada vez, porque ya no se sabe dónde
// estaba lo de ayer; la memoria del lugar vale más que el ahorro de un toque.
//
// LOS TRES DEL DOTS NO ENTRAN acá aunque sean los más repetidos: ya tienen su
// bloque fijo arriba de todo, a un toque. Si entraran, sentadilla aparecería
// dos veces en la misma pantalla y habría que decidir cuál de las dos es la
// buena. Los dos bloques se reparten el trabajo: el del DOTS es fijo y dice
// cuáles mueven el número de fuerza; este es tuyo y cambia contigo.

import type { Ejercicio } from './tipos.ts';

/** Una fila de `mis_ejercicios_usados()`. */
export type Usado = {
  ejercicio: string;
  /** En cuántos bloques apareció. No es series: dos sesiones con él pesan más que una con veinte series. */
  veces: number;
  /** La última vez, en ISO. Solo se usa para desempatar. */
  ultima: string;
};

/**
 * CUÁNTOS SE MUESTRAN. Seis es el largo de una rutina real y entra en pantalla
 * sin empujar las zonas fuera de vista. Con más, el atajo se vuelve otra lista
 * para leer, que es justo lo que viene a evitar.
 */
export const TOPE_TUYOS = 6;

/**
 * Los tuyos, de más usado a menos.
 *
 * DESEMPATE POR FECHA y no alfabético: con dos ejercicios usados tres veces
 * cada uno, el que hiciste el martes es más probable que el que hiciste en
 * marzo. Y el tercer desempate es el nombre, para que el orden sea estable —
 * sin él, dos empatados en todo pueden intercambiarse entre una carga y otra y
 * el atajo baila debajo del dedo.
 */
export function tuyos(
  usados: readonly Usado[],
  ejercicios: readonly Ejercicio[],
  tope: number = TOPE_TUYOS
): Ejercicio[] {
  const porId = new Map(ejercicios.map((e) => [e.id, e]));
  return usados
    .filter((u) => {
      const e = porId.get(u.ejercicio);
      // Un ejercicio que se borró del catálogo sigue nombrado en los bloques
      // viejos: si no está, no se muestra. Y los del DOTS ya están arriba.
      return !!e && !e.cuenta_dots && u.veces > 0;
    })
    .sort(
      (a, b) =>
        b.veces - a.veces ||
        (b.ultima ?? '').localeCompare(a.ultima ?? '') ||
        (porId.get(a.ejercicio)!.nombre ?? '').localeCompare(porId.get(b.ejercicio)!.nombre ?? '')
    )
    .slice(0, Math.max(0, tope))
    .map((u) => porId.get(u.ejercicio)!);
}
