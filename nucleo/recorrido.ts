import { T } from './textos.ts';

/**
 * EL RECORRIDO DE LA PRIMERA VEZ: la app misma, pantalla por pantalla.
 *
 * REEMPLAZA A LA BIENVENIDA de cinco párrafos. Pedido del humano: "en vez de
 * una explicación larga al principio, un recorrido por la app, y en cada
 * pantalla una línea corta de qué hace". Una línea mirando la pantalla de la
 * que habla se entiende; cinco párrafos antes de ver nada, no.
 *
 * EL GIMNASIO VA PRIMERO. Registrar el día solo al llegar es lo que hace
 * distinta a la app, y en la bienvenida vieja era el cuarto párrafo de cinco.
 * El primer paso lleva a Ajustes con el punto del gimnasio a la vista.
 *
 * Sigue valiendo la regla dura de siempre: no se nombra ningún rango ni
 * cuántos hay. Descubrirlo es la recompensa del juego.
 *
 * Sin importar nada del navegador: la web lo dibuja en `Recorrido.tsx`, y la
 * app nativa lo va a leer igual.
 */
export type PasoDelRecorrido = {
  ruta: string;
  /** El `id` de la sección a la que se lleva la vista, si hay una. */
  ancla?: string;
  texto: string;
};

export const PASOS_DEL_RECORRIDO: readonly PasoDelRecorrido[] = [
  { ruta: '/ajustes', ancla: 'gimnasio', texto: T.recorrido.gimnasio },
  { ruta: '/', texto: T.recorrido.inicio },
  { ruta: '/stats', texto: T.recorrido.stats },
  { ruta: '/album', texto: T.recorrido.album },
  { ruta: '/social', texto: T.recorrido.ranking },
];

/** Un paso guardado que ya no existe (se sacó uno) vuelve al principio. */
export function pasoValido(n: unknown): number {
  const i = Number(n);
  return Number.isInteger(i) && i >= 0 && i < PASOS_DEL_RECORRIDO.length ? i : 0;
}
