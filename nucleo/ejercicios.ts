import { T } from './textos.ts';
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

export type Zona = 'superior' | 'inferior' | 'core' | 'cardio';

/**
 * Qué músculos vive en cada zona. El ORDEN es el de la interfaz, y no es
 * alfabético: pecho y espalda primero porque son los dos grandes, y donde
 * empieza a buscar cualquiera.
 */
export const ZONAS: Record<Zona, string[]> = {
  superior: ['pecho', 'espalda', 'hombros', 'brazos'],
  inferior: ['piernas'],
  core: ['core'],
  // El cardio (migración 76): se mide en minutos, no en series.
  cardio: ['cardio'],
};

export const ORDEN_ZONAS: Zona[] = ['superior', 'inferior', 'core', 'cardio'];

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
/** El músculo como se lee en pantalla, en el idioma de la app ("pecho" → "Pecho" / "Chest"). */
export function nombreDeGrupo(grupo: string): string {
  return T.ejercicios.grupos[grupo] ?? grupo.charAt(0).toUpperCase() + grupo.slice(1);
}

/** Los grupos en los que se puede crear un ejercicio propio, en el orden del selector. */
export const GRUPOS_PROPIOS = ['pecho', 'espalda', 'hombros', 'brazos', 'piernas', 'core', 'cardio'] as const;

/** Sin mayúsculas ni acentos: "Elíptica" y "eliptica" son lo mismo para buscar. */
export function sinAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * BUSCAR CON LA LUPA (14/10). `coinciden`: los que tienen en el nombre todas las
 * palabras escritas (sin importar acentos ni el orden); primero los que
 * EMPIEZAN con lo escrito. `parecidos`: los que entrenan lo mismo —los otros
 * ejercicios de los músculos de los que coinciden—, para quien busca "press" y
 * también le sirve una apertura. Sin texto, nada.
 */
export function buscarEjercicios<T extends { id: string; nombre: string; grupo: string }>(
  lista: T[],
  texto: string,
  maxParecidos = 12,
  // Buscar "pecho" también encuentra los de pecho: el músculo cuenta como parte del nombre.
  nombreDelGrupo: (grupo: string) => string = () => ''
): { coinciden: T[]; parecidos: T[] } {
  const palabras = sinAcentos(texto).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return { coinciden: [], parecidos: [] };
  const conNombre = lista.map((e) => ({ e, n: sinAcentos(e.nombre), g: sinAcentos(nombreDelGrupo(e.grupo)) }));
  const coinciden = conNombre
    .filter(({ n, g }) => palabras.every((p) => n.includes(p) || g.includes(p)))
    .sort((x, y) => Number(!x.n.startsWith(palabras[0])) - Number(!y.n.startsWith(palabras[0])))
    .map(({ e }) => e);
  const grupos = new Set(coinciden.map((e) => e.grupo));
  const ya = new Set(coinciden.map((e) => e.id));
  const parecidos = lista.filter((e) => grupos.has(e.grupo) && !ya.has(e.id)).slice(0, maxParecidos);
  return { coinciden, parecidos };
}

export function gruposSinZona(grupos: string[]): string[] {
  return grupos.filter((g) => zonaDeGrupo(g) === null);
}
