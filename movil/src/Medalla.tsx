import { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, Path } from 'react-native-svg';
import { CAJA, LADO_ILUMINADO, MATERIALES, trazosDeMedalla, type Trazo } from '@compartido/medallas';
import type { ClaveMaterial, ZonaMedalla } from '@nucleo/medallas';

/**
 * Una medalla por marca, en la app nativa. QUÉ se dibuja vive en
 * `compartido/medallas.ts`, lo mismo que dibuja la web; acá solo se traduce a
 * `react-native-svg`.
 */
export default function Medalla({
  zona,
  material,
  tam = 18,
}: {
  zona: ZonaMedalla;
  material: ClaveMaterial;
  tam?: number;
}) {
  // Igual que en la web: el `id` del recorte sale de `useId` porque en una fila
  // puede haber dos medallas iguales y un `id` repetido se resuelve callado y
  // mal. Los dos puntos no son válidos en un `id` de SVG.
  const recorte = 'medalla' + useId().replace(/:/g, '');
  const mat = MATERIALES[material];
  const { base, cielo, borde } = trazosDeMedalla(zona, mat, tam);

  return (
    <Svg width={tam} height={tam} viewBox={`0 0 ${CAJA} ${CAJA}`} pointerEvents="none">
      <Defs>
        <ClipPath id={recorte}>
          <Circle cx="12" cy="12" r="11" />
        </ClipPath>
      </Defs>
      {base.map(pintar)}
      {/* El lado iluminado, apenas insinuado: separa un objeto de un disco
          plano sin robarle contraste a las estrellas. */}
      <Path d={LADO_ILUMINADO} fill={mat.apagado} opacity={0.55} />
      <G clipPath={`url(#${recorte})`}>{cielo.map(pintar)}</G>
      <Circle cx="12" cy="12" r="11" fill="none" stroke={borde.color} strokeWidth="0.6" opacity={borde.op} />
    </Svg>
  );
}

function pintar(t: Trazo, i: number) {
  if (t.t === 'circulo') {
    return <Circle key={i} cx={t.cx} cy={t.cy} r={t.r} fill={t.color} opacity={t.op} />;
  }
  if (t.t === 'elipse') {
    return (
      <Ellipse
        key={i}
        cx={t.cx}
        cy={t.cy}
        rx={t.rx}
        ry={t.ry}
        fill={t.color}
        opacity={t.op}
        origin={`${t.cx}, ${t.cy}`}
        rotation={t.giro}
      />
    );
  }
  return (
    <Line
      key={i}
      x1={t.x1}
      y1={t.y1}
      x2={t.x2}
      y2={t.y2}
      stroke={t.color}
      strokeWidth={t.ancho}
      strokeLinecap="round"
      opacity={t.op}
    />
  );
}
