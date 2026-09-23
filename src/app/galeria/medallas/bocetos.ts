// LOS BOCETOS DE LAS MEDALLAS POR MARCA. Nada de esto está construido: es
// material para mirar y elegir (/galeria/medallas).
//
// ─────────────────────────────────────────────────────────────────────
// LOS DOS INTENTOS QUE FALLARON, Y POR QUÉ
//
// 1. ESQUEMAS DE MOVIMIENTO: un punto en el codo, otro en la muñeca, otro en
//    la barra. Lo cortó la frase justa — "Orión se reconoce como un hombre, no
//    como un diagrama de dónde tiene las articulaciones".
//
// 2. CONTORNOS: dibujar la silueta de cada parte. Arregló PIERNAS y nada más.
//    Pecho salía una mesa, espalda una nota musical, y hombros se leía pero se
//    leía "alguien levantando algo" — o sea, hacía falta saber de gimnasio.
//
// ─────────────────────────────────────────────────────────────────────
// EL DIAGNÓSTICO QUE SALIÓ DE AHÍ, Y QUE MANDA ESTE ARCHIVO
//
// Lo que hace legible a la pierna NO ES LA PIERNA: ES EL PIE. Un muslo solo es
// un tubo, igual que un brazo, igual que un cuello. Lo que lo vuelve pierna es
// un final chato, perpendicular al tubo, que no tiene ninguna otra parte.
//
// De ahí sale la regla: **solo se puede dibujar como silueta lo que termina en
// algo único**. El brazo tiene la mano. El tronco NO TIENE FINAL — es aquello
// en lo que terminan las demás partes. Dos de cinco, y el techo no se mueve.
//
// Y eso explica también por qué hombros salió explícito: como no tenía forma
// propia, se lo salvó metiéndole una barra. Lo explícito no fue un error
// aparte: fue el síntoma de la forma que faltaba. Cada vez que una zona no se
// puede dibujar, la mano se va sola al equipamiento.
//
// ─────────────────────────────────────────────────────────────────────
// LO QUE SE HACE ACÁ: LA FIGURA ES SIEMPRE LA MISMA, CAMBIA DÓNDE BRILLA
//
// Una sola constelación humana, IDÉNTICA en las cinco medallas, en estrellas
// apagadas. La zona la nombra QUÉ ESTRELLAS ESTÁN ENCENDIDAS.
//
// LA SILUETA DEJA DE CARGAR EL SIGNIFICADO, y por eso desaparece el problema
// del final único: ya no se pregunta "¿qué forma es esta?" sino "¿dónde está
// la luz?". Esa segunda pregunta la contesta cualquiera sin saber de gimnasio
// —es cómo se lee un cuadro de anatomía, que literalmente señala el cuerpo—.
//
// Y ES LO QUE HACE UNA CONSTELACIÓN DE VERDAD: la figura es fija y siempre la
// misma; lo que se ve son cuatro o cinco estrellas brillantes y el resto es
// cielo. Acá nada se rellena: es un cuerpo oscuro donde unas estrellas arden.
//
// LA LUZ SOBREVIVE AL ACHIQUE Y LA LÍNEA NO. A 18 px un contorno se vuelve una
// mancha; una mancha de luz SIGUE SIENDO una mancha de luz, y su posición se
// sigue leyendo. Es lo que decidió el camino.
//
// ─────────────────────────────────────────────────────────────────────
// PECHO CONTRA ESPALDA: EL PAR DIFÍCIL, RESUELTO PRIMERO
//
// Es el único par que este camino no resuelve solo: el mismo cuerpo con la luz
// casi en el mismo lugar. Se ataca con DOS señales independientes, para que no
// dependa de una sola:
//
//   1. LA COLUMNA. La espalda se dibuja DE ESPALDAS, y eso se dice con una
//      línea vertical de estrellas por el medio del tronco que la figura de
//      frente no tiene. Es la única diferencia de DIBUJO entre las cinco.
//   2. LA FORMA DE LA LUZ. Pecho es una BARRA horizontal en el centro alto.
//      Espalda es una V que abre en los hombros y cierra en la cintura — el
//      dorsal. Una barra y un triángulo no se confunden ni de reojo.
//
// Si con las dos juntas no se separan, el camino no sirve, y eso hay que
// saberlo antes de dibujar las otras tres.
//
// ─────────────────────────────────────────────────────────────────────
// QUE SE VEA CIELO Y NO UN MANIQUÍ
//
// Cuatro cosas, y la tercera es la que de verdad lo cambia:
//
//   - Las líneas de la figura van muy apagadas: unen, no dibujan.
//   - Las estrellas apagadas tienen MAGNITUDES DISTINTAS. Un punto idéntico
//     repetido diecinueve veces es una grilla; en el cielo no hay dos
//     estrellas del mismo brillo.
//   - HAY ESTRELLAS SUELTAS que no son de la figura (`POLVO`). Es lo que
//     convierte un diagrama en un cielo: en una carta celeste la constelación
//     está metida adentro de un campo, no flotando sola en el vacío.
//   - La encendida lleva halo. Una estrella brillante no es un punto más
//     grande: es un punto con luz alrededor.
//
// Se sigue la receta de `compartido/insignias.ts`: capas planas y no
// degradados (un `id` repetido en una lista es un error que el navegador
// resuelve callado), una cara oscura y un lado iluminado, y la decisión se
// toma mirando el tamaño de verdad.

