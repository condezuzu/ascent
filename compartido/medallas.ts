import { ZONAS_MEDALLA, type ClaveMaterial, type ZonaMedalla } from '@nucleo/medallas';

/**
 * LAS MEDALLAS POR MARCA, COMO DIBUJO: las dibujan las dos apps.
 *
 * QUÉ se gana y con qué está en `nucleo/medallas.ts`. Acá está la forma, y
 * vive en `compartido/` por la misma razón que las insignias de rango: son
 * dibujos afinados a mano y copiarlos a `react-native-svg` sería tenerlos dos
 * veces, con el primer retoque dejando a las dos apps distintas. La web los
 * dibuja con `<svg>` y la nativa con `react-native-svg`; ninguna de las dos
 * sabe qué forma tiene ninguna.
 *
 * ─────────────────────────────────────────────────────────────────────
 * LA IDEA, Y LOS DOS INTENTOS QUE FALLARON ANTES
 *
 * 1. ESQUEMAS DE MOVIMIENTO: un punto en el codo, otro en la muñeca, otro en
 *    la barra. Lo cortó la frase justa — "Orión se reconoce como un hombre, no
 *    como un diagrama de dónde tiene las articulaciones".
 * 2. CONTORNOS: la silueta de cada parte. Arregló piernas y nada más. Pecho
 *    salía una mesa, espalda una nota musical, y hombros se leía pero se leía
 *    "alguien levantando algo", o sea que hacía falta saber de gimnasio.
 *
 * EL DIAGNÓSTICO: lo que hace legible a la pierna NO ES LA PIERNA, ES EL PIE.
 * Un muslo solo es un tubo, igual que un brazo, igual que un cuello; lo que lo
 * vuelve pierna es un final chato que no tiene ninguna otra parte. De ahí la
 * regla: solo se puede dibujar como silueta lo que termina en algo único. El
 * tronco NO TIENE FINAL —es aquello en lo que terminan las demás partes— y por
 * eso pecho, espalda y hombros no tenían arreglo por ese camino. Y explica que
 * hombros saliera explícito: como no tenía forma propia, se lo salvaba con una
 * barra, o sea con el equipamiento que habíamos dicho que no.
 *
 * ─────────────────────────────────────────────────────────────────────
 * LO QUE SE HACE: LA FIGURA ES SIEMPRE LA MISMA, CAMBIA DÓNDE BRILLA
 *
 * Una sola constelación humana, IDÉNTICA en las cinco, en estrellas apagadas.
 * La zona la nombra QUÉ ESTRELLAS ESTÁN ENCENDIDAS. La silueta deja de cargar
 * el significado, y por eso el problema del final único desaparece: ya no se
 * pregunta "¿qué forma es esta?" sino "¿dónde está la luz?", que es la pregunta
 * que contesta cualquiera sin saber de gimnasio.
 *
 * Y es lo que hace una constelación de verdad: la figura es fija y siempre la
 * misma, y lo que se ve son cuatro o cinco estrellas brillantes.
 *
 * LA LUZ SOBREVIVE AL ACHIQUE Y LA LÍNEA NO. A 18 px un contorno se vuelve una
 * mancha; una mancha de luz sigue siendo una mancha de luz y su posición se
 * sigue leyendo. Es lo que decidió el camino, y por eso el cielo se apaga a
 * medida que la medalla se achica (`velo`).
 *
 * DÓNDE CAE LA LUZ EN CADA UNA, que es lo único que las separa:
 *
 *     hombros   arriba del todo, ancho
 *     pecho     al centro, una barra horizontal
 *     espalda   al centro, una V — y la figura de espaldas
 *     brazos    por los costados, dos cadenas que bajan
 *     piernas   abajo, dos cadenas que bajan
 *
 * PECHO CONTRA ESPALDA era el par difícil, y se resolvió primero y solo: si no
 * se distinguían, el camino entero no servía. Van con dos señales
 * independientes —la columna, que solo se ve de espaldas, y la forma de la luz,
 * una barra contra una V—.
 */

