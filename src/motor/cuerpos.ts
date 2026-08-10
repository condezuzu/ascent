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
    paleta: ['#2a241e', '#463b30', '#6b5b4a', '#8f7c66'],
    crateres: 0.85,
    puntos: 0.9,
    turbulencia: 0.9,
  },
  // Manchado, no cratereado: la llanura de nitrógeno clarísima contra las
  // regiones oscuras rojizas, con bordes difusos (la foto de New Horizons).
  'Plutón': {
    ...base,
    paleta: ['#5a4436', '#7d6450', '#a08a6e', '#c9b49a'],
    manchas: 1,
    turbulencia: 1.2,
  },
  // Gris y martillado, el más cratereado de todos
  Mercurio: {
    ...base,
    paleta: ['#2e2b28', '#4f4a45', '#837b72', '#b3aaa0'],
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
    paleta: ['#8a7040', '#b89a5e', '#dcc48c', '#f5ecd2'],
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
    paleta: ['#6e6248', '#94845e', '#c4b088', '#ecdfc0'],
    bandas: 10,
    contraste: 0.5,
    turbulencia: 0.9,
    anillo: true,
  },
  // Bandas marcadas y la mancha girando; tampoco lleva lunas sueltas
  'Júpiter': {
    ...base,
    paleta: ['#5a4432', '#8a6a4a', '#c0a078', '#ecd8b8'],
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
export const ESTRELLAS_POR_RANGO: Record<number, number> = {
  1: 120, 2: 190, 3: 280, 4: 400, 5: 540, 6: 700, 7: 900, 8: 1150,
};
