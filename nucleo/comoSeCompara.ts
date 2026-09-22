import { FUENTE } from './estandares.ts';

/**
 * CÓMO SE CALCULA EL RANKING DE FUERZA, el texto entero.
 *
 * POR QUÉ ES UN MÓDULO Y NO ESTÁ ESCRITO EN LA PANTALLA. Vivió dentro del
 * componente de la web hasta el 22/9, y ahí estaba bien mientras hubo una sola
 * app. Con dos, copiarlo significa dos ensayos de cien líneas que dicen lo
 * mismo hasta el día en que uno se corrige y el otro no — y el que quedó viejo
 * sigue explicando, con toda confianza, una app que ya no existe.
 *
 * POR QUÉ NO VA EN `nucleo/textos.ts`. Ahí vive el texto de la interfaz, donde
 * rige la regla de que nada pasa de dos renglones: si algo necesita un párrafo,
 * está mal diseñado. Acá es al revés — el párrafo ES el diseño, porque el que
 * abre esto vino a leer. Son dos reglas opuestas y por eso son dos archivos.
 *
 * LA FORMA: bloques, no HTML ni JSX. Una pantalla nativa no puede dibujar
 * `<strong>`, así que el énfasis viaja como dato y cada app lo pinta como
 * puede. Es lo mismo que hacemos con las paletas y con las reglas del gesto.
 */

export type Parte = string | { fuerte: string } | { enfasis: string };
export type Bloque = { tipo: 'titulo'; texto: string } | { tipo: 'parrafo'; partes: Parte[] };

const t = (texto: string): Bloque => ({ tipo: 'titulo', texto });
const p = (...partes: Parte[]): Bloque => ({ tipo: 'parrafo', partes });
const f = (fuerte: string): Parte => ({ fuerte });
const e = (enfasis: string): Parte => ({ enfasis });

