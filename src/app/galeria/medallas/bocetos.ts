// LOS BOCETOS DE LAS MEDALLAS POR MARCA. Nada de esto está construido: es
// material para mirar y elegir (/galeria/medallas).
//
// ─────────────────────────────────────────────────────────────────────
// EL PROBLEMA, QUE ES EL ÚNICO PROBLEMA
//
// Un bíceps es un ícono de gimnasio. La app está hecha de cuerpos celestes.
// Pegar una mancuerna encima del universo da una calcomanía.
//
// LA CONSTELACIÓN ES EL PRECEDENTE HISTÓRICO: poner figuras humanas en el
// cielo es lo más viejo que se hizo con un cielo. Y la app ya habla ese
// idioma — el Ranking es un campo estelar y su estado vacío dice "empieza la
// constelación".
//
// ─────────────────────────────────────────────────────────────────────
// LO QUE SE APRENDIÓ EN EL SEGUNDO INTENTO (23/9)
//
// Los dos primeros bocetos dibujaban ESQUEMAS: un punto en el codo, otro en la
// muñeca, otro en la barra. El humano lo cortó con la frase justa — "Orión se
// reconoce como un hombre, no como un diagrama de dónde tiene las
// articulaciones" — y tenía razón: espalda salía literalmente un cuadrado, y
// pecho parecía más espalda que espalda.
//
// UN ESQUELETO DE PALITOS NO ES UNA FIGURA. Lo que hace que una constelación
// se lea es el CONTORNO: las líneas rodean una masa y el ojo completa el
// cuerpo. Orión tiene hombros anchos, cintura angosta y piernas — no tiene
// marcado el codo.
//
// LA PRUEBA QUE HAY QUE PASAR, puesta por el humano: alguien que nunca vio la
// app mira la medalla un segundo y sabe si es brazo, pierna, pecho, espalda u
// hombros. Sin leyenda y sin saber de gimnasio.
//
// ─────────────────────────────────────────────────────────────────────
// EL TERCER INTENTO, Y LO QUE SE VIO AL MIRARLO
//
// El contorno arregló BRAZOS y PIERNAS: un brazo flexionado y una pierna
// con pie son dos de las siluetas más universales que hay —el brazo es
// directamente un emoji— y ahora se leen sin ayuda.
//
// LOS OTROS TRES NO SE ARREGLARON, y conviene decir por qué en vez de
// seguir moviendo puntos. El intento fue dibujarlos como cuerpos enteros en
// la postura de su levantamiento: acostado, inclinado y de pie. Puesto en
// pantalla:
//
//     pecho    → sale una MESA. Y no es falta de puntería: una barra
//                horizontal arriba, dos brazos verticales y un cuerpo
//                horizontal abajo ES la geometría de una mesa. Ninguna
//                corrección de vértices cambia eso.
//     espalda  → sale una NOTA MUSICAL. La diagonal del torso con el brazo
//                colgando recto da una bandera, no una persona doblada.
//     hombros  → este sí se lee, pero se lee como "alguien levantando algo
//                sobre la cabeza". Que eso signifique HOMBROS ya es saber
//                de gimnasio, que es justo lo que la prueba prohíbe.
//
// ─────────────────────────────────────────────────────────────────────
// EL FONDO DEL ASUNTO: NO HAY TRES TORSOS
//
// Pecho, espalda y hombros son EL MISMO TORSO. De frente y de espalda el
// contorno es idéntico —hombros anchos, cintura angosta— y el hombro es una
// esquina de ese mismo contorno. Lo que los separa en un cuerpo real es el
// relieve, y el relieve necesita sombra: acá hay líneas planas en 24×24 que
// además tienen que sobrevivir a 18 px.
//
// Dibujar la POSTURA en vez de la anatomía esquiva el problema pero lo
// cambia por otro: la postura solo dice "pecho" si sabés qué músculo trabaja
// el press de banca.
//
// Así que la respuesta honesta a "si alguna zona no se puede dibujar de
// forma reconocible, decime cuál": son TRES, y son las tres del torso.
//
// LA SALIDA PROPUESTA (`TRES`, abajo): tres medallas en vez de cinco.
// Brazos, TORSO y piernas. Las tres son siluetas que cualquiera nombra sin
// leyenda, y el torso se lleva press de banca, remo y press militar. Pierde
// granularidad y gana lo único que se pidió: que se entienda. Además cumple
// el otro criterio, el de "pocas y de calidad, no muchas mediocres".
//
// Las cinco quedan en el archivo para poder mirarlas al lado de las tres.
// La decisión es del humano; esto no se construye hasta que elija.
//// ─────────────────────────────────────────────────────────────────────
// NO TODOS LOS VÉRTICES SON ESTRELLAS
//
// En el cielo tampoco: una constelación tiene cuatro o cinco estrellas
// brillantes y el resto es la línea que las une. Dibujar un punto en cada
// vértice de un contorno de doce lados da una masa de puntos, no una figura —
// y a 18 px es una mancha.
//
// Por eso cada boceto dice qué vértices son ESTRELLAS. El contorno lo hacen
// las líneas; los puntos marcan lo que identifica la figura: el pico del
// bíceps, la rodilla, el centro de la barra.
//
// Se sigue la receta de `compartido/insignias.ts`: capas planas y no
// degradados (un `id` repetido en una lista es un error que el navegador
// resuelve callado), una cara oscura y un lado iluminado, y la decisión se
// toma mirando el tamaño de verdad.

