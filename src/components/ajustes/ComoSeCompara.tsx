'use client';

import { useState } from 'react';
import { COMO_SE_COMPARA, type Parte } from '@nucleo/comoSeCompara';
import { T } from '@nucleo/textos';

/**
 * Cómo se calcula el ranking de fuerza, abajo de todo en Ajustes.
 *
 * Acá sí puede ser largo, y es la única parte de la app donde eso vale: el
 * que abre esto lo está buscando. En el resto, si algo necesita un párrafo
 * está mal diseñado; acá el párrafo ES el diseño.
 *
 * Va plegado igual, porque el que no lo busca no tiene por qué scrollearlo.
 *
 * EL TEXTO SE MUDÓ A `nucleo/comoSeCompara.ts` (22/9), cuando la app nativa
 * también lo necesitó: dos copias de cien líneas se separan el día que una se
 * corrige. Acá queda el plegado y cómo se pinta; qué dice, no.
 */
export default function ComoSeCompara() {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="seccion">
      <button className="fila-plegable" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        <h3>{T.ajustes.comoSeCompara}</h3>
        <span>{abierto ? '−' : '+'}</span>
      </button>

      {abierto && (
        <div className="texto-largo">
          {COMO_SE_COMPARA.map((b, i) =>
            b.tipo === 'titulo' ? <h4 key={i}>{b.texto}</h4> : <p key={i}>{b.partes.map(pintar)}</p>
          )}
        </div>
      )}
    </div>
  );
}

function pintar(parte: Parte, i: number) {
  if (typeof parte === 'string') return <span key={i}>{parte}</span>;
  if ('fuerte' in parte) return <strong key={i}>{parte.fuerte}</strong>;
  return <em key={i}>{parte.enfasis}</em>;
}
