/**
 * EL LOGO, EN NÚMEROS (20/10): medido sobre `movil/assets/splash.png`. Centro en 0,0 y
 * el aro de radio 38, para dibujarlo en un viewBox de -60 a 60. Los ángulos van en
 * grados, en el sentido de las agujas del reloj desde las tres (y hacia abajo, como SVG).
 */
export const LOGO = { radio: 38, planeta: 26, trazo: 2.4, punto: 4.9, desde: -112, hasta: 149, puntoEn: -38 } as const;

const enRadianes = (g: number) => (g * Math.PI) / 180;
const sobreElAro = (g: number) => [LOGO.radio * Math.cos(enRadianes(g)), LOGO.radio * Math.sin(enRadianes(g))] as const;

/** El aro abierto: dónde arranca, dónde termina y cuánto mide (para dibujarlo de a poco). */
export function arcoDelLogo(): { d: string; largo: number } {
  const [ax, ay] = sobreElAro(LOGO.desde);
  const [bx, by] = sobreElAro(LOGO.hasta);
  const grados = LOGO.hasta - LOGO.desde;
  const r = LOGO.radio;
  const d = `M${ax.toFixed(2)} ${ay.toFixed(2)} A${r} ${r} 0 ${grados > 180 ? 1 : 0} 1 ${bx.toFixed(2)} ${by.toFixed(2)}`;
  return { d, largo: r * enRadianes(grados) };
}

/** El puntito, sobre el aro. */
export function puntoDelLogo(): { x: number; y: number } {
  const [x, y] = sobreElAro(LOGO.puntoEn);
  return { x, y };
}