export type Punto = readonly [number, number];

export type Boceto = {
  clave: string;
  zona: string;
  /** Qué se dibuja, para esta galería. */
  pie: string;
  /** Todos los vértices del contorno, en una caja de 24×24. */
  puntos: readonly Punto[];
  /** Qué vértice se une con cuál. */
  lineas: readonly (readonly [number, number])[];
  /** Cuáles llevan estrella. El resto son solo esquinas de la línea. */
  estrellas: readonly number[];
  /** La más brillante: lo que identifica la figura de un vistazo. */
  faro: number;
  /** Puesta cuando el dibujo NO pasa la prueba, con lo que sale en su lugar. */
  advertencia?: string;
};

/** Une una vuelta cerrada: 0-1, 1-2, … y el último con el primero. */
const vuelta = (n: number, desde = 0): readonly (readonly [number, number])[] =>
  Array.from({ length: n }, (_, i) => [desde + i, desde + ((i + 1) % n)] as const);

/** Une una cadena abierta de índices. */
const cadena = (...ids: number[]): readonly (readonly [number, number])[] =>
  ids.slice(0, -1).map((a, i) => [a, ids[i + 1]] as const);

export const BOCETOS: readonly Boceto[] = [
  {
    clave: 'brazos',
    zona: 'Brazos',
    pie: 'un brazo flexionado',
    // EL CONTORNO DEL BRAZO FLEXIONADO, dando la vuelta entera: axila, hombro,
    // el bíceps abultado arriba, el codo abajo a la derecha, el antebrazo
    // subiendo por fuera, el puño arriba, y de vuelta por abajo.
    //
    // LO QUE LO HACE RECONOCIBLE ES LA JOROBA DE ARRIBA. Sin el abultamiento
    // del bíceps esto es un ángulo; con él es el gesto que todo el mundo
    // conoce. Por eso el pico es el faro y va exagerado más de lo realista —
    // la misma licencia que ya se toman las insignias de rango.
    puntos: [
      [3, 16],  // 0 axila
      [3, 10],  // 1 hombro
      [7, 6],   // 2
      [11, 4],  // 3 PICO DEL BÍCEPS
      [15, 8],  // 4
      [18, 13], // 5 codo, por fuera
      [20, 6],  // 6 antebrazo subiendo
      [17, 3],  // 7 puño
      [14, 7],  // 8 antebrazo por dentro
      [14, 12], // 9 codo, por dentro
      [8, 14],  // 10 bajo del brazo
    ],
    lineas: vuelta(11),
    estrellas: [1, 3, 5, 7],
    faro: 3,
  },
  {
    clave: 'piernas',
    zona: 'Piernas',
    pie: 'una pierna',
    // EL PIE ES TODO. La versión anterior tenía la pierna bien y el pie
    // apenas insinuado, y sin pie el contorno se leía como una bolsa.
    //
    // Ahora el pie es LARGO Y CHATO y sale en ángulo recto desde un tobillo
    // ANGOSTO: siete de ancho por dos de alto, colgando de un tobillo de dos.
    // Ese contraste es lo que lo vuelve pie y no la punta de un palo — y el
    // pie es lo único de esta lista que solo tienen las piernas.
    //
    // Y LA PANTORRILLA. Sin ella el contorno era una cuña —ancho arriba,
    // angosto abajo— y una cuña con un pie es una bota. El bulto de atrás, a
    // media canilla, es lo que rompe la línea recta y vuelve pierna al
    // conjunto: grueso arriba, angosto en la rodilla, vuelve a engordar
    // atrás, y recién ahí el tobillo.
    //
    // TODO ENTRA EN EL DISCO: el radio es 11 desde el centro, así que un
    // vértice en una esquina de la caja de 24 cae AFUERA del cuerpo y se
    // dibuja sobre el fondo. Ninguno pasa de 10,5.
    puntos: [
      [7, 3],   // 0 cadera, atrás
      [14, 3],  // 1 cadera, adelante
      [16, 8],  // 2 muslo, lo más ancho
      [15, 12], // 3 RODILLA
      [13, 16], // 4 canilla
      [12, 19], // 5 tobillo, adelante
      [17, 21], // 6 PUNTA DEL PIE
      [10, 22], // 7 talón
      [10, 19], // 8 tobillo, atrás
      [8, 15],  // 9 PANTORRILLA
      [10, 12], // 10 atrás de la rodilla
      [7, 7],   // 11 muslo, atrás
    ],
    lineas: vuelta(12),
    estrellas: [1, 3, 6],
    faro: 3,
  },
  {
    clave: 'pecho',
    zona: 'Pecho',
    pie: 'un cuerpo acostado, empujando la barra',
    // ACOSTADO, y el torso va dibujado COMO UNA MASA y no como una raya. Esa
    // era la falla de la versión anterior: un cuerpo hecho de segmentos se
    // lee como un andamio. Un cuadrilátero cerrado, largo y horizontal, se
    // lee como alguien tirado — y eso es lo único que se hace acostado en un
    // gimnasio.
    //
    // SE FUE EL BANCO. Sumaba dos líneas y la postura ya la contaba el
    // cuerpo: lo que sobra no ayuda, tapa.
    puntos: [
      [4, 5],   // 0 barra, punta izquierda
      [20, 5],  // 1 barra, punta derecha
      [12, 5],  // 2 CENTRO DE LA BARRA
      [8, 5],   // 3 mano izquierda
      [16, 5],  // 4 mano derecha
      [8, 13],  // 5 hombro izquierdo
      [16, 13], // 6 hombro derecho
      [8, 17],  // 7 costado izquierdo
      [17, 16], // 8 cadera
      [4, 15],  // 9 cabeza
      [19, 19], // 10 pierna, cayendo del banco
    ],
    lineas: [
      [0, 1],           // la barra
      [3, 5],           // brazo izquierdo
      [4, 6],           // brazo derecho
      [9, 5],           // la cabeza, apoyada
      ...vuelta(4, 5),  // el torso, como masa: 5-6-7-8 cerrado
      [8, 10],          // la pierna
    ],
    estrellas: [0, 1, 2, 9],
    faro: 2,
    advertencia: 'Sale una mesa: barra horizontal, dos brazos verticales, cuerpo horizontal.',
  },
  {
    clave: 'espalda',
    zona: 'Espalda',
    pie: 'un cuerpo inclinado, la barra colgando',
    // INCLINADO, y otra vez el torso como masa. El cuadrado del primer
    // boceto salió de dibujar cuatro puntos sueltos; esto es una persona
    // doblada por la cadera con la cabeza abajo, que es la postura del que
    // levanta algo del piso y no se parece a ninguna otra.
    //
    // EL BRAZO CUELGA RECTO Y VERTICAL. En un peso muerto los brazos no
    // doblan: solo sostienen. Esa vertical contra la diagonal de la espalda
    // es lo que hace la silueta.
    puntos: [
      [4, 10],  // 0 cabeza
      [8, 8],   // 1 hombro, arriba
      [16, 11], // 2 cadera, arriba
      [16, 15], // 3 cadera, abajo
      [8, 12],  // 4 hombro, abajo
      [9, 19],  // 5 mano
      [5, 19],  // 6 barra, izquierda
      [14, 19], // 7 barra, derecha
      [17, 20], // 8 pie
    ],
    lineas: [
      [0, 1],           // la cabeza, colgando adelante
      ...vuelta(4, 1),  // la espalda, como masa: 1-2-3-4 cerrado
      [4, 5],           // el brazo, recto y vertical
      [6, 7],           // la barra
      [3, 8],           // la pierna
    ],
    estrellas: [0, 2, 5],
    faro: 5,
    advertencia: 'Sale una nota musical. La diagonal del torso no se lee como alguien doblado.',
  },
  {
    clave: 'hombros',
    zona: 'Hombros',
    pie: 'un cuerpo de pie, la barra arriba',
    // DE PIE, y la barra ARRIBA DE LA CABEZA. La Y de los brazos levantados es
    // una de las siluetas humanas más reconocibles que hay, y la cabeza entre
    // medio confirma que se está mirando a una persona de frente.
    puntos: [
      [4, 4],   // 0 barra, punta izquierda
      [20, 4],  // 1 barra, punta derecha
      [12, 4],  // 2 CENTRO DE LA BARRA
      [7, 4],   // 3 mano izquierda
      [17, 4],  // 4 mano derecha
      [9, 12],  // 5 hombro izquierdo
      [15, 12], // 6 hombro derecho
      [12, 9],  // 7 cabeza
      [12, 12], // 8 cuello
      [12, 17], // 9 cadera
      [9, 21],  // 10 pie izquierdo
      [15, 21], // 11 pie derecho
    ],
    lineas: [
      [0, 1],   // la barra
      [3, 5],   // brazo izquierdo
      [4, 6],   // brazo derecho
      [5, 6],   // los hombros
      [8, 9],   // el torso, de pie
      [9, 10],  // pierna izquierda
      [9, 11],  // pierna derecha
    ],
    estrellas: [0, 1, 2, 7],
    faro: 2,
    advertencia: 'Se lee, pero se lee “alguien levantando algo”. Que eso sea hombros ya es saber de gimnasio.',
  },
];

