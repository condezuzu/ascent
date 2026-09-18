// Parámetros por cuerpo celeste. Cada objeto lleva su color real (spec §7):
// Marte naranja de verdad, asteroide naranja óxido mate, sol incandescente,
// agujero negro con disco de acreción naranja puro sobre negro absoluto.
//
// Y cada planeta tiene además su identidad de forma, no solo de color:
// bandas, casquetes polares, continentes, cráteres, anillo y lunas.

export type ConfigCuerpo = {
  paleta: [string, string, string, string];
  bandas: number;
  contraste: number;
  turbulencia: number;
  tormenta: number;
  tormentaPos: [number, number];
  anillo: boolean;
  anilloVertical: boolean; // Urano lo tiene casi de canto
  crateres: number;
  casquetes: number;
  continentes: number;
  puntos: number; // depósitos brillantes: la marca de Ceres
  mares: number; // manchas oscuras grandes: solo la Luna
  manchas: number; // zonas de hielo claro y oscuro: Plutón
  rayos: number; // estrías claras de cráteres jóvenes: la Luna
  lunas: number;
  // 0 planeta, 1 sol, 2 agujero negro, 3 roca, 4 aurora, 5 nebulosa
  modo: 0 | 1 | 2 | 3 | 4 | 5;
};

const base: Omit<ConfigCuerpo, 'paleta'> = {
  bandas: 0,
  contraste: 0,
  turbulencia: 0.8,
  tormenta: 0,
  tormentaPos: [0.8, -0.3],
  anillo: false,
  anilloVertical: false,
  crateres: 0,
  casquetes: 0,
  continentes: 0,
  puntos: 0,
  mares: 0,
  manchas: 0,
  rayos: 0,
  lunas: 0,
  modo: 0,
};

// Rango 4: los diez planetas, de menor a mayor, cada uno reconocible
export const PLANETAS_CFG: Record<string, ConfigCuerpo> = {
  // Enano oscuro y terroso, con los depósitos de sal brillantes que son su
  // marca. Nada de gris lunar: tiene que distinguirse de la Luna a simple vista.
  Ceres: {
    ...base,
    // EL FILO LO DOMINA LA ROCA CARBONACEA, no las sales. Ceres es el cuerpo
    // MAS OSCURO de todos: refleja un 9% de la luz que le llega, menos que la
    // Luna. Las sales de Occator son brillantisimas pero son manchas chicas —
    // eso ya lo dibuja `puntos`— y no son lo que se ve en el canto.
    // Asi que su filo es gris FRIO y APAGADO: el mas tenue de los diez.
    paleta: ['#1e2228', '#333a44', '#5c6a76', '#8e9aa4'],
    crateres: 0.85,
    puntos: 0.9,
    turbulencia: 0.9,
  },
  // Manchado, no cratereado: la llanura de nitrógeno clarísima contra las
  // regiones oscuras rojizas, con bordes difusos (la foto de New Horizons).
  'Plutón': {
    ...base,
    // EL FILO LO DOMINAN LAS TOLINAS, los compuestos organicos de su niebla,
    // que son lo que le da a Pluton el color rosado-butterscotch inconfundible
    // de las fotos de la New Horizons. Y es un cuerpo CLARO —refleja entre 50 y
    // 65%, por el hielo— asi que su filo es rosa y brillante, no apagado.
    paleta: ['#34211e', '#6b3f33', '#b08878', '#f0c4b4'],
    manchas: 1,
    turbulencia: 1.2,
  },
  // Gris y martillado, el más cratereado de todos
  Mercurio: {
    ...base,
    // EL FILO LO DOMINA EL REGOLITO OSCURECIDO POR CARBONO. Mercurio es mas
    // oscuro que la Luna (14% contra 12... y contra el 9% de Ceres), y su rasgo
    // optico propio no es un color sino la falta de el: neutro y apagado.
    // Se separa de Ceres por TEMPERATURA y por brillo, no por tono: Ceres frio
    // y mas tenue, este neutro-calido y un poco mas claro.
    paleta: ['#26252a', '#453f3a', '#7d746a', '#b9b2ac'],
    crateres: 1.0,
    turbulencia: 0.8,
  },
  // Naranja de verdad, con casquetes de hielo seco. Sin cráteres: así estaba
  // bien y agregárselos lo empeoró.
  Marte: {
    ...base,
    paleta: ['#6e1f08', '#a83812', '#d9531e', '#f0925c'],
    casquetes: 0.85,
    turbulencia: 1.1,
  },
  // Tapado de nubes: nunca se le ve la superficie
  Venus: {
    ...base,
    // NO CAQUI. El caqui la hacia leer como gas sucio; Venus es una capa de
    // nubes espesas y palidas, asi que va hacia el marfil calido. Ademas la
    // separa de Saturno, que se queda con el amarillo.
    paleta: ['#5e4a3a', '#a08064', '#e2c8ac', '#fff4e8'],
    bandas: 5,
    contraste: 0.3,
    turbulencia: 2.2,
  },
  // Océano, continentes, nubes, casquetes y una luna
  Tierra: {
    ...base,
    paleta: ['#0b1e42', '#12244e', '#1e4a8e', '#dbe7f5'],
    continentes: 1,
    casquetes: 0.6,
    turbulencia: 1.4,
    lunas: 1,
  },
  // Azul profundo con su mancha oscura
  Neptuno: {
    ...base,
    paleta: ['#0e2258', '#1c3f96', '#3a68d0', '#9db8f0'],
    bandas: 7,
    contraste: 0.32,
    turbulencia: 1.3,
    tormenta: 0.9,
    tormentaPos: [1.4, -0.35],
    lunas: 1,
  },
  // Celeste liso, con el anillo casi vertical que lo delata
  Urano: {
    ...base,
    paleta: ['#28536b', '#3e7a96', '#7ab4cc', '#c9e6f0'],
    bandas: 3,
    contraste: 0.16,
    turbulencia: 0.55,
    anillo: true,
    anilloVertical: true,
  },
  // El del anillo, con sus divisiones. Sin lunas: el anillo ya lo identifica
  // y los satélites sueltos ensuciaban la composición.
  Saturno: {
    ...base,
    // MAS AMARILLO. En cara nocturna lo que se ve es el filo, que sale de
    // los dos colores claros: son ESOS los que tienen que llevar el color.
    paleta: ['#6b5c34', '#9c8842', '#d8bf6a', '#f6ecc4'],
    bandas: 10,
    contraste: 0.5,
    turbulencia: 0.9,
    anillo: true,
  },
  // Bandas marcadas y la mancha girando; tampoco lleva lunas sueltas
  'Júpiter': {
    ...base,
    // MAS NARANJA, pero un naranja AMBAR y no el rojo de Marte: los dos van
    // para el mismo lado y tienen que poder distinguirse de un vistazo.
    // Marte es rojo y mas saturado; este es mas claro y mas amarillo.
    paleta: ['#5a3520', '#96622f', '#d8975a', '#f5d3a8'],
    bandas: 13,
    contraste: 0.62,
    turbulencia: 1.6,
    tormenta: 1.0,
    tormentaPos: [0.9, -0.4],
  },
};