export type Punto = readonly [number, number];
export type Linea = readonly [number, number];

/**
 * LA FIGURA, EN UNA CAJA DE 24×24. Una persona de pie, de frente, con los
 * brazos algo separados del cuerpo.
 *
 * TODO ENTRA EN EL DISCO: el radio es 11 desde el centro (12,12), así que un
 * vértice en una esquina de la caja queda AFUERA del cuerpo y se dibujaría
 * sobre el fondo. Ninguno pasa de 10,2.
 */
export const PUNTOS: readonly Punto[] = [
  [12, 3.5],    // 0  cabeza
  [12, 6.5],    // 1  base del cuello
  [7.5, 8],     // 2  HOMBRO izquierdo
  [16.5, 8],    // 3  HOMBRO derecho
  [5, 12],      // 4  codo izquierdo
  [19, 12],     // 5  codo derecho
  [5.5, 16.5],  // 6  MANO izquierda
  [18.5, 16.5], // 7  MANO derecha
  [9.5, 10.5],  // 8  pectoral izquierdo
  [14.5, 10.5], // 9  pectoral derecho
  [9.5, 15],    // 10 cadera izquierda
  [14.5, 15],   // 11 cadera derecha
  [9, 18.5],    // 12 rodilla izquierda
  [15, 18.5],   // 13 rodilla derecha
  [8.5, 21.5],  // 14 PIE izquierdo
  [15.5, 21.5], // 15 PIE derecho
  [12, 11],     // 16 columna, arriba  — solo de espaldas
  [12, 15],     // 17 cintura
  [12, 10.5],   // 18 esternón         — solo de frente
  [8, 10.5],    // 19 dorsal izquierdo — solo de espaldas
  [16, 10.5],   // 20 dorsal derecho   — solo de espaldas
];

/** El esqueleto de la constelación. Está en las cinco, igual. */
export const LINEAS: readonly Linea[] = [
  [0, 1],   // la cabeza cuelga del cuello
  [1, 2],
  [1, 3],   // las clavículas
  [2, 4],
  [4, 6],   // brazo izquierdo
  [3, 5],
  [5, 7],   // brazo derecho
  [2, 10],
  [3, 11],  // los costados del tronco, que se angostan hacia la cadera
  [10, 11], // la cadera
  [10, 12],
  [12, 14], // pierna izquierda
  [11, 13],
  [13, 15], // pierna derecha
];

/**
 * LA COLUMNA: lo único que se dibuja distinto, y solo en la medalla de
 * espalda. Una línea vertical de estrellas por el medio del tronco es lo que
 * dice que a esta persona se la está viendo desde atrás — de frente no hay
 * nada en el medio.
 */
export const COLUMNA: readonly Linea[] = [
  [1, 16],
  [16, 17],
];

/**
 * ESTRELLAS QUE NO SON DE NADIE. Lo que convierte el diagrama en un cielo: en
 * una carta celeste la constelación está metida adentro de un campo, no
 * flotando sola en el vacío.
 *
 * `[x, y, radio]`. Los radios son chicos y distintos entre sí a propósito.
 * Están elegidas a mano, lejos de la figura, y son FIJAS: sacarlas de un azar
 * las haría saltar de lugar en cada dibujado.
 */
export const POLVO: readonly (readonly [number, number, number])[] = [
  [4.5, 6, 0.45],
  [6.5, 3.5, 0.3],
  [8, 4.5, 0.55],
  [17.5, 4, 0.4],
  [20, 7.5, 0.55],
  [21.5, 11, 0.3],
  [2.5, 11.5, 0.5],
  [3, 15.5, 0.35],
  [20.5, 15, 0.45],
  [19, 19, 0.3],
  [5, 19, 0.5],
  [16, 20.5, 0.35],
];

/**
 * LAS MAGNITUDES DE LAS APAGADAS. Sin esto son diecinueve puntos idénticos, o
 * sea una grilla; en el cielo no hay dos estrellas del mismo brillo. Los
 * extremos —cabeza, manos, pies— van un poco más grandes porque son los que
 * arman la silueta.
 */
export const MAGNITUD: Readonly<Record<number, number>> = {
  0: 0.75, 1: 0.5, 2: 0.65, 3: 0.65, 4: 0.5, 5: 0.5,
  6: 0.7, 7: 0.7, 8: 0.4, 9: 0.4, 10: 0.55, 11: 0.55,
  12: 0.5, 13: 0.5, 14: 0.7, 15: 0.7, 16: 0.45, 17: 0.45, 18: 0.4,
  19: 0.4, 20: 0.4,
};

