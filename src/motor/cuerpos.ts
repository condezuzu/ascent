// Parámetros por cuerpo celeste: paleta (4 paradas), bandas, turbulencia,
// tormenta, anillo, modo. Cada objeto lleva su color real (spec §7):
// Marte naranja de verdad, sin desaturar; asteroide naranja óxido mate;
// sol incandescente; agujero negro con disco de acreción naranja puro.

export type ConfigCuerpo = {
  paleta: [string, string, string, string];
  bandas: number;
  contraste: number;
  turbulencia: number;
  tormenta: number;
  tormentaPos: [number, number];
  anillo: boolean;
  crateres: number;
  modo: 0 | 1 | 2 | 3; // 0 planeta, 1 sol, 2 agujero negro, 3 roca irregular
};

const base: Omit<ConfigCuerpo, 'paleta'> = {
  bandas: 0,
  contraste: 0,
  turbulencia: 0.8,
  tormenta: 0,
  tormentaPos: [0.8, -0.3],
  anillo: false,
  crateres: 0,
  modo: 0,
};

// Rango 4: los diez planetas, de menor a mayor, cada uno con su color real
export const PLANETAS_CFG: Record<string, ConfigCuerpo> = {
  Ceres: { ...base, paleta: ['#3c3e44', '#5a5e66', '#8a8e96', '#c3c6cc'], modo: 3, turbulencia: 1.4 },
  'Plutón': { ...base, paleta: ['#4a4438', '#6e6656', '#a89a82', '#e8dcc8'], turbulencia: 1.1, crateres: 0.5 },
  Mercurio: { ...base, paleta: ['#332f2b', '#565048', '#8b8378', '#b6aea2'], crateres: 0.9, turbulencia: 0.9 },
  // Marte naranja de verdad, sin desaturar: es el planeta rojo y se ve como tal
  Marte: { ...base, paleta: ['#6e1f08', '#a83812', '#d9531e', '#f0925c'], turbulencia: 1.0, crateres: 0.35 },
  Venus: { ...base, paleta: ['#8a7040', '#b89a5e', '#dcc48c', '#f5ecd2'], bandas: 4, contraste: 0.35, turbulencia: 1.8 },
  Tierra: { ...base, paleta: ['#12244e', '#1e4a8e', '#4a7fd0', '#dbe7f5'], turbulencia: 1.5, contraste: 0 },
  Neptuno: { ...base, paleta: ['#0e2258', '#1c3f96', '#3a68d0', '#9db8f0'], bandas: 6, contraste: 0.3, turbulencia: 1.2, tormenta: 0.8, tormentaPos: [1.4, -0.35] },
  Urano: { ...base, paleta: ['#28536b', '#3e7a96', '#7ab4cc', '#c9e6f0'], bandas: 3, contraste: 0.2, turbulencia: 0.6 },
  Saturno: { ...base, paleta: ['#6e6248', '#94845e', '#c4b088', '#ecdfc0'], bandas: 9, contraste: 0.55, turbulencia: 0.9, anillo: true },
  'Júpiter': { ...base, paleta: ['#5a4432', '#8a6a4a', '#c0a078', '#ecd8b8'], bandas: 12, contraste: 0.65, turbulencia: 1.5, tormenta: 1.0, tormentaPos: [0.9, -0.4] },
};

// Objeto de cada rango (el 4 usa el planeta del día)
export const RANGOS_CFG: Record<number, ConfigCuerpo | null> = {
  1: null, // Polvo: partículas, sin cuerpo
  // Asteroide naranja óxido, MATE y desaturado, cubriendo toda la superficie
  // (el naranja del agujero negro es puro y solo en la línea del disco)
  2: { ...base, paleta: ['#3a2214', '#7A3A15', '#B4581F', '#E08A3C'], modo: 3, turbulencia: 1.6 },
  3: { ...base, paleta: ['#3a3f4a', '#565c68', '#8a90a0', '#d0d5e0'], crateres: 1.0, turbulencia: 0.8 },
  4: PLANETAS_CFG['Tierra'],
  // Sol incandescente: blancos que queman con centro dorado
  5: { ...base, paleta: ['#EF9F27', '#F2C230', '#FFF1C2', '#ffffff'], modo: 1, turbulencia: 1.2 },
  6: { ...base, paleta: ['#EF9F27', '#F2C230', '#FFF1C2', '#ffffff'], modo: 1, turbulencia: 1.2 }, // sol central + órbitas
  7: null, // Galaxia: partículas violetas
  // Agujero negro: negro absoluto; el naranja puro va solo en el disco (shader)
  8: { ...base, paleta: ['#05050A', '#4A2A8C', '#FF6A00', '#FFC46B'], modo: 2 },
};

// Densidad del campo estelar de fondo por rango (la galaxia es el ambiente
// permanente: lo que cambia es la densidad, no el escenario)
export const ESTRELLAS_POR_RANGO: Record<number, number> = {
  1: 90, 2: 140, 3: 200, 4: 280, 5: 380, 6: 500, 7: 700, 8: 900,
};
