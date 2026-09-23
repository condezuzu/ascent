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
// 1. LA CONSTELACIÓN ES EL PRECEDENTE HISTÓRICO. Poner figuras humanas en el
//    cielo es lo más viejo que se hizo con un cielo: Orión es un hombre con un
//    cinturón, Hércules es un tipo arrodillado. Un brazo flexionado hecho de
//    cinco puntos unidos por líneas finas NO es un ícono de gimnasio metido en
//    el espacio — es exactamente lo que el espacio viene haciendo con los
//    cuerpos desde hace cuatro mil años. Y la app ya habla ese idioma: el
//    Ranking es un campo estelar y su estado vacío dice "empieza la
//    constelación".
//
// 2. LA FIGURA NUNCA SE DIBUJA CON CONTORNO. O son puntos unidos, o es una
//    SOMBRA que cruza un disco encendido. Una pierna que tapa media luna se
//    lee como un tránsito, no como una pierna: la silueta aparece por lo que
//    falta, que es como aparecen las cosas contra una estrella.
//
// 3. EL NIVEL NO AGREGA ADORNOS, CAMBIA EL MATERIAL. Nada de cintas, estrellas
//    ni bordes dorados. Levantar más no da una medalla más brillante: da un
//    cuerpo más denso, por la misma escalera que ya sube la app —polvo, roca,
//    hielo, planeta, ignición—. El percentil se lee tocando; el material es lo
//    que se ve de lejos.
//
// Y SE SIGUE LA RECETA DE `compartido/insignias.ts`, que ya está probada en
// ocho dibujos: capas planas y no degradados (un `id` repetido en una lista es
// un error que el navegador resuelve callado), una cara oscura y un lado
// iluminado, y la decisión se toma mirando el tamaño de verdad, no el grande.

export type Punto = readonly [number, number];

export type Boceto = {
  clave: string;
  zona: string;
  /** Qué levanta: lo que la medalla representa. */
  pie: string;
  /** Los vértices de la constelación, en una caja de 24×24. */
  puntos: readonly Punto[];
  /** Qué punto se une con cuál. */
  lineas: readonly (readonly [number, number])[];
  /** El vértice que va más grande: el que hace reconocible la figura. */
  faro: number;
  /** La silueta maciza, para el boceto B (tránsito). */
  silueta: string;
};

// ─────────────────────────────────────────────────────────────────────
// LAS CINCO ZONAS
//
// SON CINCO Y NO SEIS. El catálogo tiene piernas, espalda, brazos, pecho,
// hombros y core; core queda afuera **por el propio criterio de solo peso
// libre**: no hay un levantamiento de core con barra o mancuerna cuyos kilos
// signifiquen lo mismo entre dos personas. Una plancha con disco depende de la
// palanca, y un giro ruso depende de cuánto gires. Medirlo sería inventar un
// número comparable donde no lo hay.

