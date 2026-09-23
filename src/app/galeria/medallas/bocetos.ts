// LOS BOCETOS DE LAS MEDALLAS POR MARCA. Nada de esto está construido: es
// material para mirar y elegir (/galeria/medallas).
//
// ─────────────────────────────────────────────────────────────────────
// EL PROBLEMA, QUE ES EL ÚNICO PROBLEMA
//
// Un bíceps es un ícono de gimnasio. La app está hecha de cuerpos celestes.
// Pegar una mancuerna encima del universo da una calcomanía, y se nota a los
// dos segundos.
//
// LA SALIDA NO ES DIBUJAR MEJOR EL BÍCEPS: es que el bíceps no sea un dibujo.
//
// LA CONSTELACIÓN ES EL PRECEDENTE HISTÓRICO. Poner figuras humanas en el
// cielo es lo más viejo que se hizo con un cielo: Orión es un hombre con un
// cinturón, Hércules es un tipo arrodillado. Un brazo flexionado hecho de
// puntos unidos por líneas finas NO es un ícono de gimnasio metido en el
// espacio — es exactamente lo que el espacio viene haciendo con los cuerpos
// desde hace cuatro mil años. Y la app ya habla ese idioma: el Ranking es un
// campo estelar y su estado vacío dice "empieza la constelación".
//
// Se probaron otros dos caminos el 23/9 —la figura como sombra cruzando un
// disco encendido, y como línea grabada en la superficie— y se descartaron los
// dos mirándolos. Queda este.
//
// ─────────────────────────────────────────────────────────────────────
// EL GESTO, NO LA ZONA (cambio del 23/9)
//
// La primera tanda dibujaba la zona abstracta: un brazo, una pierna, una V de
// espalda. Se leía como anatomía y no se entendía qué ejercicio era. Ahora
// cada constelación dibuja **el gesto del levantamiento**: el brazo SUBIENDO
// el peso, la pierna ABAJO en la sentadilla, la barra EMPUJADA lejos del
// cuerpo.
//
// Y eso resuelve solo el riesgo más grande del set, que era que banca y press
// militar salieran iguales —los dos son "empujar una barra"—. Se distinguen
// por el CUERPO, no por los brazos: en banca el torso está acostado y se dibuja
// horizontal; en militar el cuerpo está de pie y se dibuja una columna
// vertical. Dos gestos, dos posturas, dos siluetas que no se confunden.
//
// Se sigue la receta de `compartido/insignias.ts`: capas planas y no
// degradados (un `id` repetido en una lista es un error que el navegador
// resuelve callado), una cara oscura y un lado iluminado, y la decisión se
// toma mirando el tamaño de verdad, no el grande.

export type Punto = readonly [number, number];

export type Boceto = {
  clave: string;
  zona: string;
  /** El gesto que dibuja la constelación. */
  pie: string;
  /** Los vértices, en una caja de 24×24. */
  puntos: readonly Punto[];
  /** Qué vértice se une con cuál. */
  lineas: readonly (readonly [number, number])[];
  /** El vértice que va más grande: dónde está el peso. */
  faro: number;
};

// ─────────────────────────────────────────────────────────────────────
// LAS CINCO ZONAS
//
// SON CINCO Y NO SEIS. El catálogo tiene piernas, espalda, brazos, pecho,
// hombros y core; core queda afuera **por el propio criterio de solo peso
// libre**: no hay un levantamiento de core con barra o mancuerna cuyos kilos
// signifiquen lo mismo entre dos personas. Una plancha con disco depende de la
// palanca y un giro ruso depende de cuánto gires. Medirlo sería inventar un
// número comparable donde no lo hay.
//
// EL FARO VA DONDE ESTÁ EL PESO, siempre: la muñeca que sube la mancuerna, el
// centro de la barra. Es lo que hace que la figura se lea como un
// levantamiento y no como un muñeco.