// Se usa arriba; queda expuesto por si hace falta armar otra figura.
export { vuelta, cadena };

// ─────────────────────────────────────────────────────────────────────
// LOS TRES MATERIALES, Y EL UMBRAL
//
// LA MEDALLA APARECE RECIÉN PASANDO LA MITAD. Una medalla es para mostrar que
// sos mejor que la mayoría; debajo de eso no se muestra nada. Y al haber menos
// medallas a la vez, las que hay se distinguen mejor.
//
// LOS TRES CORTES NO SE INVENTARON: son los percentiles que publica la propia
// fuente (5, 20, 50, 80 y 95). Se usan los tres de arriba tal cual. Inventar
// un corte propio sería inventar el dato que la medalla muestra como
// porcentaje.
//
// Y LOS TRES MATERIALES SON CUERPOS DE LA APP, con los colores de los rangos
// 3, 4 y 5: luna, planeta y estrella. La escalera se lee sin que nadie la
// explique. NO SE NOMBRAN EN LA INTERFAZ (§7): acá tienen nombre para poder
// hablar de ellos.

export type Material = {
  clave: string;
  nombre: string;
  desde: number;
  apagado: string;
  principal: string;
  claro: string;
};

/** Debajo de esto no hay medalla. */
/**
 * LA SALIDA PROPUESTA: tres medallas en vez de cinco.
 *
 * Brazo, torso y pierna. No hace falta saber de gimnasio ni leer un pie de
 * foto: son las tres partes en las que cualquiera divide un cuerpo.
 *
 * El torso se lleva press de banca, remo y press militar. Es una medalla más
 * difícil de sacar que las otras dos, y eso está bien: son tres ejercicios
 * compitiendo por un lugar en vez de tres medallas casi iguales.
 */
