'use client';

import { useId } from 'react';
import { CAJA, LADO_ILUMINADO, MATERIALES, trazosDeMedalla, type Trazo } from '@compartido/medallas';
import type { ClaveMaterial, ZonaMedalla } from '@nucleo/medallas';

/**
 * Una medalla por marca, en la web. QUÉ se dibuja vive en
 * `compartido/medallas.ts`, lo mismo que dibuja la nativa; acá solo se traduce
 * a `<svg>`.
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
  // EL `id` DEL RECORTE SALE DE `useId` Y NO DE LAS PROPS. Un `id` repetido en
  // una lista es un error que el navegador resuelve callado y mal (la receta de
  // `compartido/insignias.ts` lo documenta), y estas se dibujan varias en fila
  // —a veces la misma zona con el mismo material en dos lugares de la página—.
  const recorte = useId();
  const mat = MATERIALES[material];
  const { base, cielo, borde } = trazosDeMedalla(zona, mat, tam);

  return (
    <svg width={tam} height={tam} viewBox={`0 0 ${CAJA} ${CAJA}`} className="medalla" aria-hidden>
      <defs>
        <clipPath id={recorte}>
          <circle cx="12" cy="12" r="11" />
        </clipPath>
      </defs>
      {base.map(pintar)}
      {/* El lado iluminado, apenas insinuado: separa un objeto de un disco
          plano sin robarle contraste a las estrellas. */}
      <path d={LADO_ILUMINADO} fill={mat.apagado} opacity={0.55} />
      <g clipPath={`url(#${recorte})`}>{cielo.map(pintar)}</g>
      <circle cx="12" cy="12" r="11" fill="none" stroke={borde.color} strokeWidth="0.6" opacity={borde.op} />
    </svg>
  );
}

function pintar(t: Trazo, i: number) {
  if (t.t === 'circulo') {
    return <circle key={i} cx={t.cx} cy={t.cy} r={t.r} fill={t.color} opacity={t.op} />;
  }
  if (t.t === 'elipse') {
    return (
      <ellipse
        key={i}
        cx={t.cx}
        cy={t.cy}
        rx={t.rx}
        ry={t.ry}
        fill={t.color}
        opacity={t.op}
        transform={`rotate(${t.giro} ${t.cx} ${t.cy})`}
      />
    );
  }
  return (
    <line
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
