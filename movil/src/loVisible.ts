/**
 * LO QUE LA PANTALLA ESTÁ MOSTRANDO AHORA MISMO, para el diagnóstico.
 *
 * NACIÓ DEL BUG DE LAS SERIES (22/9). Ese bug es un desencuentro entre tres
 * cosas que casi siempre dicen lo mismo: lo que se ve, lo que quedó guardado
 * en el teléfono y lo que tiene la base. Cuando pasa en el gimnasio, la única
 * de las tres que no se puede leer después es la primera: la caché y la base
 * siguen ahí dentro de un rato, pero "el total decía 8 y los circulitos
 * cero" se lo lleva el primer toque. Así que la pantalla lo deja anotado acá
 * y el diagnóstico lo lee sin preguntarle a nadie.
 *
 * ES UN MÓDULO PELADO, sin React y sin estado de ninguna pantalla: lo escribe
 * Inicio y lo lee el diagnóstico, que vive afuera del árbol de la app (en
 * `Raiz.tsx`) y no puede alcanzar el estado de una pantalla de otra manera.
 *
 * NO GUARDA NADA EN DISCO y muere con la app: no es un registro, es lo que
 * hay en pantalla en este instante.
 */

export type LoVisible = {
  /** El total de la sesión, el número grande del chip. */
  series: number | null;
  /** Los circulitos: cuántas van en el bloque y de cuántas. */
  hechas: number | null;
  meta: number | null;
  /** El ejercicio del bloque en curso, o `null` si todavía no se eligió. */
  ejercicio: string | null;
  /** Si la pantalla cree que hay una sesión corriendo. */
  corriendo: boolean;
  /** Cuándo se anotó esto, para saber si es de hace un rato. */
  cuando: number;
};

let visible: LoVisible | null = null;

/** Lo llama Inicio cada vez que cambia lo que muestra. */
export function mostrando(datos: Omit<LoVisible, 'cuando'>) {
  visible = { ...datos, cuando: Date.now() };
}

export function loVisible(): LoVisible | null {
  return visible;
}
