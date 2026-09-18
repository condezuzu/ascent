// LAS ELIPSES DE LUZ DEL FONDO, las mismas en las dos apps.
//
// La base (lo que se ve antes de que cargue el motor, y siempre que el motor
// no se prende) y el velo (la capa oscura entre el motor y la interfaz) llevan
// cada uno dos elipses teñidas con la paleta del rango: una del color
// principal abajo a la derecha, donde vive el cuerpo, y una del apagado arriba
// a la izquierda. Sin ellas el fondo es un negro plano y la paleta —que es la
// mecánica central de la app— no llega al fondo.
//
// VIVEN ACÁ Y NO EN EL CSS desde el 18/9, cuando la app nativa las necesitó:
// escritas dos veces, en CSS y en `react-native-svg`, la primera que se
// retocara dejaría a las dos apps distintas sin que nadie lo note. La web arma
// su `radial-gradient` con `cssDeElipses` y la nativa su `RadialGradient`.
//
// LAS MEDIDAS SON LAS DE CSS, como fracción de la caja: `rx` del ancho, `ry`
// del alto, el centro en `cx`/`cy`, y la luz se apaga del todo en `hasta` del
// radio. `alfa` es cuánto del color se mezcla (el `color-mix(... N%,
// transparent)` de antes).

export type ColorDePaleta = 'principal' | 'apagado';

export type Elipse = {
  rx: number;
  ry: number;
  cx: number;
  cy: number;
  color: ColorDePaleta;
  alfa: number;
  hasta: number;
};

export const ELIPSES_BASE: Elipse[] = [
  { rx: 0.95, ry: 0.65, cx: 0.8, cy: 0.92, color: 'principal', alfa: 0.3, hasta: 0.62 },
  { rx: 0.8, ry: 0.6, cx: 0.12, cy: 0.06, color: 'apagado', alfa: 0.4, hasta: 0.6 },
];

export const ELIPSES_VELO: Elipse[] = [
  { rx: 1.2, ry: 0.9, cx: 0.85, cy: 0.88, color: 'principal', alfa: 0.26, hasta: 0.6 },
  { rx: 1.0, ry: 0.75, cx: 0.08, cy: 0.06, color: 'apagado', alfa: 0.45, hasta: 0.62 },
];

/** Estrellas sueltas de la base: un punto de 1 px, con su brillo. */
export const ESTRELLAS_BASE: { x: number; y: number; alfa: number }[] = [
  { x: 0.2, y: 0.3, alfa: 0.8 },
  { x: 0.65, y: 0.15, alfa: 0.6 },
  { x: 0.85, y: 0.45, alfa: 0.7 },
  { x: 0.4, y: 0.7, alfa: 0.5 },
  { x: 0.1, y: 0.85, alfa: 0.6 },
];
export const COLOR_ESTRELLA = 'rgb(220, 230, 250)';

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

/**
 * Las elipses como capas de `background` de CSS, con la paleta en variables
 * (`--pal-principal`, `--pal-apagado`) para que el tema las cambie solo.
 */
export function cssDeElipses(elipses: Elipse[]): string {
  return elipses
    .map(
      (e) =>
        `radial-gradient(ellipse ${pct(e.rx)} ${pct(e.ry)} at ${pct(e.cx)} ${pct(e.cy)}, ` +
        `color-mix(in srgb, var(--pal-${e.color}) ${pct(e.alfa)}, transparent), transparent ${pct(e.hasta)})`
    )
    .join(', ');
}

/** Las estrellas de la base como capas de CSS: 1 px con 2 px de caída. */
export function cssDeEstrellas(): string {
  return ESTRELLAS_BASE.map(
    (s) =>
      `radial-gradient(1px 1px at ${pct(s.x)} ${pct(s.y)}, ${COLOR_ESTRELLA.replace('rgb(', 'rgba(').replace(')', `, ${s.alfa})`)}, transparent 2px)`
  ).join(', ');
}
