import { esSexoEstandar, ubicar, type EjercicioEstandar, type SexoEstandar } from './estandares.ts';

/**
 * LAS MEDALLAS POR MARCA: qué se gana y con qué.
 *
 * Aparecen al lado del nombre, en tu perfil y en el de tus amigos, cuando una
 * marca tuya está por encima de la mitad de la gente. Sustituyeron a los retos
 * entre amigos, que quedaron fuera el 23/9: un reto necesita un rival y esto
 * funciona con un usuario o con cien.
 *
 * ACÁ NO SE DIBUJA NADA. El dibujo —la constelación, dónde cae la luz de cada
 * zona, los materiales— vive en `compartido/medallas.ts`, que es de las dos
 * apps. Esto es solo la cuenta, y por eso se puede probar con números.
 *
 * ─────────────────────────────────────────────────────────────────────
 * UNA MEDALLA POR ZONA, Y UNA MARCA POR MEDALLA
 *
 * Cinco zonas, cinco ejercicios, y los cinco tienen tabla de Strength Level
 * (las dos últimas se trajeron el 24/9 justamente para esto: un set de cinco
 * donde dos no se pueden ganar no es un set de cinco).
 *
 * SOLO PESO LIBRE. Las máquinas quedan afuera porque varían entre marcas y no
 * se pueden comparar entre personas, y la tabla tampoco las tiene.
 *
 * ─────────────────────────────────────────────────────────────────────
 * EL MATERIAL SALE DE LA MEJOR MARCA, NO DE UN PROMEDIO
 *
 * Y esa decisión la manda la frase. Al tocar una dice "solo el X% levanta ESTE
 * peso" —singular—: un promedio de tres marcas no tiene un "este peso", no
 * existe ese número en ningún lado. La mejor sí.
 *
 * Además, promediar CASTIGARÍA ANOTAR: cargar tu primera marca de una zona te
 * bajaría la medalla. En una app cuyo trabajo es que registres cosas, ese es el
 * peor incentivo posible.
 *
 * Y NO BAJA NUNCA. Se queda con el percentil más alto que alcanzaste. Importa
 * porque el percentil depende del peso corporal: si subís de peso, el mismo
 * levantamiento da un percentil menor, y sacarte una medalla por engordar sería
 * un castigo que nadie pidió. Eso lo guarda quien llama, no esto: acá se
 * calcula el de hoy y afuera se compara con el guardado.
 */

export type ZonaMedalla = 'brazos' | 'pecho' | 'espalda' | 'hombros' | 'piernas';

/**
 * EL ORDEN EN QUE SE MUESTRAN, de arriba del cuerpo hacia abajo. No es
 * alfabético a propósito: al lado del nombre van varias en fila y que salten de
 * la cabeza a los pies y vuelvan se lee como desorden.
 */
export const ZONAS_MEDALLA: readonly ZonaMedalla[] = ['hombros', 'brazos', 'pecho', 'espalda', 'piernas'];

/** Qué ejercicio decide cada zona. Los cinco tienen tabla. */
export const EJERCICIO_DE_ZONA: Readonly<Record<ZonaMedalla, EjercicioEstandar>> = {
  hombros: 'press_militar',
  brazos: 'curl_barra',
  pecho: 'press_banca',
  espalda: 'peso_muerto',
  piernas: 'sentadilla',
};

/**
 * Por debajo de esto no hay medalla: es para mostrar que sos mejor que la
 * mayoría, y la mitad no es una mayoría.
 */
export const UMBRAL = 50;

/** Desde qué percentil empieza cada material. La galaxia no está: no es un percentil. */
export const CORTES = { luna: 50, planeta: 80, estrella: 95 } as const;

export type ClaveMaterial = 'luna' | 'planeta' | 'estrella' | 'galaxia';

/**
 * LOS TRES DEL DOTS, que son los que pueden encender la galaxia.
 *
 * No es una lista cualquiera: son los tres de un total de powerlifting, y son
 * también los tres que la app ya trata distinto en Stats. Curl y press militar
 * tienen tabla desde el 24/9 pero no entran acá — un total con un curl adentro
 * no sería un total.
 */
