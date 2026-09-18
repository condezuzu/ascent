import { createElement, type ReactNode } from 'react';
import {
  CAJA_INSIGNIA,
  coloresDeInsignia,
  INSIGNIAS,
  type ColorInsignia,
  type Trazo,
} from '@compartido/insignias';

// La insignia de un rango, en la web. QUÉ se dibuja —y por qué cada número es
// el que es— vive en `compartido/insignias.ts`, que comparte con la app
// nativa; acá solo se traduce a `<svg>`.
export default function Insignia({ rango, tam = 24 }: { rango: number; tam?: number }) {
  const trazos = INSIGNIAS[rango];
  if (!trazos) return null;
  const colores = coloresDeInsignia(rango);
  return (
    <svg style={{ width: tam, height: tam, flex: 'none' }} viewBox={`0 0 ${CAJA_INSIGNIA} ${CAJA_INSIGNIA}`} aria-hidden>
      {trazos.map((t, i) => dibujar(t, i, colores))}
    </svg>
  );
}

function dibujar(t: Trazo, clave: number, colores: Record<ColorInsignia, string>): ReactNode {
  const pintar = (c: ColorInsignia | 'none' | undefined) => (c === undefined || c === 'none' ? c : colores[c]);
  const { t: tipo, fill, stroke, ...resto } = t;
  const props = { key: clave, ...resto, fill: pintar(fill), stroke: pintar(stroke) };
  if (tipo === 'g') {
    const { hijos, ...g } = props as typeof props & { hijos: Trazo[] };
    return createElement('g', g, hijos.map((h, i) => dibujar(h, i, colores)));
  }
  return createElement(tipo, props);
}