// Objeto de cada rango (el 4 usa el planeta del día)
export const RANGOS_CFG: Record<number, ConfigCuerpo | null> = {
  1: null, // Polvo: partículas, sin cuerpo
  // Asteroide: piedra maciza e irregular, con crestas y facetas. La
  // turbulencia alta la hacía parecer líquido: acá manda el ruido "ridged".
  2: {
    ...base,
    paleta: ['#241408', '#5c2a10', '#95491a', '#c9762e'],
    modo: 3,
    turbulencia: 0.5,
    crateres: 0.75,
  },
  // Luna: gris mineral, cráteres, mares oscuros y los rayos claros que
  // dejan los cráteres jóvenes
  3: {
    ...base,
    paleta: ['#3c3f46', '#5c6069', '#949aa5', '#d8dce4'],
    crateres: 1.0,
    mares: 1,
    rayos: 0.6,
    turbulencia: 0.7,
  },
  4: PLANETAS_CFG['Tierra'],
  // Sol incandescente con protuberancias
  5: { ...base, paleta: ['#EF9F27', '#F2C230', '#FFF1C2', '#ffffff'], modo: 1, turbulencia: 1.3 },
  6: { ...base, paleta: ['#EF9F27', '#F2C230', '#FFF1C2', '#ffffff'], modo: 1, turbulencia: 1.3 },
  7: null, // Galaxia: partículas
  // Agujero negro: negro absoluto; el naranja puro va solo en el disco
  8: { ...base, paleta: ['#05050A', '#4A2A8C', '#FF6A00', '#FFC46B'], modo: 2 },
};

// Densidad del campo estelar de fondo por rango (la galaxia es el ambiente
// permanente: lo que cambia es la densidad, no el escenario)
// EL RANGO 1 SUBE DE 120 A 400. Tenía la décima parte de las estrellas que el
// agujero negro, y encima grises —el campo se tiñe con la paleta del rango—,
// así que quien recién empieza veía un cielo casi vacío y sin color.
//
// 400 no es un número inventado: es exactamente lo que ya tiene el rango 4, que
// está medido y anda. Y las partículas NO son el costo del motor: 0,006 ms por
// cuadro. Lo que se paga por píxel es el ÁREA pintada, así que se sube la
// cantidad y el brillo, nunca el tamaño.
export const ESTRELLAS_POR_RANGO: Record<number, number> = {
  1: 400, 2: 440, 3: 500, 4: 560, 5: 640, 6: 760, 7: 900, 8: 1150,
};