export type Punto = readonly [number, number];
export type Linea = readonly [number, number];

/** La caja del dibujo. El cuerpo es un disco de radio 11 centrado en (12,12). */
export const CAJA = 24;
const CENTRO = 12;
const RADIO = 11;

/**
 * LA FIGURA: una persona de pie, de frente, con los brazos algo separados.
 *
 * TODO ENTRA EN EL DISCO. Un vértice en una esquina de la caja quedaría afuera
 * del cuerpo y se dibujaría sobre el fondo de la pantalla; ninguno pasa de 10,2
 * desde el centro.
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
  [9, 18],      // 12 rodilla izquierda
  [15, 18],     // 13 rodilla derecha
  [8.5, 20.6],  // 14 PIE izquierdo
  [15.5, 20.6], // 15 PIE derecho
  [12, 11],     // 16 columna, arriba  — solo de espaldas
  [12, 15],     // 17 cintura
  [12, 10.5],   // 18 esternón         — solo de frente
  [8, 10.5],    // 19 dorsal izquierdo — solo de espaldas
  [16, 10.5],   // 20 dorsal derecho   — solo de espaldas
  [6.4, 9.8],   // 21 brazo alto izquierdo
  [17.6, 9.8],  // 22 brazo alto derecho
];

/**
 * LOS PUNTOS QUE SOLO EXISTEN CUANDO ESTÁN ENCENDIDOS. No son estrellas de la
 * figura: son de dónde agarrarse para dibujar la luz de una zona.
 *
 * Si se dibujaran siempre, aunque fuera apagados, la figura tendría cinco
 * puntos de más y se volvería una grilla. Y con el esternón y la columna sería
 * peor: los dos en el medio del tronco, uno arriba del otro, y la señal de
 * frente contra espaldas se perdería.
 */
const SOLO_ENCENDIDAS: ReadonlySet<number> = new Set([16, 18, 19, 20, 21, 22]);