export const BOCETOS: readonly Boceto[] = [
  {
    clave: 'brazos',
    zona: 'Brazos',
    pie: 'el curl: la muñeca sube hacia el hombro',
    // EL CODO ES EL PIVOTE Y NO SE MUEVE; lo que viaja es la muñeca. Por eso
    // el ángulo del codo va cerrado y la muñeca queda ARRIBA y CERCA del
    // hombro: un brazo con el codo abierto es un brazo colgando, no un curl.
    puntos: [
      [7, 6],   // 0 hombro
      [6, 16],  // 1 codo — abajo, casi bajo el hombro
      [14, 10], // 2 muñeca — subida y vuelta hacia adentro
    ],
    lineas: [
      [0, 1],
      [1, 2],
    ],
    faro: 2,
  },
  {
    clave: 'piernas',
    zona: 'Piernas',
    pie: 'la sentadilla: abajo, con la rodilla adelante',
    // ABAJO DEL TODO, no de pie. El muslo casi horizontal y la rodilla
    // adelante del tobillo es lo que hace que se lea "sentadilla" y no
    // "pierna": una pierna estirada es un palo.
    puntos: [
      [7, 9],   // 0 cadera
      [16, 12], // 1 rodilla — adelante
      [9, 19],  // 2 tobillo — atrás, bajo la cadera
      [14, 20], // 3 punta del pie
    ],
    lineas: [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
    faro: 1,
  },
  {
    clave: 'pecho',
    zona: 'Pecho',
    pie: 'el press: la barra empujada lejos del torso',
    // EL TORSO VA HORIZONTAL porque en banca se está acostado, y esa línea de
    // abajo es lo único que lo separa del press militar. Sin ella, los dos
    // dibujos son "una barra y dos brazos".
    puntos: [
      [6, 6],   // 0 punta izquierda de la barra
      [18, 6],  // 1 punta derecha
      [12, 6],  // 2 centro de la barra: donde está el peso
      [8, 16],  // 3 hombro izquierdo
      [16, 16], // 4 hombro derecho
    ],
    lineas: [
      [0, 1], // la barra
      [0, 3], // brazo izquierdo
      [1, 4], // brazo derecho
      [3, 4], // el torso, acostado
    ],
    faro: 2,
  },
  {
    clave: 'espalda',
    zona: 'Espalda',
    pie: 'el peso muerto: la barra colgando de los brazos',
    // LA V SE FUE, y era la única que dibujaba anatomía en vez de gesto.
    // Ahora: hombros anchos arriba, dos brazos colgando rectos, y la barra
    // abajo. Un peso muerto es exactamente eso — lo que sostiene no son los
    // brazos, que solo cuelgan, y por eso van verticales y sin doblar.
    puntos: [
      [7, 7],   // 0 hombro izquierdo
      [17, 7],  // 1 hombro derecho
      [7, 16],  // 2 mano izquierda
      [17, 16], // 3 mano derecha
      [12, 16], // 4 centro de la barra
      [4, 16],  // 5 punta izquierda de la barra
      [20, 16], // 6 punta derecha
    ],
    lineas: [
      [0, 1], // los hombros
      [0, 2], // brazo izquierdo, colgando
      [1, 3], // brazo derecho
      [5, 6], // la barra
    ],
    faro: 4,
  },
  {
    clave: 'hombros',
    zona: 'Hombros',
    pie: 'el press militar: la barra arriba, de pie',
    // LA COLUMNA VERTICAL ES LO QUE LO SEPARA DE LA BANCA. Acá se está de pie,
    // así que el cuerpo baja en línea recta desde el pecho; en banca el torso
    // era una línea horizontal. Mismo movimiento, dos posturas, y la postura
    // es lo que se lee primero en una silueta chica.
    puntos: [
      [6, 4],   // 0 punta izquierda de la barra
      [18, 4],  // 1 punta derecha
      [12, 4],  // 2 centro de la barra: donde está el peso
      [8, 12],  // 3 hombro izquierdo
      [16, 12], // 4 hombro derecho
      [12, 12], // 5 pecho
      [12, 20], // 6 cadera
    ],
    lineas: [
      [0, 1], // la barra
      [0, 3], // brazo izquierdo
      [1, 4], // brazo derecho
      [3, 4], // los hombros
      [5, 6], // la columna, de pie
    ],
    faro: 2,
  },
];

// ─────────────────────────────────────────────────────────────────────
// LOS TRES MATERIALES, Y EL UMBRAL
//
// LA MEDALLA APARECE RECIÉN PASANDO LA MITAD (decisión del 23/9). Una medalla
// es para mostrar que sos mejor que la mayoría; debajo de eso no se muestra
// nada. No es solo criterio: al haber menos medallas a la vez, las que hay se
// distinguen mejor — y ese era el problema más grande que tenía el set a 18 px.
//
// LOS TRES CORTES NO SE INVENTARON: son los percentiles que publica la propia
// fuente (5, 20, 50, 80 y 95). Se usan los tres de arriba tal cual. Inventar
// un corte propio sería inventar el dato que la medalla después muestra como
// porcentaje.
//
// Y LOS TRES MATERIALES SON CUERPOS DE LA APP, con sus colores de
// `PALETAS_RANGO`: la luna del rango 3, el planeta del 4 y el sol del 5. Una
// medalla no inventa un color que la app no tenga en ningún otro lado, y la
// escalera se lee sin que nadie la explique — una luna es menos que un
// planeta, y un planeta es menos que una estrella.
//
// NO SE NOMBRAN EN LA INTERFAZ (§7). Acá tienen nombre para poder hablar de
// ellos; en la app solo se ven.

export type Material = {
  clave: string;
  /** Solo para esta galería: en la app no se escribe. */
  nombre: string;
  /** El percentil desde el que aplica. */
  desde: number;
  apagado: string;
  principal: string;
  claro: string;
};

/** Debajo de esto no hay medalla. */
export const UMBRAL = 50;

export const MATERIALES: readonly Material[] = [
  // Luna (rango 3): celeste alrededor, gris cálido en la cara iluminada.
  { clave: 'luna', nombre: 'Luna', desde: 50, apagado: '#5B7BA8', principal: '#7E8CA8', claro: '#C4C2BA' },
  // Planeta (rango 4).
  { clave: 'planeta', nombre: 'Planeta', desde: 80, apagado: '#2E4A78', principal: '#4A7FD0', claro: '#DBE7F5' },
  // Estrella (rango 5, el Sol).
  { clave: 'estrella', nombre: 'Estrella', desde: 95, apagado: '#EF9F27', principal: '#F2C230', claro: '#FFF1C2' },
];

/** `null` debajo del umbral: no hay medalla que dar. */
export const materialDe = (percentil: number): Material | null =>
  percentil < UMBRAL ? null : ([...MATERIALES].reverse().find((m) => percentil >= m.desde) ?? MATERIALES[0]);

// ─────────────────────────────────────────────────────────────────────
// LA FRASE, AL TOCAR
//
// TIENE QUE FUNCIONAR EN LOS DOS PERFILES: el propio y el de un amigo. Es el
// requisito que descarta la mitad de las opciones — "estás en el 12%" no se
// puede leer en el perfil de otro, y "es parte del 12%" suena raro leyéndolo
// sobre uno mismo. La impersonal sirve en los dos lugares sin cambiar una
// letra, y encima es la más corta.
//
// Y LA SEGUNDA LÍNEA DICE CONTRA QUIÉN, en voz baja. Sin eso, el porcentaje
// suena a un dato del universo y es el dato de una tabla concreta: gente que
// anota sus levantamientos, no gente que compite. Es la misma honestidad que
// la app ya tiene en Ajustes, dicha donde se lee el número.

export const FRASES = [
  {
    clave: 'impersonal',
    recomendada: true,
    principal: (pct: number) => `Solo el ${pct}% levanta este peso.`,
    pie: 'Entre gente que entrena, no que compite.',
    porque: 'Sirve igual en tu perfil y en el de un amigo, sin cambiar una letra. Y es la más corta.',
  },
  {
    clave: 'tercera',
    recomendada: false,
    principal: (pct: number) => `Es parte del ${pct}% que levanta este peso.`,
    pie: 'Entre gente que entrena, no que compite.',
    porque: 'Se lee bien en el perfil de un amigo y raro en el propio.',
  },
  {
    clave: 'segunda',
    recomendada: false,
    principal: (pct: number) => `Estás en el ${pct}% que levanta este peso.`,
    pie: 'Entre gente que entrena, no que compite.',
    porque: 'La más cálida, pero no se puede usar en el perfil de otro.',
  },
];