export const BOCETOS: readonly Boceto[] = [
  {
    clave: 'brazos',
    zona: 'Brazos',
    pie: 'curl con barra o mancuerna',
    // EL BRAZO FLEXIONADO. Hombro, codo abajo, muñeca arriba: la V angular que
    // hace que esto se reconozca de lejos. El faro es el pico del bíceps, que
    // es lo que uno mira en un brazo flexionado antes que nada.
    puntos: [
      [6, 8],   // 0 hombro
      [9, 16],  // 1 codo
      [17, 11], // 2 muñeca
      [12, 8],  // 3 pico del bíceps
    ],
    lineas: [
      [0, 1],
      [1, 2],
      [0, 3],
      [3, 2],
    ],
    faro: 3,
    silueta: 'M6 8 L9 16 L17 11 L14 8.5 L11 11 L9.5 7.5 Z',
  },
  {
    clave: 'piernas',
    zona: 'Piernas',
    pie: 'sentadilla',
    // LA PIERNA EN SENTADILLA. Cadera, rodilla adelante, tobillo: la Z que se
    // lee como una pierna doblada y no como un rayo. El faro es la rodilla,
    // que es la articulación que define la postura.
    puntos: [
      [8, 5],   // 0 cadera
      [15, 12], // 1 rodilla
      [8, 18],  // 2 tobillo
      [13, 19], // 3 punta del pie
    ],
    lineas: [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
    faro: 1,
    silueta: 'M8 5 L15 12 L8 18 L13 19.5 L16.5 12 L10 4 Z',
  },
  {
    clave: 'pecho',
    zona: 'Pecho',
    pie: 'press de banca',
    // LA BARRA, Y ES LA MÁS FÁCIL DE TODAS: una barra ES dos esferas unidas por
    // una línea, o sea exactamente lo que se ve cuando se mira un sistema
    // binario. Acá el objeto de gimnasio y el objeto celeste son el mismo
    // dibujo, sin traducir nada. Los dos discos van del mismo tamaño: un
    // binario desigual se lee como un planeta con luna.
    puntos: [
      [4, 12],  // 0 disco izquierdo
      [20, 12], // 1 disco derecho
      [12, 12], // 2 centro de la barra
    ],
    lineas: [[0, 1]],
    faro: -1,
    silueta: 'M4 12 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M20 12 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M6 11 h12 v2 h-12 z',
  },
  {
    clave: 'espalda',
    zona: 'Espalda',
    pie: 'peso muerto o remo',
    // LA V DE LA ESPALDA. Dos dorsales abriéndose desde la cintura: un
    // triángulo ancho, que es una forma fuerte en el cielo —es la de casi
    // todas las constelaciones grandes—. El faro va abajo, en la cintura, que
    // es el vértice del que sale todo.
    puntos: [
      [5, 6],   // 0 hombro izquierdo
      [19, 6],  // 1 hombro derecho
      [12, 19], // 2 cintura
      [12, 8],  // 3 columna
    ],
    lineas: [
      [0, 1],
      [0, 2],
      [1, 2],
      [3, 2],
    ],
    faro: 2,
    silueta: 'M5 6 L19 6 L12 19 Z',
  },
  {
    clave: 'hombros',
    zona: 'Hombros',
    pie: 'press militar',
    // EL ARCO SOBRE LA CABEZA. La barra arriba y el deltoides abajo: una línea
    // horizontal sobre una cúpula. Y el hombro es, de todos los músculos, el
    // más cósmico de dibujar — es una esfera, que es de lo único que está
    // hecha esta app.
    puntos: [
      [5, 8],   // 0 punta izquierda de la barra
      [19, 8],  // 1 punta derecha
      [7, 16],  // 2 deltoides izquierdo
      [17, 16], // 3 deltoides derecho
      [12, 13], // 4 cabeza
    ],
    lineas: [
      [0, 1],
      [2, 4],
      [4, 3],
    ],
    faro: 4,
    silueta: 'M5 7 h14 v2 h-14 z M12 11 a5 5 0 0 1 5 5 h-10 a5 5 0 0 1 5 -5 z',
  },
];

// ─────────────────────────────────────────────────────────────────────
// LOS CINCO MATERIALES
//
// La misma escalera que ya sube la app, sin nombrarla: lo que cambia es de qué
// está hecho el cuerpo, no cuántas estrellitas tiene alrededor. Los colores
// salen de `PALETAS_RANGO` para que una medalla no invente un color que la app
// no tenga en ningún otro lado.
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

export const MATERIALES: readonly Material[] = [
  { clave: 'polvo', nombre: 'Polvo', desde: 0, apagado: '#4A4759', principal: '#6E6A82', claro: '#9E9BB0' },
  { clave: 'roca', nombre: 'Roca', desde: 20, apagado: '#7A3A15', principal: '#B4581F', claro: '#E08A3C' },
  { clave: 'hielo', nombre: 'Hielo', desde: 50, apagado: '#5B7BA8', principal: '#7E8CA8', claro: '#C4C2BA' },
  { clave: 'planeta', nombre: 'Planeta', desde: 80, apagado: '#2E4A78', principal: '#4A7FD0', claro: '#DBE7F5' },
  { clave: 'ignicion', nombre: 'Ignición', desde: 95, apagado: '#EF9F27', principal: '#F2C230', claro: '#FFF1C2' },
];

export const materialDe = (percentil: number): Material =>
  [...MATERIALES].reverse().find((m) => percentil >= m.desde) ?? MATERIALES[0];