export const TRES: readonly Boceto[] = [
  BOCETOS[0], // el brazo, tal cual
  {
    clave: 'torso',
    zona: 'Torso',
    pie: 'un torso: press de banca, remo y press militar',
    // UN TORSO DE FRENTE, con cabeza y cuello. La cabeza es lo que decide:
    // sin ella una cuña de hombros anchos y cintura angosta es un trapecio,
    // y con ella es inmediatamente el tronco de una persona.
    //
    // LOS COSTADOS SE METEN PARA ADENTRO. Si van rectos de hombro a cadera
    // sale una campana; con la cintura marcada sale la V que todo el mundo
    // dibuja cuando dibuja un tronco.
    //
    // No hay brazos a propósito. Lo que se premia es el torso, y dos brazos
    // colgando a los costados agrandan la figura sin agregar información.
    puntos: [
      [12, 3],  // 0 coronilla
      [14, 5],  // 1
      [12, 8],  // 2 mentón
      [10, 5],  // 3
      [11, 8],  // 4 cuello, izquierda
      [13, 8],  // 5 cuello, derecha
      [19, 11], // 6 HOMBRO derecho
      [16, 16], // 7 cintura
      [14, 21], // 8 cadera derecha
      [10, 21], // 9 cadera izquierda
      [8, 16],  // 10 cintura
      [5, 11],  // 11 HOMBRO izquierdo
    ],
    lineas: [...vuelta(4), ...vuelta(8, 4)],
    estrellas: [0, 6, 11],
    faro: 0,
  },
  BOCETOS[1], // la pierna, tal cual
];
export const UMBRAL = 50;

