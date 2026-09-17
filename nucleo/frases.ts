// Una frase por pantalla, en Inicio.
//
// SON NUESTRAS, Y NO LLEVAN AUTOR. Hasta el 2026-09-17 eran veinte citas
// reales atribuidas —Ali, Jordan, Bruce Lee, Schwarzenegger—. Se fueron
// enteras, y el motivo no es la atribución: las citas de deportistas famosos
// son el cliché de cualquier app de gimnasio, y Ascent va de cuerpos celestes
// y rangos cósmicos. Una frase de Ronnie Coleman abajo de un planeta es la
// costura entre dos productos distintos.
//
// EL REGISTRO: afirman, no arengan. Ninguna tiene imperativo, ninguna te dice
// qué hacer, ninguna lleva signo de exclamación. Es el mismo tono que el resto
// de la app —"Se dispersó un poco de masa. Hoy se recupera."—: dicen el hecho
// y se callan. Y la metáfora sale de la física que la app ya usa (polvo, masa,
// gravedad, luz), no de un gimnasio.
//
// UNA SOLA BOLSA PARA LOS OCHO RANGOS, y no un balde por rango como antes.
// Con doce frases y ocho rangos, repartirlas da una o dos por balde: el que
// recién empieza vería siempre la misma. Y el rango ya está escrito en la
// pantalla, la frase no necesita repetirlo.
//
// SON DOCE Y NO VEINTICUATRO a propósito: doce escritas con criterio valen más
// que veinticuatro donde la mitad rellena. Rotando una por día, ninguna vuelve
// antes de doce días.
//
// LOS EJES, que es lo que las mantiene distintas. La primera versión tenía
// cinco frases que decían todas "la acumulación lenta funciona", y rotando
// doce eso se lee dos veces por semana: la app parecía tener una sola idea.
// Cada una de estas para en un eje propio —empezar, acumular, repetir, el
// ritmo, volver, la lentitud, perder, descansar, la inercia, el camino propio,
// el esfuerzo que no se ve—. Antes de agregar una, mirar que traiga un eje que
// no esté; si solo trae otra manera de decir "de a poco", no entra.
//
// EL TOPE ES 45 CARACTERES, y lo hace cumplir `test:db` (sección 120). No es
// estética: la frase vive en una tira angosta al pie de Inicio y una más larga
// se parte en tres renglones y deja de ser una frase.

export type Frase = string;

const FRASES: readonly Frase[] = [
  // empezar: el punto de partida ya cuenta como algo
  'El polvo también es materia.',
  // acumular: el resultado es invisible hasta que deja de serlo
  'La masa no se nota hasta que pesa.',
  // acumular: lo que se siente como peso es tiempo
  'La gravedad es solo tiempo acumulado.',
  // repetir: la repetición no suma, construye
  'Lo que se repite se vuelve estructura.',
  // el ritmo: se avanza parejo, no a los tirones
  'Se avanza por vueltas, no por saltos.',
  // volver: lo que define no es no haberse caído
  'Volver cuenta más que no haber faltado.',
  // la lentitud: despacio sigue siendo llegar
  'Lo lento también llega.',
  // perder: el único eje que mira hacia abajo, y el más honesto de todos
  'Lo que no se sostiene se dispersa.',
  // descansar: la pausa está en el diseño, no es una falla. Es la única que
  // le puede hablar a alguien un día que no entrena.
  'La mitad de todo cuerpo está a oscuras.',
  // la inercia: el eje no es cuánto llevás, es cuánto cuesta — y eso baja
  'Cuesta más frenar que seguir.',
  // el camino propio: la única donde existe otra gente. Hay una pantalla de
  // Ranking y existe el DOTS: la app te compara a propósito, y en ningún otro
  // lado dice que la comparación sirve para ubicarse y no para medirse.
  'Nadie más recorre tu trayectoria.',
  // el esfuerzo invisible: adentro pasa lo que cuesta, afuera se ve el resultado
  'Nadie ve la fusión, solo la luz.',
];

/**
 * La frase de hoy.
 *
 * Cambia de día en día y no en cada carga: que no baile mientras la mirás,
 * pero que no sea siempre la misma. La semilla lleva la fecha y el usuario, así
 * que dos personas no ven la misma frase el mismo día.
 *
 * YA NO RECIBE EL RANGO. Con una sola bolsa no hace falta, y pasarlo igual
 * dejaría un parámetro que no se usa esperando a que alguien lo crea vivo.
 */
export function fraseDelDia(semilla: string): Frase {
  let h = 0;
  for (let i = 0; i < semilla.length; i++) h = (h * 31 + semilla.charCodeAt(i)) | 0;
  return FRASES[Math.abs(h) % FRASES.length];
}

/** Para los tests: la lista entera. */
export const TODAS_LAS_FRASES = FRASES;
