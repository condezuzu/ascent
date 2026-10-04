'use client';

import { useState } from 'react';
import { cargasOfrecidas, claveDeEtiqueta, type Carga } from '@nucleo/carga';
import { T } from '@nucleo/textos';
import { useVersion } from '@/lib/version';

/**
 * QUÉ SIGNIFICA EL NÚMERO, pegado al número.
 *
 * Es una etiqueta y no un selector a la vista: casi siempre el modo por
 * omisión es el que va, y cuatro opciones permanentes al lado del campo serían
 * cuatro cosas más para leer entre serie y serie. Tocándola se abren las
 * cuatro, dichas como QUÉ número escribir ("Dos mancuernas: el peso de una"),
 * no como el nombre de un modo.
 */
export default function EtiquetaDeCarga({
  carga,
  ejercicio,
  alElegir,
}: {
  carga: Carga;
  ejercicio: string | null;
  alElegir: (c: Carga) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  // Igual que la nativa: "peso corporal" recién se ofrece con la migración 58.
  // Antes la base lo descarta en silencio y guarda el modo del catálogo: la
  // pantalla decía una cosa y quedaba anotada otra.
  const version = useVersion();

  return (
    <span className="carga">
      <button
        className="carga-etiqueta"
        onClick={() => setAbierta((x) => !x)}
        aria-expanded={abierta}
        aria-label={`${T.sesion.cargaCambiar}: ${T.sesion.carga[claveDeEtiqueta(carga, ejercicio)]}`}
      >
        {T.sesion.carga[claveDeEtiqueta(carga, ejercicio)]}
        <span className="carga-flecha" aria-hidden>
          ▾
        </span>
      </button>
      {abierta && (
        <span className="carga-opciones" role="group" aria-label={T.sesion.cargaCambiar}>
          {cargasOfrecidas(version).map((c) => (
            <button
              key={c}
              className={c === carga ? 'prendida' : ''}
              aria-pressed={c === carga}
              onClick={() => {
                setAbierta(false);
                alElegir(c);
              }}
            >
              {T.sesion.cargaOpcion[claveDeEtiqueta(c, ejercicio)]}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
