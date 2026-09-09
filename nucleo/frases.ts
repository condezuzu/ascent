// Una cita por pantalla, distinta según el rango.
//
// REGLA: solo citas reales y bien atribuidas. Nada inventado, nada puesto en
// boca de quien no lo dijo. Ante la menor duda sobre la autoría, no entra.
// Por eso son veinte y no cuarenta: se prefirió el recorte a rellenar.
//
// ESTÁN TRADUCIDAS del inglés, y esa traducción es NUESTRA: por eso sigue las
// reglas de `spec/idioma.md` como cualquier otro texto de la app. Hasta hoy
// estaban en rioplatense —"empezá", "usá", "tenés"— y eran lo último que
// quedaba en voseo en toda la app. Lo intocable de una cita es el sentido y el
// autor, no en qué español la escribimos nosotros.
//
// SE CAMBIARON LAS QUE NO SE ENTENDÍAN. Dos se fueron por eso y no por el
// idioma: el chiste de Yogi Berra sobre el noventa por ciento mental no
// sobrevive a la traducción y se lee como un error de cuentas, y la de Nadia
// Comăneci daba tres vueltas para decir algo simple. Una cita que hay que
// leer dos veces en un gimnasio no es una cita, es un obstáculo.

export type Cita = { texto: string; autor: string };

const CITAS: Record<number, Cita[]> = {
  // Polvo: recién empieza, todavía no hay nada
  1: [
    { texto: 'Empieza donde estás. Usa lo que tienes. Haz lo que puedas.', autor: 'Arthur Ashe' },
    {
      texto: 'Si quieres correr, corre un kilómetro. Si quieres cambiar tu vida, corre un maratón.',
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
        'Odiaba cada minuto del entrenamiento. Pero me decía: no aflojes. Sufre ahora y vive el resto de tu vida como campeón.',
      autor: 'Muhammad Ali',
    },
    {
      texto: 'Dar menos que tu mejor esfuerzo es sacrificar el don.',
      autor: 'Steve Prefontaine',
    },
    {
      texto: 'Todos quieren ser grandes, pero nadie quiere levantar pesado.',
      autor: 'Ronnie Coleman',
    },
  ],
  // Luna: la repetición empieza a dejar marca
  3: [
    {
      texto:
        'No le temo al que practicó diez mil patadas una vez. Le temo al que practicó una patada diez mil veces.',
      autor: 'Bruce Lee',
    },
    { texto: 'Primero domina los fundamentos.', autor: 'Larry Bird' },
    { texto: 'El hierro nunca miente.', autor: 'Henry Rollins' },
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
    {
      texto: 'Hoy hago lo que otros no quieren, para mañana lograr lo que otros no pueden.',
      autor: 'Jerry Rice',
    },
  ],
  // Sol: se encendió, el esfuerzo ya es otra cosa
  5: [
    {
      texto: 'No cuento las abdominales. Empiezo a contar recién cuando duele.',
      autor: 'Muhammad Ali',
    },
    { texto: 'Entrené cuatro años para correr nueve segundos.', autor: 'Usain Bolt' },
    {
      texto: 'Las últimas tres o cuatro repeticiones son las que hacen crecer el músculo.',
      autor: 'Arnold Schwarzenegger',
    },
  ],
  // Sistema: la rutina ya es un mecanismo que se sostiene solo
  6: [
    {
      texto:
        'El éxito no es casualidad. Es trabajo duro, perseverancia, estudio, sacrificio y sobre todo amor por lo que estás haciendo.',
      autor: 'Pelé',
    },
    {
      texto: 'Hay que estimular el músculo, no destruirlo.',
      autor: 'Lee Haney',
    },
    {
      texto: 'El único lugar donde el éxito viene antes que el trabajo es en el diccionario.',
      autor: 'Vince Lombardi',
    },
  ],
  // Galaxia: a esta altura lo que define es cómo se vuelve de una caída
  7: [
    {
      texto:
        'A un campeón no lo definen sus victorias, sino cómo se recupera cuando cae.',
      autor: 'Serena Williams',
    },
    {
      texto: 'La disciplina pesa gramos; el arrepentimiento pesa toneladas.',
      autor: 'Jim Rohn',
    },
  ],
  // Agujero negro: el final de la escalera
  8: [
    { texto: 'Ningún ser humano tiene límites.', autor: 'Eliud Kipchoge' },
    { texto: 'Los campeones siguen jugando hasta que les sale bien.', autor: 'Billie Jean King' },
    {
      texto: 'No importa si te derriban. Importa si te levantas.',
      autor: 'Vince Lombardi',
    },
    { texto: 'Fallas el cien por ciento de los tiros que no haces.', autor: 'Wayne Gretzky' },
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
