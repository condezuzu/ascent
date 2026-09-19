// Una cita por pantalla, en Inicio, con su autor debajo.
//
// SON CITAS REALES Y LLEVAN AUTOR (2026-09-19, decisión del humano). Hasta el
// 17/9 fueron citas de deportistas; el 17 se cambiaron por frases propias sin
// autor; ahora vuelven las citas, verificadas una por una. El motivo del
// cambio del 17 —la atribución— sigue en pie, y por eso acá cada cita lleva su
// OBRA Y SU LUGAR, no solo el nombre: `fuente` no se muestra, existe para que
// cualquiera pueda ir a mirarla.
//
// LO QUE SE APRENDIÓ VERIFICANDO, y es la razón de que `fuente` exista:
//   - "Nuestra mayor gloria…" NO es de Confucio: es de Oliver Goldsmith (1762).
//     Se le empezó a atribuir a Confucio en 1831.
//   - "Somos lo que hacemos repetidamente" NO es de Aristóteles: es de Will
//     Durant (1926) resumiendo la Ética a Nicómaco.
//   - La frase del comercial de Nike la escribió un redactor de la agencia, no
//     Michael Jordan: por eso no está.
//   - "Odié cada minuto del entrenamiento…", de Ali, no tiene fuente primaria:
//     por eso no está.
//
// LOS RECORTES SON TEXTUALES. Dos citas no entraban en un renglón (Platón y
// Newton) y se recortaron a un fragmento literal del texto, nunca reescrito.
// Si alguna vez una cita no entra, se recorta igual o se cambia por otra: lo
// que no se hace es reescribirla.
//
// UN SOLO RENGLÓN, Y ES UNA REGLA DE PANTALLA. Inicio entra sin scroll en los
// veinte casos medidos (ver `herramientas/medir-inicio-en-sesion.mjs`) y una
// cita de dos renglones se lo come. En el teléfono más angosto (SE, 375 px) el
// renglón da 316 px con el estilo de `.cita`; el tope de 48 caracteres de
// `test:db` (sección 120) es esa medida pasada a caracteres, con margen.
//
// LOS EJES, que es lo que las mantiene distintas: empezar, acumular, repetir,
// el ritmo, volver, la lentitud, perder, descansar, la inercia, el camino
// propio, el esfuerzo que no se ve, el tiempo. Antes de cambiar una, mirar que
// la nueva traiga su eje.

export type Frase = {
  /** La cita, tal cual se muestra. */
  texto: string;
  /** Quién la dijo o la escribió, tal cual se muestra debajo. */
  autor: string;
  /** Obra y lugar exacto. No se muestra: está para poder verificarla. */
  fuente: string;
};

const FRASES: readonly Frase[] = [
  // empezar
  {
    texto: 'El comienzo es la parte más importante.',
    autor: 'Platón',
    fuente: 'República, libro II, 377a-b (recorte textual de "…de cualquier obra")',
  },
  // acumular
  {
    texto: 'La gota horada la piedra.',
    autor: 'Ovidio',
    fuente: 'Epistulae ex Ponto IV.10.5 — "gutta cavat lapidem"',
  },
  // repetir
  {
    texto: 'Somos lo que hacemos repetidamente.',
    autor: 'Will Durant',
    fuente: 'The Story of Philosophy (1926), cap. II. NO es de Aristóteles',
  },
  // el ritmo
  {
    texto: 'El viaje de mil millas empieza con un paso.',
    autor: 'Lao Tse',
    fuente: 'Tao Te Ching, cap. 64 (traducción popular; el original dice "bajo tus pies")',
  },
  // volver
  {
    texto: 'Levantarnos cada vez que caemos.',
    autor: 'Oliver Goldsmith',
    fuente: 'The Citizen of the World (1762), carta 7. NO es de Confucio',
  },
  // la lentitud
  {
    texto: 'Apresúrate despacio.',
    autor: 'Augusto',
    fuente: 'Suetonio, Vidas de los doce césares, "Augusto", 25 — "festina lente"',
  },
  // perder
  {
    texto: 'Fracasa otra vez. Fracasa mejor.',
    autor: 'Samuel Beckett',
    fuente: 'Worstward Ho (1983) — "Fail again. Fail better."',
  },
  // descansar
  {
    texto: 'Lo que no alterna con el descanso no dura.',
    autor: 'Ovidio',
    fuente: 'Heroidas IV.89 — "quod caret alterna requie durabile non est"',
  },
  // la inercia
  {
    texto: 'Todo cuerpo persevera en su estado.',
    autor: 'Isaac Newton',
    fuente: 'Principia (1687), Ley I (recorte textual de "…de reposo o de movimiento uniforme")',
  },
  // el camino propio
  {
    texto: 'Este es mi camino. ¿Dónde está el vuestro?',
    autor: 'Nietzsche',
    fuente: 'Así habló Zaratustra, III, "Del espíritu de la pesadez"',
  },
  // el esfuerzo que no se ve
  {
    texto: 'Estamos hechos de materia estelar.',
    autor: 'Carl Sagan',
    fuente: 'Cosmos (1980), episodio 1 — "we are made of star-stuff"',
  },
  // el tiempo
  {
    texto: 'No tenemos poco tiempo: perdemos mucho.',
    autor: 'Séneca',
    fuente: 'De brevitate vitae I.3 — "non exiguum temporis habemus, sed multum perdidimus"',
  },
];

/**
 * La cita de hoy.
 *
 * Cambia de día en día y no en cada carga: que no baile mientras la mirás,
 * pero que no sea siempre la misma. La semilla lleva la fecha y el usuario, así
 * que dos personas no ven la misma cita el mismo día.
 */
export function fraseDelDia(semilla: string): Frase {
  let h = 0;
  for (let i = 0; i < semilla.length; i++) h = (h * 31 + semilla.charCodeAt(i)) | 0;
  return FRASES[Math.abs(h) % FRASES.length];
}

/** Para los tests: la lista entera. */
export const TODAS_LAS_FRASES = FRASES;