export const ZONAS_DE_GALAXIA: readonly ZonaMedalla[] = ['pecho', 'espalda', 'piernas'];

export type Marca = { ejercicio: string; kg: number };

export type Medalla = {
  zona: ZonaMedalla;
  ejercicio: EjercicioEstandar;
  /** A cuánta gente le gana, de 1 a 99. */
  percentil: number;
  material: ClaveMaterial;
};

/** El material de un percentil suelto. `null` si no llega al umbral. */
export function materialDe(percentil: number): Exclude<ClaveMaterial, 'galaxia'> | null {
  if (percentil >= CORTES.estrella) return 'estrella';
  if (percentil >= CORTES.planeta) return 'planeta';
  if (percentil >= CORTES.luna) return 'luna';
  return null;
}

/**
 * LAS MEDALLAS DE ALGUIEN, con las marcas que tenga.
 *
 * `kg` es el 1RM estimado, el mismo que alimenta el DOTS y la sección de
 * fuerza: la tabla está en 1RM, no en el peso que movió ese día.
 *
 * SIN SEXO O SIN PESO CORPORAL NO HAY NINGUNA, y no es un caso raro: la tabla
 * es por sexo y por peso corporal, y sin esos dos el percentil no existe.
 * Devolver una lista vacía es lo honesto; inventar un promedio sería inventar.
 *
 * SI HAY DOS MARCAS DEL MISMO EJERCICIO se toma la más alta. No debería pasar
 * —`mejores_marcas` ya devuelve una por ejercicio— pero esto no depende de eso.
 */
export function medallasDe(
  sexo: string | null | undefined,
  pesoCorporal: number | null | undefined,
  marcas: readonly Marca[]
): Medalla[] {
  if (!esSexoEstandar(sexo) || typeof pesoCorporal !== 'number' || !(pesoCorporal > 0)) return [];

  const mejor = new Map<string, number>();
  for (const m of marcas) {
    if (!(m.kg > 0)) continue;
    const previa = mejor.get(m.ejercicio);
    if (previa === undefined || m.kg > previa) mejor.set(m.ejercicio, m.kg);
  }

  const crudas = new Map<ZonaMedalla, Medalla>();
  for (const zona of ZONAS_MEDALLA) {
    const ejercicio = EJERCICIO_DE_ZONA[zona];
    const kg = mejor.get(ejercicio);
    if (kg === undefined) continue;
    const percentil = ubicar(ejercicio, sexo as SexoEstandar, pesoCorporal, kg).supera;
    const material = materialDe(percentil);
    if (material === null) continue;
    crudas.set(zona, { zona, ejercicio, percentil, material });
  }

  // LA GALAXIA: estrella en las tres del DOTS. No es un escalón más de la misma
  // escalera —arriba del 95 la fuente no tiene nada, ver `ubicar`— sino otro
  // eje: no es estar más arriba, es estarlo en los tres a la vez. Y la metáfora
  // sale sola: una galaxia es un montón de estrellas.
  //
  // SE VUELVEN GALAXIA LAS TRES QUE LA GANARON, no las cinco: hombros y brazos
  // no participaron.
  const lasTres = ZONAS_DE_GALAXIA.every((z) => crudas.get(z)?.material === 'estrella');
  if (lasTres) {
    for (const z of ZONAS_DE_GALAXIA) {
      const m = crudas.get(z);
      if (m) crudas.set(z, { ...m, material: 'galaxia' });
    }
  }

  return ZONAS_MEDALLA.map((z) => crudas.get(z)).filter((m): m is Medalla => m !== undefined);
}

/**
 * Cuántos son los "solo el X%" de una medalla: el complemento del percentil.
 *
 * El piso de 1 es de la fuente, no de acá: `ubicar` ya corta en 95 porque la
 * tabla no separa al 96 del 99,9. Está igual por si algún día llega un 100.
 */
export function cuantosLevantan(percentil: number): number {
  return Math.max(1, 100 - percentil);
}
