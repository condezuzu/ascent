import type { ImageSourcePropType } from 'react-native';

/**
 * LOS CUERPOS DE LA ENTRADA (28/11, la D de la galería 31): una foto de cada cuerpo, sacada del motor, para
 * el viaje del logo a Inicio. Se mueve una imagen y no el motor porque la imagen viaja con el driver nativo
 * aunque el hilo de JS esté ocupado; al llegar, debajo ya está el motor con el mismo cuerpo en el mismo lugar.
 *
 * `fraccion` es el radio del cuerpo sobre el ancho de la imagen. Las genera
 * `cuerpos-app.mjs` desde las fotos del motor: si cambia un cuerpo, se vuelven a sacar.
 */
export type CuerpoDeEntrada = { foto: ImageSourcePropType; brillo: ImageSourcePropType; fraccion: number };

/* eslint-disable @typescript-eslint/no-require-imports */
const CUERPOS: Record<string, CuerpoDeEntrada> = {
  '1': { foto: require('../assets/cuerpos/cuerpo-1.webp'), brillo: require('../assets/cuerpos/cuerpo-1-brillo.webp'), fraccion: 0.3712 },
  '2': { foto: require('../assets/cuerpos/cuerpo-2.webp'), brillo: require('../assets/cuerpos/cuerpo-2-brillo.webp'), fraccion: 0.3238 },
  '3': { foto: require('../assets/cuerpos/cuerpo-3.webp'), brillo: require('../assets/cuerpos/cuerpo-3-brillo.webp'), fraccion: 0.3238 },
  'ceres': { foto: require('../assets/cuerpos/cuerpo-ceres.webp'), brillo: require('../assets/cuerpos/cuerpo-ceres-brillo.webp'), fraccion: 0.3238 },
  'mercurio': { foto: require('../assets/cuerpos/cuerpo-mercurio.webp'), brillo: require('../assets/cuerpos/cuerpo-mercurio-brillo.webp'), fraccion: 0.3238 },
  'marte': { foto: require('../assets/cuerpos/cuerpo-marte.webp'), brillo: require('../assets/cuerpos/cuerpo-marte-brillo.webp'), fraccion: 0.3238 },
  'venus': { foto: require('../assets/cuerpos/cuerpo-venus.webp'), brillo: require('../assets/cuerpos/cuerpo-venus-brillo.webp'), fraccion: 0.3238 },
  'saturno': { foto: require('../assets/cuerpos/cuerpo-saturno.webp'), brillo: require('../assets/cuerpos/cuerpo-saturno-brillo.webp'), fraccion: 0.2024 },
  '5': { foto: require('../assets/cuerpos/cuerpo-5.webp'), brillo: require('../assets/cuerpos/cuerpo-5-brillo.webp'), fraccion: 0.3345 },
  '6': { foto: require('../assets/cuerpos/cuerpo-6.webp'), brillo: require('../assets/cuerpos/cuerpo-6-brillo.webp'), fraccion: 0.4641 },
  '7': { foto: require('../assets/cuerpos/cuerpo-7.webp'), brillo: require('../assets/cuerpos/cuerpo-7-brillo.webp'), fraccion: 0.2300 },
};

/** El del rango; en el 4, el del planeta que toca. */
export function cuerpoDeEntrada(rango: number, planeta: string | null): CuerpoDeEntrada | null {
  if (rango === 4) return planeta ? (CUERPOS[planeta.toLowerCase()] ?? null) : null;
  return CUERPOS[String(rango)] ?? null;
}