export const MATERIALES: readonly Material[] = [
  { clave: 'luna', nombre: 'Luna', desde: 50, apagado: '#5B7BA8', principal: '#7E8CA8', claro: '#C4C2BA' },
  { clave: 'planeta', nombre: 'Planeta', desde: 80, apagado: '#2E4A78', principal: '#4A7FD0', claro: '#DBE7F5' },
  { clave: 'estrella', nombre: 'Estrella', desde: 95, apagado: '#EF9F27', principal: '#F2C230', claro: '#FFF1C2' },
];

/** `null` debajo del umbral: no hay medalla que dar. */
export const materialDe = (percentil: number): Material | null =>
  percentil < UMBRAL ? null : ([...MATERIALES].reverse().find((m) => percentil >= m.desde) ?? MATERIALES[0]);

// ─────────────────────────────────────────────────────────────────────
// LA FRASE, AL TOCAR
//
// UNA SOLA LÍNEA. Tenía una segunda que decía contra quién se compara —"entre
// gente que entrena, no que compite"— y se sacó entera a pedido: la medalla es
// un momento, no una nota al pie. De quién es la tabla se dice en Ajustes, que
// es donde alguien va a buscarlo si le importa.
//
// ES IMPERSONAL A PROPÓSITO: así sirve igual en tu perfil y en el de un amigo,
// sin cambiar una letra.

export const frase = (pct: number) => `Solo el ${pct}% levanta este peso.`;
