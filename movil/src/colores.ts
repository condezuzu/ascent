import type { Paleta } from '@nucleo/paletas';

/**
 * LOS COLORES DE LA APP NATIVA, con nombre. Son los mismos papeles que las variables de la web
 * (`--tinta`, `--sub`, `--apagado`, `--linea`…).
 *
 * UNA SOLA PALETA QUE SE REASIGNA (30/10), como `aplicarTema` en la web: `fijarPaleta` la cambia
 * cuando cambia el fondo pedido (`pedidoDeFondo.ts`), y los derivar de `C` son getters. Como
 * `StyleSheet.create` se evalúa una vez, las hojas que usan un teñido van dentro de `conTema` y
 * cada componente llama a `useTema`: se redibuja sin remontar nada, porque remontar la raíz
 * reconstruiría el contexto del motor y perdería la sesión y el Stack.
 *
 * PISO DE 4,5:1 (30/10): todo lo que se lee llega ahí sobre el fondo y sobre la hoja, y lo
 * pinea la sección 321 de test:db. Lo que no se lee, y va atrás a propósito, es `tenue`.
 * `principal` no sirve para texto ni debajo de texto: en los rangos 1 y 6 no llega.
 */

/** El `color-mix(in srgb, A N%, B)` de la web. `cuanto` es el N de `a`, de 0 a 1. */
export function mezclar(a: string, b: string, cuanto: number) {
  const h = (x: string) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
  const [ca, cb] = [h(a), h(b)];
  return '#' + ca.map((v, i) => Math.round(v * cuanto + cb[i] * (1 - cuanto)).toString(16).padStart(2, '0')).join('');
}

/**
 * Un color de la paleta con transparencia. Los colores vienen en hex y React
 * Native no tiene `color-mix`: esto es el `color-mix(in srgb, X N%,
 * transparent)` de la web. Estaba copiado en cuatro archivos (18/9).
 */
