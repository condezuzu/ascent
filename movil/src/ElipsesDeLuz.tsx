import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { Paleta } from '@nucleo/paletas';
import { COLOR_ESTRELLA, ESTRELLAS_BASE, type Elipse } from '@compartido/fondoDegradados';

/**
 * LAS ELIPSES DE LUZ DEL FONDO, en la app nativa. Las mismas que la web arma
 * en CSS: los números viven en `compartido/fondoDegradados.ts`.
 *
 * UNA ELIPSE SE DIBUJA COMO CÍRCULO ACHATADO. `RadialGradient` acepta `rx` y
 * `ry` en el teléfono, pero la vista web de la app nativa (`:8090`) lo
 * traduce a un `<radialGradient>` de SVG, que solo entiende `r`: ahí la
 * elipse saldría redonda. Con `r` igual al radio horizontal y una escala
 * vertical alrededor del centro sale igual en los dos lados.
 *
 * LA LUZ SE APAGA HACIA EL MISMO COLOR con alfa 0, y no hacia `transparent`:
 * CSS mezcla premultiplicado y SVG no, y hacia negro transparente el borde de
 * la elipse ensuciaría el color.
 *
 * LAS ESTRELLAS SON UNA APROXIMACIÓN. En CSS son un punto de 1 px que se
 * apaga en 2 px; acá, un círculo de 1 px con la mitad del brillo, que a la
 * vista queda igual.
 */
export default function ElipsesDeLuz({
  elipses,
  paleta,
  ancho,
  alto,
  estrellas = false,
  id,
}: {
  elipses: Elipse[];
  paleta: Paleta;
  ancho: number;
  alto: number;
  estrellas?: boolean;
  /** Prefijo de los ids de los degradados: dos capas no pueden repetirlos. */
  id: string;
}) {
  return (
    <Svg width={ancho} height={alto} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        {elipses.map((e, i) => {
          const cx = e.cx * ancho;
          const cy = e.cy * alto;
          const rx = e.rx * ancho;
          const k = (e.ry * alto) / rx;
          const color = paleta[e.color];
          return (
            <RadialGradient
              key={i}
              id={`${id}-${i}`}
              gradientUnits="userSpaceOnUse"
              cx={cx}
              cy={cy}
              fx={cx}
              fy={cy}
              r={rx}
              gradientTransform={`translate(0 ${cy * (1 - k)}) scale(1 ${k})`}
            >
              <Stop offset="0" stopColor={color} stopOpacity={e.alfa} />
              <Stop offset={e.hasta} stopColor={color} stopOpacity={0} />
            </RadialGradient>
          );
        })}
      </Defs>
      {/* El orden es el de CSS al revés: allá la primera capa va arriba; acá
          arriba va lo último que se dibuja. */}
      {estrellas &&
        ESTRELLAS_BASE.map((s, i) => (
          <Circle key={`e${i}`} cx={s.x * ancho} cy={s.y * alto} r={1} fill={COLOR_ESTRELLA} opacity={s.alfa * 0.5} />
        ))}
      {elipses
        .map((_, i) => i)
        .reverse()
        .map((i) => (
          <Rect key={i} x={0} y={0} width={ancho} height={alto} fill={`url(#${id}-${i})`} />
        ))}
    </Svg>
  );
}
