// Una cita por pantalla, distinta según el rango.
//
// REGLA: solo citas reales y bien atribuidas. Nada inventado, nada puesto en
// boca de quien no lo dijo. Ante la menor duda sobre la autoría, no entra.
// Por eso son dieciocho y no cuarenta: se prefirió el recorte a rellenar.
// Están traducidas del inglés; el sentido se respetó, no son literales.

export type Cita = { texto: string; autor: string };

const CITAS: Record<number, Cita[]> = {
  // Polvo: recién empieza, todavía no hay nada
  1: [
    { texto: 'Empezá donde estás. Usá lo que tenés. Hacé lo que puedas.', autor: 'Arthur Ashe' },
    {
      texto: 'Si querés correr, corré un kilómetro. Si querés cambiar tu vida, corré un maratón.',
      autor: 'Emil Zátopek',
    },
    {
      texto: 'Nunca dejes que el miedo a errar te impida entrar al juego.',
      autor: 'Babe Ruth',
    },
  ],
  // Asteroide: ya hay algo sólido, pero recién arranca
  2: [
    {
      texto:
        'Odiaba cada minuto del entrenamiento. Pero me decía: no aflojes. Sufrí ahora y viví el resto de tu vida como campeón.',
      autor: 'Muhammad Ali',
    },
    {
      texto: 'Dar menos que tu mejor esfuerzo es desperdiciar el don.',
      autor: 'Steve Prefontaine',
    },
  ],
  // Luna: la repetición empieza a dejar marca
  3: [
    {
      texto:
        'No le temo al que practicó diez mil patadas una vez. Le temo al que practicó una patada diez mil veces.',
      autor: 'Bruce Lee',
    },
    { texto: 'Primero dominá los fundamentos.', autor: 'Larry Bird' },
  ],
  // Planeta: hay masa, y también fracasos acumulados
  4: [
    {
      texto:
        'Todos tenemos sueños. Pero para convertirlos en realidad hace falta muchísima determinación, dedicación, disciplina y esfuerzo.',
      autor: 'Jesse Owens',
    },
    {
      texto:
        'Fallé más de nueve mil tiros. Perdí casi trescientos partidos. Veintiséis veces confiaron en mí para el tiro decisivo y erré. Fracasé una y otra vez. Por eso tengo éxito.',
      autor: 'Michael Jordan',
    },
  ],
  // Sol: se encendió, el esfuerzo ya es otra cosa
  5: [
    {
      texto: 'No cuento las abdominales. Empiezo a contar recién cuando duele.',
      autor: 'Muhammad Ali',
    },
    { texto: 'Entrené cuatro años para correr nueve segundos.', autor: 'Usain Bolt' },
  ],
  // Sistema: la rutina ya es un mecanismo que se sostiene solo
  6: [
    {
      texto:
        'El éxito no es casualidad. Es trabajo duro, perseverancia, estudio, sacrificio y sobre todo amor por lo que estás haciendo.',
      autor: 'Pelé',
    },
    {
      texto: 'Esto es noventa por ciento mental. La otra mitad es física.',
      autor: 'Yogi Berra',
    },
  ],
  // Galaxia: a esta altura lo que define es cómo se vuelve de una caída
  7: [
    {
      texto:
        'Creo que a un campeón no lo definen sus victorias, sino cómo se recupera cuando cae.',
      autor: 'Serena Williams',
    },
    {
      texto:
        'No huyo de un desafío por miedo. Corro hacia él, porque la única forma de escapar del miedo es pisarlo.',
      autor: 'Nadia Comăneci',
    },
  ],
  // Agujero negro: el final de la escalera
  8: [
    { texto: 'Ningún ser humano tiene límites.', autor: 'Eliud Kipchoge' },
    { texto: 'Los campeones siguen jugando hasta que les sale bien.', autor: 'Billie Jean King' },
    {
      texto: 'No importa si te derriban. Importa si te levantás.',
      autor: 'Vince Lombardi',
    },
    { texto: 'Errás el cien por ciento de los tiros que no hacés.', autor: 'Wayne Gretzky' },
  ],
};

// Cambia de día en día, no en cada carga: que no baile mientras la mirás,
// pero que no sea siempre la misma.
export function citaDelDia(rango: number, semilla: string): Cita {
  const lista = CITAS[rango] ?? CITAS[1];
  let h = 0;
  for (let i = 0; i < semilla.length; i++) h = (h * 31 + semilla.charCodeAt(i)) | 0;
  return lista[Math.abs(h) % lista.length];
}