export function conAlfa(hex: string, alfa: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

const NEGRO = '#05060a';
const NEGRO_RANGO_7 = '#020204';
const LINEA = '#1d2230';

function derivar(p: Pick<Paleta, 'principal' | 'claro'>, rango: number) {
  return {
    fondo: rango === 7 ? NEGRO_RANGO_7 : NEGRO,
    principal: p.principal,
    claro: p.claro,
    linea: mezclar(p.principal, LINEA, 0.2),
    lineaFuerte: mezclar(p.principal, LINEA, 0.34),
    // Los días de la tira.
    diaLleno: mezclar(p.claro, NEGRO, 0.74),
    diaVacio: mezclar(p.principal, LINEA, 0.3),
    // Los contornos: chip, meta, serie y octágono.
    bordeChip: mezclar(p.principal, LINEA, 0.36),
    bordeMeta: mezclar(p.principal, LINEA, 0.22),
    fondoMeta: conAlfa(p.claro, 0.09),
    bordeSerie: mezclar(p.claro, LINEA, 0.55),
    bordeOcto: mezclar(p.principal, LINEA, 0.3),
    // Los cuadros de la rutina y las barras de Stats.
    cuadro: mezclar(p.claro, NEGRO, 0.7),
    celdaVacia: mezclar(p.principal, '#141824', 0.1),
    barraDentro: mezclar(p.principal, NEGRO, 0.76),
    barraPoco: mezclar(p.principal, LINEA, 0.4),
    barraPista: mezclar(p.principal, '#11141c', 0.07),
    barraFranja: mezclar(p.principal, '#161b26', 0.2),
  };
}

// Hasta el primer pedido de fondo, la Luna: es lo que tenía la app cuando no seguía al rango.
let actual = derivar({ principal: '#7E8CA8', claro: '#C4C2BA' }, 3);
let huella = '';
let version = 0;
const oyentes = new Set<() => void>();

/** Si ya es la paleta que hay no avisa: cambiar de pestaña pide lo mismo y no tiene por qué redibujar. */
export function fijarPaleta(p: Pick<Paleta, 'principal' | 'claro'>, rango: number) {
  const nueva = `${p.principal}${p.claro}${rango === 7}`;
  if (nueva === huella) return;
  huella = nueva;
  actual = derivar(p, rango);
  version++;
  for (const fn of [...oyentes]) fn();
}

export function suscribirPaleta(fn: () => void) {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

export function versionDePaleta() {
  return version;
}

/**
 * Una hoja de estilos que sigue a la paleta: se rearma la primera vez que se la lee después de un
 * cambio. Hacia afuera es la misma `estilos.x` de siempre.
 */
export function conTema<T extends object>(crear: () => T): T {
  let hojas: T | null = null;
  let hechaEn = -1;
  return new Proxy({} as T, {
    get(_, clave) {
      if (!hojas || hechaEn !== version) {
        hojas = crear();
        hechaEn = version;
      }
      return hojas[clave as keyof T];
    },
  });
}

export const C = {
  get fondo() { return actual.fondo; },
  hoja: '#0b0d13',
  tinta: '#e8ecf6',
  sub: '#aab2c4',
  apagado: '#9098ab',
  tenue: '#4a5163',
  // El texto que se apoya directo sobre el motor, sin caja: con `HALO`.
  sobreMotor: '#c2c9d8',
  // Lo que Inicio deja leer con el planeta detrás, en reposo. El anillo del agujero negro pasa de
  // 150 en cada canal: el velo a la mitad no alcanza, y entero taparía el planeta.
  placa: 'rgba(5, 6, 10, 0.66)',
  get linea() { return actual.linea; },
  get lineaFuerte() { return actual.lineaFuerte; },
  get principal() { return actual.principal; },
  get claro() { return actual.claro; },
  get diaLleno() { return actual.diaLleno; },
  get diaVacio() { return actual.diaVacio; },
  diaFuturo: '#232a38',
  get bordeChip() { return actual.bordeChip; },
  get bordeMeta() { return actual.bordeMeta; },
  get fondoMeta() { return actual.fondoMeta; },
  get bordeSerie() { return actual.bordeSerie; },
  get bordeOcto() { return actual.bordeOcto; },
  get cuadro() { return actual.cuadro; },
  get celdaVacia() { return actual.celdaVacia; },
  get barraDentro() { return actual.barraDentro; },
  get barraPoco() { return actual.barraPoco; },
  get barraPista() { return actual.barraPista; },
  get barraFranja() { return actual.barraFranja; },
  // Lo que NO se tiñe: la estrella de las vidas y el aviso de la vida son iguales en todos los rangos.
  crema: '#c4c2ba',
  negro: NEGRO,
  error: '#e8705f',
  // Las superficies sobre el motor, y lo que oscurece detrás de una hoja o de una foto abierta.
  superficie: 'rgba(255, 255, 255, 0.03)',
  tarjeta: 'rgba(11, 13, 19, 0.72)',
  veloHoja: 'rgba(0, 0, 0, 0.6)',
  veloFoto: 'rgba(0, 0, 0, 0.94)',
  globo: '#141824',
  bordeGlobo: '#3a4258',
  // El peso cerca o lejos del objetivo. No son el color del rango: dicen algo.
  bien: '#7fae86',
  lejos: '#c58f7a',
  // El punto de "en vivo": quien está entrenando ahora (Ranking, la entrada).
  vivo: '#5fd08a',
  // EL AVISO DE LA VIDA, CON COLORES FIJOS (19/10): no cambian con el rango.
  // El azul de «Fui. Corregir día»: 8:1 sobre el cuadro.
  link: '#6aa8ff',
  // El borde de «Guardar vida»: 3,6:1 sobre el cuadro, para que se lea como botón.
  bordeBoton: '#626b80',
  // El frío del día congelado.
  hielo: '#8fc4f0',
  hieloClaro: '#bfe0fb',
  // El corazón dado, en la foto abierta: el número va en `fondo` encima, a más de 4,5:1.
  corazon: '#ef6f7f',
  // La mecha de la invitación que llega (29/10): se quema de oscuro a claro, con la chispa en la punta.
  mechaOscura: '#b8562a',
  mecha: '#e8913a',
  chispaClara: '#ffd38a',
  chispa: '#fff3d6',
  // El reflejo que cruza «Aceptar».
  brillo: '#ffffff',
};

/**
 * LA LUZ DE COLOR (30/10). Sobre un fondo casi negro una sombra negra no se ve: lo que da profundidad
 * es que las cosas emitan. Para lo que tiene forma propia (un círculo, una píldora): en la web, y sin
 * fondo también en iOS si no se le da `shadowPath`, la sombra sigue al rectángulo o cuesta píxel por
 * píxel; lo cortado en diagonal lleva su luz dibujada (`FondoOctogonal`).
 */
export function luz(color: string, opacidad: number, radio: number) {
  return { shadowColor: color, shadowOpacity: opacidad, shadowRadius: radio, shadowOffset: { width: 0, height: 0 } };
}

/** Un botón que no se puede tocar. Más bajo y el texto oscuro sobre el sólido del rango 1 pierde el piso de 4,5:1. */
export const DESHABILITADO = 0.85;

/** Lo que separa un texto del motor cuando el planeta le pasa por detrás. */
export const HALO = {
  textShadowColor: 'rgba(5, 6, 10, 0.95)',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 7,
};
