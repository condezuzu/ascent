/**
 * CÓMO SE NAVEGAN CIEN EJERCICIOS.
 *
 * Con 31 alcanzaba una lista; con 100 no. Una lista de cien nombres obliga a
 * leerla entera para encontrar el tuyo, y en un gimnasio, entre serie y serie,
 * eso no se hace: se elige lo primero que se parezca, o directamente no se
 * elige. El catálogo grande sin navegación es peor que el catálogo chico.
 *
 * SON DOS PASOS Y NO TRES. Zona (tren superior / tren inferior / core) y
 * músculo. Al músculo le sigue la lista, que ahí sí es corta —entre siete y
 * veinte— y se lee de un vistazo.
 *
 * CORE ES UNA ZONA Y NO UN MÚSCULO SUELTO, aunque quede raro al lado de dos
 * mitades del cuerpo: es lo que la gente busca por su cuenta ("abdominales"),
 * no algo que se busque dentro del tren inferior. Un árbol se ordena por dónde
 * va a buscar la gente, no por anatomía.
 *
 * NO IMPORTA NADA: se prueba con node pelado, igual que el resto de `nucleo`.
 */

export type Zona = 'superior' | 'inferior' | 'core';

/**
 * Qué músculos vive en cada zona. El ORDEN es el de la interfaz, y no es
 * alfabético: pecho y espalda primero porque son los dos grandes, y donde
 * empieza a buscar cualquiera.
 */
export const ZONAS: Record<Zona, string[]> = {
  superior: ['pecho', 'espalda', 'hombros', 'brazos'],
  inferior: ['piernas'],
  core: ['core'],
};

export const ORDEN_ZONAS: Zona[] = ['superior', 'inferior', 'core'];

/** En qué zona cae un grupo muscular. `null` si es uno que no está mapeado. */
export function zonaDeGrupo(grupo: string): Zona | null {
  for (const z of ORDEN_ZONAS) if (ZONAS[z].includes(grupo)) return z;
  return null;
}

/**
 * Los grupos de una zona que EXISTEN en el catálogo recibido, en el orden de
 * `ZONAS`. Se filtra contra el catálogo y no se devuelve la lista fija porque
 * el catálogo lo manda la base: si mañana se saca un grupo entero, la
 * navegación no puede seguir ofreciendo una puerta a una habitación vacía.
 */
export function gruposDeZona(zona: Zona, grupos: string[]): string[] {
  return ZONAS[zona].filter((g) => grupos.includes(g));
}

/**
 * Los grupos del catálogo que NO tienen zona.
 *
 * Existe para el test: agregar un grupo muscular nuevo a la base y olvidarse
 * de ponerlo en un árbol lo deja fuera del selector, y eso no se ve mirando
 * ninguna de las dos mitades — el catálogo sigue completo y el selector sigue
 * funcionando, solo que a esos ejercicios no se llega.
 */
export function gruposSinZona(grupos: string[]): string[] {
  return grupos.filter((g) => zonaDeGrupo(g) === null);
}
