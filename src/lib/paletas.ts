// Paletas por rango — LA MECÁNICA CENTRAL del proyecto (spec §7).
// Cada rango define tres colores (apagado / principal / claro) y cambian
// TODA la app: acentos, bordes, botón, barra de progreso, íconos activos.
// Ningún color de acento se escribe suelto en un componente: todo sale de acá
// vía variables CSS (--pal-apagado, --pal-principal, --pal-claro).

export type Paleta = {
  apagado: string;
  principal: string;
  claro: string;
};

// Tabla de la spec, tal cual.
export const PALETAS_RANGO: Record<number, Paleta> = {
  // POLVO. Frío y humilde, pero NO gris.
  //
  // Era gris puro —#4A4945 / #6E6C66 / #9C9A92, saturación cero— y esta paleta
  // no tiñe solo el fondo: es la mecánica central del proyecto y pinta acentos,
  // bordes, botones, la barra de progreso y hasta las estrellas. O sea que el
  // rango 1, que es lo primero que ve TODO el mundo, mostraba la app entera en
  // blanco y negro. Lo dijo alguien que la vio por primera vez: "se ve
  // aburrida"; el diagnóstico no era que faltaran animaciones, era que no había
  // un solo color.
  //
  // El tinte sale de la nebulosa que ya está detrás (`NEBULOSA` en
  // `motor/cuerpos.ts`: violeta, azul, lila). El polvo espacial de verdad no es
  // gris y el fondo ya lo sabía; la interfaz no.
  //
  // MISMA LUMINOSIDAD QUE ANTES, a propósito: 74 / 110 / 158, clavado. Sigue
  // siendo el más apagado de los ocho —menos saturado incluso que la Luna— así
  // que la idea de ganarse el color queda intacta. Lo que se saca es el cero.
  1: { apagado: '#4A4759', principal: '#6E6A82', claro: '#9E9BB0' }, // Polvo
  2: { apagado: '#7A3A15', principal: '#B4581F', claro: '#E08A3C' }, // Asteroide: óxido mate
  3: { apagado: '#5B7BA8', principal: '#7E8CA8', claro: '#C4C2BA' }, // Luna: celeste alrededor
  4: { apagado: '#2E4A78', principal: '#4A7FD0', claro: '#DBE7F5' }, // Planeta (respaldo; manda el planeta del día)
  5: { apagado: '#EF9F27', principal: '#F2C230', claro: '#FFF1C2' }, // Sol
  6: { apagado: '#0E6B6B', principal: '#1FA5A0', claro: '#6FD6D0' }, // Sistema
  7: { apagado: '#4A2A8C', principal: '#7F4FD0', claro: '#C3A6F5' }, // Galaxia
  8: { apagado: '#05050A', principal: '#FF6A00', claro: '#A78BFA' }, // Agujero negro
};

// Rango 4: la paleta la define el planeta del día — cambia diez veces
// dentro del mismo rango. Marte va naranja de verdad, sin desaturar.
export const PALETAS_PLANETA: Record<string, Paleta> = {
  Ceres: { apagado: '#4A4C52', principal: '#7A828E', claro: '#B8C0CC' },
  'Plutón': { apagado: '#5A5348', principal: '#8E8574', claro: '#D8CFC0' },
  Mercurio: { apagado: '#4A4440', principal: '#7E766E', claro: '#B5ADA4' },
  Marte: { apagado: '#8A2E10', principal: '#D9531E', claro: '#F0925C' },
  Venus: { apagado: '#8A7A4A', principal: '#C9B278', claro: '#F0E4C2' },
  Tierra: { apagado: '#1E4A8E', principal: '#3D7BD0', claro: '#D6E8F5' },
  Neptuno: { apagado: '#1C3F96', principal: '#3A68D0', claro: '#9DB8F0' },
  Urano: { apagado: '#3E7A96', principal: '#5FA8C4', claro: '#C9E6F0' },
  Saturno: { apagado: '#6E6248', principal: '#B0A078', claro: '#E8DCBE' },
  'Júpiter': { apagado: '#6E523E', principal: '#B08662', claro: '#E8D0B0' },
};

// El agujero negro tiene el negro más profundo de todos los rangos.
export const FONDO_BASE = '#05060a';
export const FONDO_RANGO_8 = '#020204';

export function paletaDe(rango: number, planeta?: string | null): Paleta {
  if (rango === 4 && planeta && PALETAS_PLANETA[planeta]) return PALETAS_PLANETA[planeta];
  return PALETAS_RANGO[rango] ?? PALETAS_RANGO[1];
}

// Aplica la paleta a toda la app reasignando el único set de variables CSS.
export function aplicarTema(rango: number, planeta?: string | null) {
  const p = paletaDe(rango, planeta);
  const raiz = document.documentElement.style;
  raiz.setProperty('--pal-apagado', p.apagado);
  raiz.setProperty('--pal-principal', p.principal);
  raiz.setProperty('--pal-claro', p.claro);
  raiz.setProperty('--fondo', rango === 8 ? FONDO_RANGO_8 : FONDO_BASE);
}
