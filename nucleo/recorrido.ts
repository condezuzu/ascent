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
/**
 * LAS CINCO PANTALLAS, con el nombre que usa la app del teléfono.
 *
 * LA WEB NAVEGA POR RUTA Y LA NATIVA POR PESTAÑA, y son dos nombres para el
 * mismo lugar: '/social' y 'ranking' son la misma pantalla. Llevar los dos en
 * la misma fila es lo que deja que el recorrido sea UNA lista y no dos — con
 * dos, agregar una pantalla se hace bien de un lado y se olvida del otro, y
 * eso no lo canta nadie hasta que alguien recorre la app entera a mano.
 */
export type Pestana = 'inicio' | 'ranking' | 'album' | 'stats' | 'ajustes';

export type PasoDelRecorrido = {
  ruta: string;
  /** La misma pantalla, como la nombra la app del teléfono. */
  pestana: Pestana;
  /** El `id` de la sección a la que se lleva la vista, si hay una. */
  ancla?: string;
  texto: string;
};

export const PASOS_DEL_RECORRIDO: readonly PasoDelRecorrido[] = [
  { ruta: '/ajustes', pestana: 'ajustes', ancla: 'gimnasio', texto: T.recorrido.gimnasio },
  { ruta: '/', pestana: 'inicio', texto: T.recorrido.inicio },
  { ruta: '/stats', pestana: 'stats', texto: T.recorrido.stats },
  { ruta: '/album', pestana: 'album', texto: T.recorrido.album },
  { ruta: '/social', pestana: 'ranking', texto: T.recorrido.ranking },
];

/** Un paso guardado que ya no existe (se sacó uno) vuelve al principio. */
export function pasoValido(n: unknown): number {
  const i = Number(n);
  return Number.isInteger(i) && i >= 0 && i < PASOS_DEL_RECORRIDO.length ? i : 0;
}
