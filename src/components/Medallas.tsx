'use client';

import { useState } from 'react';
import { cuantosLevantan, type Medalla as Dato } from '@nucleo/medallas';
import { T } from '@nucleo/textos';
import Medalla from './Medalla';

/**
 * LAS MEDALLAS AL LADO DEL NOMBRE, y la ventanita al tocar una. La misma
 * pieza que `movil/src/Medallas.tsx`, con las clases de `globals.css`.
 *
 * CHICAS Y EN FILA, que fue el pedido: 18 px, pegadas al nombre. No llevan
 * rótulo ni número a la vista — el que las tiene sabe lo que son, y el que
 * entra a un perfil ajeno ve que esa persona tiene algo y puede tocarlo.
 *
 * LA VENTANITA SE ABRE DEBAJO Y NO ES UN MODAL. Un modal para dos renglones
 * taparía el perfil entero para decir una frase; esto se abre en su lugar y se
 * cierra tocando de nuevo.
 *
 * LA GALAXIA NO LLEVA EL RÓTULO DEL EJERCICIO ARRIBA: su línea ya nombra los
 * tres levantamientos y el rótulo repetiría uno.
 */
export default function Medallas({
  medallas,
  nombres,
}: {
  medallas: readonly Dato[];
  /** El nombre lindo de cada ejercicio, que sale del catálogo. */
  nombres?: Readonly<Record<string, string>>;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);
  if (medallas.length === 0) return null;
  const elegida = medallas.find((m) => m.zona === abierta) ?? null;

  return (
    <div>
      <div className="medallas-fila">
        {medallas.map((m) => (
          <button
            key={m.zona}
            type="button"
            className="medallas-una"
            onClick={() => setAbierta(abierta === m.zona ? null : m.zona)}
            aria-label={T.medallas.etiqueta(T.medallas.zonas[m.zona], T.medallas.materiales[m.material])}
            aria-expanded={abierta === m.zona}
          >
            <Medalla zona={m.zona} material={m.material} tam={18} />
          </button>
        ))}
      </div>

      {elegida && (
        <div className="medallas-ventana">
          {elegida.material !== 'galaxia' && (
            <div className="medallas-rotulo">
              {nombres?.[elegida.ejercicio] ?? T.medallas.zonas[elegida.zona]}
            </div>
          )}
          <div className="medallas-frase">
            {elegida.material === 'galaxia'
              ? T.medallas.galaxia
              : T.medallas.frase(cuantosLevantan(elegida.percentil))}
          </div>
        </div>
      )}
    </div>
  );
}