/** El esqueleto. Está en las cinco, igual. */
const LINEAS: readonly Linea[] = [
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
 * LA COLUMNA: lo único que se dibuja distinto, y solo en la medalla de espalda.
 * Una vertical de estrellas por el medio del tronco dice que a esta persona se
 * la está viendo desde atrás — de frente no hay nada en el medio.
 *
 * VA APAGADA PERO MARCADA, y costó dos intentos: tenue como el resto, la V se
 * la comía; ENCENDIDA era peor, porque una vertical que entra por arriba al
 * vértice de una V es literalmente una flecha hacia abajo y deja de leerse como
 * un cuerpo.
 */
const COLUMNA: readonly Linea[] = [
  [1, 16],
  [16, 17],
];

/**
 * ESTRELLAS QUE NO SON DE NADIE. Lo que convierte el diagrama en un cielo: en
 * una carta celeste la constelación está metida adentro de un campo, no
 * flotando sola en el vacío.
 *
 * `[x, y, radio]`, con radios distintos entre sí a propósito. Son FIJAS:
 * sacarlas de un azar las haría saltar de lugar en cada dibujado.
 */
const POLVO: readonly (readonly [number, number, number])[] = [
  [4.5, 6, 0.45], [6.5, 3.5, 0.3], [8, 4.5, 0.55], [17.5, 4, 0.4],
  [20, 7.5, 0.55], [21.5, 11, 0.3], [2.5, 11.5, 0.5], [3, 15.5, 0.35],
  [20.5, 15, 0.45], [19, 19, 0.3], [5, 19, 0.5], [16, 20.5, 0.35],
];

/**
 * LAS MAGNITUDES DE LAS APAGADAS. Sin esto son diecinueve puntos idénticos, o
 * sea una grilla; en el cielo no hay dos estrellas del mismo brillo. Los
 * extremos —cabeza, manos, pies— van más grandes porque arman la silueta.
 */
const MAGNITUD: Readonly<Record<number, number>> = {
  0: 0.75, 1: 0.5, 2: 0.65, 3: 0.65, 4: 0.5, 5: 0.5,
  6: 0.7, 7: 0.7, 8: 0.4, 9: 0.4, 10: 0.55, 11: 0.55,
  12: 0.5, 13: 0.5, 14: 0.7, 15: 0.7, 16: 0.45, 17: 0.45, 18: 0.4,
  19: 0.4, 20: 0.4, 21: 0.4, 22: 0.4,
};

type Zona = {
  /** Con la columna a la vista: a esta persona se la ve desde atrás. */
  deEspaldas?: boolean;
  encendidas: readonly number[];
  /** Las líneas que arden: son las que le dan FORMA a la luz. */
  brillo: readonly Linea[];
  /** La más brillante. Cae en el final de la zona: la mano, el pie, la cintura. */
  faro: number;
};

export const ZONAS: Readonly<Record<ZonaMedalla, Zona>> = {
  // ARRIBA DEL TODO Y ANCHO. Las clavículas atan los dos puntos: sueltos son
  // dos manchitas que a 18 px pueden ser cualquier cosa; unidos son una forma
  // ancha, y el ancho es lo que dice "hombros". Sin ninguna barra.
  hombros: { encendidas: [2, 3], brillo: [[1, 2], [1, 3]], faro: 2 },
  // POR LOS COSTADOS, el único lugar donde la luz queda pegada al borde.
  // Arrancan DEBAJO del hombro: si empezaran en su estrella, brazos contendría
  // a hombros y aquella se leería como "brazos sin los brazos".
  brazos: {
    encendidas: [21, 4, 6, 22, 5, 7],
    brillo: [[21, 4], [4, 6], [22, 5], [5, 7]],
    faro: 6,
  },
  // UNA BARRA HORIZONTAL: tres estrellas en fila y las dos líneas que las unen.
  // Ancha y de poca altura, que es la forma más distinta que hay de un triángulo.
  pecho: { encendidas: [8, 18, 9], brillo: [[8, 18], [18, 9]], faro: 18 },
  // DE ESPALDAS, y una V que abre en los dorsales y cierra en la cintura. Abre
  // en los dorsales y no en los hombros para no pisar la medalla de hombros.
  espalda: {
    deEspaldas: true,
    encendidas: [19, 20, 17],
    brillo: [[19, 17], [20, 17]],
    faro: 17,
  },
  // ABAJO. La única cuya luz vive en la mitad inferior, así que no se parece a
  // ninguna otra ni achicada. El pie es el faro: era lo que hacía legible a la
  // pierna cuando se dibujaban siluetas, y sigue siendo lo que la nombra.
  piernas: {
    encendidas: [10, 12, 14, 11, 13, 15],
    brillo: [[10, 12], [12, 14], [11, 13], [13, 15]],
    faro: 14,
  },
};

/** Una mancha de la nebulosa. Solo la galaxia tiene. */
export type Mancha = {
  cx: number; cy: number; rx: number; ry: number;
  /** Grados. */
  giro: number;
  color: string;
  opacidad: number;
};

export type Material = {
  nombre: string;
  /**
   * LA CARA DEL CUERPO, Y ES CIELO. Acá estuvo el error del primer dibujado:
   * la cara era el color del rango, o sea clara, y las estrellas apagadas se
   * perdían encima. Y si la figura no se ve, "dónde brilla" no tiene a qué
   * referirse: la medalla vuelve a ser una marca abstracta.
   */
  noche: string;
  apagado: string;
  principal: string;
  claro: string;
  nebulosa?: readonly Mancha[];
};

/**
 * LOS MATERIALES son CUERPOS DE LA APP y no metales: luna, planeta y estrella
 * con las paletas de los rangos 3, 4 y 5, y galaxia con la del 7.
 *
 * LOS TRES CORTES —50, 80 y 95— son percentiles que publica la propia fuente.
 * LA GALAXIA NO ES UN CORTE: arriba del 95 la fuente no tiene nada y `ubicar()`
 * corta ahí a propósito, porque "la tabla no tiene con qué separar al 96 del
 * 99,9". Se gana por otro eje —estrella en las tres del DOTS— y eso lo decide
 * `nucleo/medallas.ts`.
 *
 * GALAXIA Y NO AGUJERO NEGRO: un agujero negro es ausencia de luz, y todo el
 * lenguaje de esto es "la zona es donde brilla"; a 18 px sería un punto oscuro
 * al lado del nombre, o sea un agujero en la fila; y es el rango 8, lo último
 * que hay en la app, así que gastarlo acá sería mostrar el final antes de que
 * nadie llegue (§7).
 */
export const MATERIALES: Readonly<Record<ClaveMaterial, Material>> = {
  luna: { nombre: 'Luna', noche: '#1B2536', apagado: '#3A4A63', principal: '#7E8CA8', claro: '#D6D4CA' },
  planeta: { nombre: 'Planeta', noche: '#121C30', apagado: '#27395C', principal: '#4A7FD0', claro: '#DBE7F5' },
  estrella: { nombre: 'Estrella', noche: '#2A1D06', apagado: '#5A420F', principal: '#F2C230', claro: '#FFF1C2' },
  galaxia: {
    nombre: 'Galaxia',
    noche: '#180F2E',
    apagado: '#3A2268',
    principal: '#7F4FD0',
    // Más clara que el `claro` del rango 7: acá este color son las estrellas y
    // tienen que ganarle a la nebulosa que está abajo.
    claro: '#F0E4FF',
    // SIN ANIMACIÓN Y SIN DEGRADADOS, a pedido. Un degradado radial daría un
    // halo concéntrico; una nebulosa es polvo tirado de costado, y eso solo lo
    // dan elipses planas CRUZADAS a distintos ángulos y tonos.
    //
    // Todas las opacidades quedaron un punto por debajo de lo que pedía el ojo:
    // con la nebulosa más fuerte la constelación se perdía adentro. El material
    // dice cuánto vale la medalla; la luz dice de qué es.
    nebulosa: [
      { cx: 12, cy: 12, rx: 10.5, ry: 4.4, giro: -24, color: '#7F4FD0', opacidad: 0.4 },
      { cx: 12, cy: 12, rx: 7.8, ry: 2.5, giro: -24, color: '#A86BE8', opacidad: 0.34 },
      { cx: 9.2, cy: 13.8, rx: 5.4, ry: 2.1, giro: 20, color: '#C2469B', opacidad: 0.24 },
      { cx: 14.8, cy: 10.4, rx: 4.6, ry: 1.7, giro: 14, color: '#4A7FD0', opacidad: 0.2 },
      { cx: 12, cy: 12, rx: 2.7, ry: 1.5, giro: -24, color: '#E9D8FF', opacidad: 0.34 },
    ],
  },
};

export type Trazo =
  | { t: 'circulo'; cx: number; cy: number; r: number; color: string; op?: number }
  | { t: 'elipse'; cx: number; cy: number; rx: number; ry: number; giro: number; color: string; op?: number }
  | { t: 'linea'; x1: number; y1: number; x2: number; y2: number; color: string; ancho: number; op?: number };

/**
 * TODO LO QUE HAY QUE DIBUJAR, en tres grupos, para que las dos apps pinten lo
 * mismo sin saber qué están pintando.
 *
 * `cielo` VA RECORTADO contra el disco y los otros dos no. Sin ese recorte, el
 * halo de una estrella del borde —un pie, una mano— se dibuja afuera del cuerpo
 * y sobre el fondo de la pantalla; a 18 px, mucho. El borde queda afuera del
 * recorte porque recortado contra sí mismo perdería la mitad de su grosor.
 */
export function trazosDeMedalla(
  zona: ZonaMedalla,
  material: Material,
  tam: number
): { base: Trazo[]; cielo: Trazo[]; borde: { color: string; op: number } } {
  const z = ZONAS[zona];
  const encendidas = new Set(z.encendidas);

  // NADA ESCALA LINEALMENTE: a 18 px un radio proporcional desaparece, así que
  // los puntos y las líneas llevan un piso.
  const k = Math.max(1, 34 / tam);

  // EL CIELO SE APAGA A MEDIDA QUE LA MEDALLA SE ACHICA, y es la premisa del
  // camino llevada hasta el final: a 18 px, treinta y un puntos con el piso de
  // radio que necesitan para no desaparecer no son una figura, son una mancha
  // moteada, y entierran la luz que tiene que leerse. La figura es andamio para
  // el ojo cuando hay lugar; a ese tamaño no lo hay y no la mira nadie.
  //
  // VA EN RAMPA Y NO EN UN CORTE: con un corte, la misma medalla a 32 y a 44
  // parecía de dos familias.
  const velo = Math.min(1, Math.max(0.2, (tam - 24) / 40));

  const base: Trazo[] = [
    { t: 'circulo', cx: CENTRO, cy: CENTRO, r: RADIO, color: material.noche },
  ];
  for (const m of material.nebulosa ?? []) {
    base.push({ t: 'elipse', cx: m.cx, cy: m.cy, rx: m.rx, ry: m.ry, giro: m.giro, color: m.color, op: m.opacidad });
  }

  const cielo: Trazo[] = [];
  const linea = (l: Linea, ancho: number, op: number) =>
    cielo.push({
      t: 'linea',
      x1: PUNTOS[l[0]][0], y1: PUNTOS[l[0]][1],
      x2: PUNTOS[l[1]][0], y2: PUNTOS[l[1]][1],
      color: material.claro, ancho, op,
    });

  // El campo, primero y muy apagado: es el cielo del que la constelación forma
  // parte, no un adorno encima.
  for (const [x, y, r] of POLVO) {
    cielo.push({ t: 'circulo', cx: x, cy: y, r: r * k, color: material.claro, op: 0.4 * velo });
  }
  // Las líneas UNEN, no dibujan: por eso van tan apagadas.
  for (const l of LINEAS) linea(l, 0.35 * k, 0.5 * velo);
  if (z.deEspaldas) for (const l of COLUMNA) linea(l, 0.55 * k, 0.8 * velo);

  PUNTOS.forEach(([x, y], i) => {
    if (SOLO_ENCENDIDAS.has(i) || encendidas.has(i)) return;
    cielo.push({ t: 'circulo', cx: x, cy: y, r: (MAGNITUD[i] ?? 0.5) * k, color: material.claro, op: 0.85 * velo });
  });

  // LO QUE ARDE. Las líneas primero, que son las que le dan forma a la luz —una
  // barra o una V— y eso se lee antes que los puntos.
  for (const l of z.brillo) linea(l, 1 * k, 0.9);
  for (const i of z.encendidas) {
    const [x, y] = PUNTOS[i];
    const r = (i === z.faro ? 1.35 : 1.05) * k;
    // El halo: una estrella brillante no es un punto más grande, es un punto
    // con luz alrededor.
    cielo.push({ t: 'circulo', cx: x, cy: y, r: r * 2.4, color: material.claro, op: 0.18 });
    cielo.push({ t: 'circulo', cx: x, cy: y, r, color: material.claro });
  }

  return {
    base,
    cielo,
    // El borde es lo que la despega del fondo cuando es chica. NO es un trazo
    // de la lista porque va DIBUJADO Y NO RELLENO, y porque queda afuera del
    // recorte: recortado contra sí mismo perdería la mitad de su grosor.
    borde: { color: material.claro, op: 0.35 },
  };
}

/** El lado iluminado: lo que separa un objeto de un disco plano. */
export const LADO_ILUMINADO = 'M12 1 a11 11 0 0 1 0 22 a8.5 11 0 0 0 0 -22 z';

export { ZONAS_MEDALLA };