export type Zona = {
  clave: string;
  zona: string;
  /** Qué se enciende, dicho en palabras, para esta galería. */
  pie: string;
  /** Con la columna a la vista: a esta persona se la ve desde atrás. */
  deEspaldas?: boolean;
  /** Las estrellas que arden. */
  encendidas: readonly number[];
  /** Las líneas que arden: son las que le dan FORMA a la luz. */
  brillo: readonly Linea[];
  /** La más brillante de todas. */
  faro: number;
};

/**
 * EL PAR DIFÍCIL, Y NADA MÁS POR AHORA. Las otras tres zonas se agregan recién
 * cuando estas dos se distingan: si no se separan, el camino entero no sirve y
 * no tiene sentido dibujar el resto.
 */
export const ZONAS: readonly Zona[] = [
  {
    clave: 'pecho',
    zona: 'Pecho',
    pie: 'de frente, una barra de luz en el centro alto',
    // UNA BARRA HORIZONTAL. Tres estrellas en fila —pectoral, esternón,
    // pectoral— y las dos líneas que las unen. Ancha y de poca altura: la
    // forma más distinta que hay de un triángulo.
    encendidas: [8, 18, 9],
    brillo: [
      [8, 18],
      [18, 9],
    ],
    faro: 18,
  },
  {
    clave: 'espalda',
    zona: 'Espalda',
    pie: 'de espaldas —con la columna—, una V de hombros a cintura',
    // DE ESPALDAS, que es la primera señal, y una V que abre en los hombros y
    // cierra en la cintura, que es la segunda. La V es el dorsal, y es la
    // forma que tiene la espalda de cualquiera que levanta: ancha arriba,
    // angosta abajo.
    // LA COLUMNA VA APAGADA, PERO VISIBLE, y esto costó dos intentos:
    //
    //   - Tenue como el resto de la figura, la V se la comía: las dos se
    //     fundían en una forma sola y la señal de "a esta persona la estás
    //     viendo de atrás" no llegaba.
    //   - ENCENDIDA fue peor: una vertical que entra por arriba en el vértice
    //     de una V es, literalmente, una FLECHA HACIA ABAJO. Dejaba de leerse
    //     como un cuerpo y pasaba a leerse como un símbolo.
    //
    // Así que queda como CRESTA: más marcada que el resto del esqueleto, pero
    // apagada, y la única luz es la V. La columna sostiene la lectura sin
    // competir por ella.
    //
    // Y LA V ARRANCA EN LOS DORSALES, no en los hombros. Arrancando en los
    // hombros se comía la medalla de hombros, que enciende justamente esos dos
    // puntos. Un poco más abajo y más adentro, las dos zonas dejan de pisarse.
    deEspaldas: true,
    encendidas: [19, 20, 17],
    brillo: [
      [19, 17],
      [20, 17],
    ],
    faro: 17,
  },
];

/** Por debajo de este percentil no hay medalla: es para mostrar que sos mejor que la mayoría. */
export const UMBRAL = 50;

export type Material = {
  clave: string;
  nombre: string;
  /** Desde qué percentil. */
  desde: number;
  /**
   * LA CARA DEL CUERPO, Y ES CIELO. Acá estaba el error del primer dibujado de
   * este camino: la cara era `apagado`, un azul medio, y encima un lado
   * iluminado más claro todavía. Sobre eso, unas estrellas tenues en `claro`
   * SE PERDÍAN — y si la figura humana no se ve, "dónde está la luz" no tiene
   * a qué referirse y la medalla vuelve a ser una marca abstracta.
   *
   * El tono de cada rango se sigue leyendo en el borde, en el lado iluminado y
   * en las estrellas. Lo que cambia es que el fondo por fin es de noche.
   */
  noche: string;
  apagado: string;
  principal: string;
  claro: string;
};

/**
 * LOS TRES MATERIALES son CUERPOS DE LA APP y no metales: luna, planeta y
 * estrella, con las paletas de los rangos 3, 4 y 5. Los tres cortes —50, 80 y
 * 95— son percentiles que publica la propia fuente, no cortes inventados.
 */
export const MATERIALES: readonly Material[] = [
  { clave: 'luna', nombre: 'Luna', desde: 50, noche: '#1B2536', apagado: '#3A4A63', principal: '#7E8CA8', claro: '#D6D4CA' },
  { clave: 'planeta', nombre: 'Planeta', desde: 80, noche: '#121C30', apagado: '#27395C', principal: '#4A7FD0', claro: '#DBE7F5' },
  { clave: 'estrella', nombre: 'Estrella', desde: 95, noche: '#2A1D06', apagado: '#5A420F', principal: '#F2C230', claro: '#FFF1C2' },
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
