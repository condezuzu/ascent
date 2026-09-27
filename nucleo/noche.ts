/**
 * CUÁNTO SE VE LA SUPERFICIE DE UN CUERPO.
 *
 * DE DÓNDE SALE ESTO. El humano mandó una captura de su Inicio en día de
 * descanso y dijo que ese planeta le gustaba mucho más que el de siempre: "un
 * planeta cálido con atmósfera, sin rasgos". Parecía que pedía sacar la
 * textura, y por un rato se trabajó en un estilo plano sin texturas.
 *
 * No era eso. Ese planeta ES Marte, con toda su textura puesta — lo que pasa es
 * que en día de descanso el shader lo dibuja desde su cara nocturna y multiplica
 * la superficie por 0,055. Los cráteres están; se ven al cinco por ciento.
 *
 * O sea que lo que gusta no es "sin textura": es CUERPO OSCURO CON FILO
 * LUMINOSO. Y eso no necesita reescribir nada, solo un número.
 *
 * EL PROBLEMA DE PONERLO EN TODOS LOS DÍAS. La cara nocturna hoy es una SEÑAL:
 * significa "hoy descansás". Si todos los días se vieran igual, esa señal se
 * quema. Por eso los días normales no van a 0,055 sino bastante más arriba: se
 * conserva el filo y la forma, la textura queda insinuada, y el descanso sigue
 * siendo el más apagado de los dos.
 *
 * CERO NO ES OSCURO, ES "DE DÍA". `0` apaga la cara nocturna entera y devuelve
 * la iluminación de siempre, que es lo que se venía usando. Se deja para poder
 * comparar los tres tratamientos en la galería sin tocar código.
 */

/** El día de descanso: la cara nocturna de verdad, casi sin superficie. */
export const NOCHE_DESCANSO = 0.055;

/**
 * Un día cualquiera: EL MISMO QUE EL DE DESCANSO.
 *
 * ASÍ LO DECIDIÓ EL HUMANO, viendo los diez planetas del rango 4 en cara
 * nocturna: "me gusta tanto que lo quiero siempre, todos los días". Y el
 * argumento que lo cierra: en un día de descanso uno ni abre la app, así que
 * perder ahí una señal cuesta poco.
 *
 * ESTO CONTRADICE LA CONDICIÓN QUE ÉL MISMO HABÍA PUESTO un día antes —que el
 * día normal y el de descanso no se vieran idénticos— y por eso el test que la
 * guardaba se reemplazó en vez de borrarse: ver la sección 117.
 *
 * LA SEÑAL DEL DESCANSO NO SE PERDIÓ, estaba repetida: la tira semanal dibuja
 * ese día distinto y el texto dice "Hoy descansa. La racha sigue igual.". El
 * planeta era la tercera copia, y la única que se pagaba oscureciendo algo.
 */
export const NOCHE_DIA = NOCHE_DESCANSO;

/** Los valores que la galería pone uno al lado del otro. */
export const NIVELES_A_PROBAR = [NOCHE_DESCANSO, 0.1, 0.15, 0.2, 0.3, 0.4] as const;

/**
 * Qué nivel le toca a un día. `suelto` permite forzarlo desde la galería;
 * en la app nunca se pasa.
 */
export function nivelDeNoche(reposo: boolean, suelto?: number): number {
  if (typeof suelto === 'number' && Number.isFinite(suelto) && suelto >= 0) return suelto;
  return reposo ? NOCHE_DESCANSO : NOCHE_DIA;
}

/**
 * EL NIVEL DE NOCHE, PERO POR CUERPO (27/9).
 *
 * EL PROBLEMA. `NOCHE_DESCANSO` (5,5%) se fijó igual para todos mirando Tierra,
 * Neptuno y Urano —azules—. Un azul al 5,5% se sigue leyendo azul; un gris al
 * 5,5% se lee NEGRO. Por eso Ceres y Mercurio salían "grises y feos": el nivel
 * no estaba mal para los azules, estaba mal para los grises.
 *
 * LA REGLA. El nivel sube SOLO lo necesario según cuánto sobrevive el color
 * propio del cuerpo en la sombra:
 *  - Un cuerpo OSCURO necesita más piso, porque su superficie ya es casi negra.
 *  - Un cuerpo CROMÁTICO (un azul, un rojo) no necesita nada: el color se lee
 *    aunque esté muy apagado. Un GRIS no tiene color que lo salve, solo brillo.
 * Así los azules y los brillantes quedan como estaban (que es lo que gustaba) y
 * los grises oscuros se despegan del negro.
 *
 * Se mira el tono medio-oscuro (`paleta[1]` y `[2]`), que es lo que muestra la
 * cara nocturna. `suelto` (la galería) sigue forzando un valor uniforme para
 * poder comparar.
 */
function aRGB(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}
const luminancia = ([r, g, b]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const saturacion = ([r, g, b]: [number, number, number]) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx <= 0 ? 0 : (mx - mn) / mx;
};
const suave = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Calibra el piso de los grises. Chico: el piso sube fuerte en los cuerpos
 *  oscuros pero deja quietos a los grises CLAROS (la Luna) y a los brillantes.
 *  Va al cuadrado del brillo, no lineal, para separar bien un gris oscuro
 *  (Ceres, Mercurio) de uno claro (Luna): en lineal subían casi igual. */
export const OBJETIVO_PERCIBIDO = 0.014;
/** El techo: por más oscuro que sea el cuerpo, la cara nocturna no pasa de acá. */
export const NOCHE_TECHO = 0.2;

export function nivelDeNocheDeCuerpo(paleta: readonly string[], suelto?: number): number {
  if (typeof suelto === 'number' && Number.isFinite(suelto) && suelto >= 0) return suelto;
  const c1 = aRGB(paleta[1]), c2 = aRGB(paleta[2]);
  const lum = (luminancia(c1) + luminancia(c2)) / 2;
  const sat = (saturacion(c1) + saturacion(c2)) / 2;
  // Lo que un gris de este brillo necesita para despegarse del negro. Al cuadrado:
  // un cuerpo el doble de oscuro necesita cuatro veces más piso.
  const pisoGris = OBJETIVO_PERCIBIDO / Math.pow(Math.max(lum, 0.05), 2);
  // Cuánto lo salva su propio color: cromático → no hace falta subir nada.
  const alivio = suave(0.2, 0.5, sat);
  const nivel = pisoGris * (1 - alivio) + NOCHE_DESCANSO * alivio;
  return Math.min(NOCHE_TECHO, Math.max(NOCHE_DESCANSO, nivel));
}

/**
 * ¿Se distinguen dos niveles a simple vista? El ojo no lee el brillo de forma
 * lineal, así que lo que importa es la RAZÓN entre los dos y no la resta: de
 * 0,055 a 0,10 hay casi el doble, y de 0,30 a 0,35 no hay casi nada, aunque la
 * diferencia numérica sea parecida.
 *
 * El umbral de 1,8 sale de esa misma cuenta: menos que eso y son dos grises que
 * hay que poner al lado para notar cuál es cuál, que es justo lo que una señal
 * no puede permitirse.
 */
export const RAZON_MINIMA = 1.8;

export function seDistinguen(a: number, b: number): boolean {
  const bajo = Math.min(a, b);
  const alto = Math.max(a, b);
  if (!(bajo > 0) || !Number.isFinite(alto)) return false;
  return alto / bajo >= RAZON_MINIMA;
}
