import type { ComponentType, ReactNode } from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { CAJA_INSIGNIA, coloresDeInsignia, INSIGNIAS, type ColorInsignia, type Trazo } from '@compartido/insignias';

// La insignia de un rango, en la app nativa. QUÉ se dibuja vive en
// `compartido/insignias.ts`, lo mismo que dibuja la web; acá solo se traduce a
// `react-native-svg`.
export default function Insignia({ rango, tam = 24 }: { rango: number; tam?: number }) {
  const trazos = INSIGNIAS[rango];
  if (!trazos) return null;
  const colores = coloresDeInsignia(rango);
  return (
    <Svg width={tam} height={tam} viewBox={`0 0 ${CAJA_INSIGNIA} ${CAJA_INSIGNIA}`} pointerEvents="none">
      {trazos.map((t, i) => dibujar(t, i, colores))}
    </Svg>
  );
}

const COMPONENTE = { circle: Circle, ellipse: Ellipse, path: Path } as const;

function dibujar(t: Trazo, clave: number, colores: Record<ColorInsignia, string>): ReactNode {
  const pintar = (c: ColorInsignia | 'none' | undefined) => (c === undefined || c === 'none' ? c : colores[c]);
  const { t: tipo, fill, stroke, ...resto } = t;
  const props = { ...resto, fill: pintar(fill), stroke: pintar(stroke) };
  if (tipo === 'g') {
    const { hijos, ...g } = props as typeof props & { hijos: Trazo[] };
    return (
      <G key={clave} {...g}>
        {hijos.map((h, i) => dibujar(h, i, colores))}
      </G>
    );
  }
  // Cada trazo trae los atributos de SU forma (`cx`/`r`, `rx`/`ry`, `d`), que
  // es lo que dice el tipo `Trazo`; el componente no puede saberlo de antemano.
  const Forma = COMPONENTE[tipo] as unknown as ComponentType<Record<string, unknown>>;
  return <Forma key={clave} {...props} />;
}
