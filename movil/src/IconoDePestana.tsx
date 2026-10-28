import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import type { Pestana } from './irAPestana';

/**
 * LOS ICONOS DE LA BARRA (28/10, a pedido: icono arriba, palabra chica abajo). Los mismos trazos
 * que la barra de la web (src/components/Nav.tsx), para que las dos apps se lean igual.
 */
export default function IconoDePestana({ cual, color, tam = 22 }: { cual: Pestana; color: string; tam?: number }) {
  const trazo = { stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={tam} height={tam} viewBox="0 0 24 24">
      {cual === 'inicio' && (
        <>
          <Path d="M3 11.5 12 4l9 7.5" {...trazo} />
          <Path d="M5.5 10.5V20h13v-9.5" {...trazo} />
        </>
      )}
      {cual === 'ranking' && (
        <>
          <Circle cx={12} cy={12} r={2.4} {...trazo} />
          <Ellipse cx={12} cy={12} rx={9.5} ry={4} {...trazo} />
          <Circle cx={20} cy={14} r={1.4} fill={color} />
        </>
      )}
      {cual === 'album' && (
        <>
          <Rect x={4} y={5} width={16} height={14} rx={2} {...trazo} />
          <Circle cx={9.5} cy={10} r={1.6} {...trazo} />
          <Path d="M4 16.5 9 12l4.5 4L16 14l4 3.5" {...trazo} />
        </>
      )}
      {cual === 'stats' && (
        <>
          <Path d="M5 20V13" {...trazo} />
          <Path d="M10.5 20V8" {...trazo} />
          <Path d="M16 20v-4.5" {...trazo} />
          <Path d="M19.5 20V4.5" {...trazo} />
        </>
      )}
      {cual === 'ajustes' && (
        <>
          <Circle cx={12} cy={12} r={3} {...trazo} />
          <Path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9 19 19M19 5l-2.1 2.1M7.1 16.9 5 19" {...trazo} />
        </>
      )}
    </Svg>
  );
}