export const COMO_SE_COMPARA: Bloque[] = [
  p(
    'El problema de comparar fuerza es que 100 kg no significan lo mismo en alguien de 60 que en ',
    'alguien de 100. Si se comparara el peso levantado a secas, el ranking lo ganaría siempre el ',
    'más pesado y no diría nada.'
  ),
  p(
    'Se usa ',
    f('DOTS'),
    ', que es el estándar del powerlifting fuera de la IPF. Toma lo que levantas y tu peso ',
    'corporal, y devuelve un número comparable entre personas de distinto tamaño. Los coeficientes ',
    'son los de OpenPowerlifting, no inventados aquí.'
  ),

  t('Qué entra'),
  p(
    'Solo tres: ',
    f('sentadilla, press de banca y peso muerto'),
    '. La fórmula está calibrada sobre esos tres, así que sumarle otros ejercicios no la haría más ',
    'completa —la invalidaría—: el número dejaría de ser comparable con el de cualquier otra ',
    'persona, que es lo único que lo hace valer.'
  ),
  p(
    'Puedes anotar todos los ejercicios que quieras y ver tu progreso, pero solo esos tres mueven ',
    'el número.'
  ),
  p(
    'Si anotaste un peso levantado varias veces, se calcula cuánto levantarías de una vez. Con una ',
    'sola repetición no hay nada que calcular: es el peso.'
  ),

  t('Por qué se pide el sexo'),
  p(
    'La fórmula tiene dos juegos de coeficientes. Sin ese dato no hay número: no se asume ninguno ',
    'ni se usa uno "por defecto", porque un DOTS calculado con la fórmula equivocada es un dato ',
    'falso que además ordena mal el ranking, y nadie lo notaría — el número igual parece razonable.'
  ),

  t('Qué ven tus amigos, y qué se puede deducir'),
  p(
    'Tus amigos ven tu DOTS ',
    f('exacto'),
    ', el mismo número que ves tú. Antes se mostraba un intervalo, y el motivo era este: tus amigos ',
    'también ven lo que levantas, y el DOTS es una función de lo que levantas y de tu peso ',
    'corporal. Con las dos cosas a la vista, cualquiera puede ',
    e('despejar'),
    ' tu peso corporal con una cuenta de dos líneas.'
  ),
  p(
    'Eso sigue siendo cierto. Lo que cambió es la decisión: entre amigos que se ven en el gimnasio, ',
    'un intervalo ancho escondía poco y arruinaba la comparación, que es para lo que sirve el ',
    'ranking. Así que el número va exacto y la consecuencia se acepta.'
  ),
  p(
    'Por eso la app avisa al activar el DOTS, que es el momento en que todavía se puede decidir no ',
    'hacerlo: sin sexo cargado no hay número, y sin número no hay nada que deducir.'
  ),

  t('Contra quién te compara'),
  p(
    'Contra ',
    f('gente que anota sus levantamientos en una app'),
    ', de tu sexo y de tu peso corporal. Los datos son los estándares ',
    FUENTE.edicion,
    ' de ',
    f(FUENTE.nombre),
    ', armados con levantamientos que la comunidad cargó entre ',
    String(FUENTE.desde),
    ' y ',
    String(FUENTE.hasta),
    '. Son datos declarados por los usuarios, sin verificar.'
  ),
  p(
    'Esa población está elegida a propósito. La otra opción eran los competidores de powerlifting ',
    'federado, y ahí la mediana está en 2,28 veces el peso corporal en sentadilla: alguien de 80 kg ',
    'que levanta 130 kg —que es la mitad justa de la gente que usa apps— quedaría casi último. ',
    'Comparar el gimnasio del barrio contra una competencia no lo hace más exigente, lo hace falso.'
  ),
  p(
    'Ninguna de las dos poblaciones es "el mundo", y esta tampoco: quien anota sus series en una ',
    'app ya entrena más que el promedio.'
  ),
  p(
    'La cuenta se hace ',
    f('en tu teléfono'),
    ', con una tabla que viene dentro de la app. No se consulta ningún servicio y funciona sin ',
    'internet.'
  ),

  t('La categoría y el porcentaje'),
  p(
    'Lo que publica la fuente son las cinco categorías —principiante, novato, intermedio, avanzado ',
    'y élite—, y cada una es un punto de la distribución: intermedio es la mitad de la gente, élite ',
    'es el 5% de arriba. El ',
    f('porcentaje sale de ahí'),
    ', interpolando entre esos cinco puntos. Por eso la categoría es el dato firme y el número es ',
    'una estimación.'
  ),
  p(
    f('En mujeres, el número pide más cautela.'),
    ' En todas las fuentes la muestra de mujeres es mucho más chica: en press de banca hay un ',
    'millón de resultados contra casi diez millones de hombres. La app lo avisa ahí mismo.'
  ),

  t('Por qué el global no tiene puestos'),
  p(
    'Entre amigos hay posiciones, porque se conocen: nadie infla un número que van a comprobar el ',
    'jueves en el gimnasio.'
  ),
  p(
    'En un ranking global de desconocidos es al revés — ser el número uno es exactamente el premio ',
    'que hace que valga la pena mentir, y no hay forma de verificar una marca desde una app. Por ',
    'eso el global no tiene puestos ni nombres, solo un porcentaje: nadie infla una marca para ',
    'pasar del 12% al 11%, porque ahí no hay nada que ganar.'
  ),

  t('Tu peso corporal'),
  p(
    'No se muestra nunca. Ni en tu perfil, ni entre amigos, ni en ningún ranking. El DOTS lo ',
    'calcula el servidor y devuelve el resultado, nunca el peso; el porcentaje contra la tabla se ',
    'calcula en tu teléfono y no sale de ahí.'
  ),
  p(
    'Lo que sí puede pasar, como dice más arriba, es que alguien lo ',
    e('deduzca'),
    ' a partir de tu DOTS y de tus marcas. Una cosa es no publicar un dato y otra es que sea ',
    'imposible de inferir: aquí se cumple la primera, no la segunda.'
  ),
];
