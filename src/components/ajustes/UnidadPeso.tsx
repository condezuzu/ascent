'use client';

import { useEffect, useState } from 'react';
import { guardarAnotarPeso, leerAnotarPeso } from '@/lib/anotarPeso';
import { crearCliente } from '@/lib/supabase/client';
import { guardarPreferencia } from './guardar';
import type { Unidad } from '@nucleo/peso';
import type { Perfil } from '@nucleo/tipos';
import { T } from '@nucleo/textos';

export default function UnidadPeso({
  perfil,
  alCambiar,
}: {
  perfil: Perfil;
  alCambiar: (parcial: Partial<Perfil>) => void;
}) {
  const [supabase] = useState(() => crearCliente());
  // Del aparato, no de la cuenta: se lee del almacenamiento y arranca
  // prendido, que es el valor por omisión.
  const [anotar, setAnotar] = useState(true);
  useEffect(() => {
    leerAnotarPeso().then(setAnotar);
  }, []);

  return (
    <div className="seccion">
      <h3>{T.ajustes.peso}</h3>
      <div className="selector-vista">
        {(['kg', 'lb'] as Unidad[]).map((u) => (
          <button
            key={u}
            className={(perfil.unidad_peso ?? 'kg') === u ? 'activo' : ''}
            onClick={() => guardarPreferencia(supabase, perfil, 'unidad_peso', u, alCambiar)}
          >
            {u === 'kg' ? T.ajustes.kilos : T.ajustes.libras}
          </button>
        ))}
      </div>

      {/* EL PESO DE CADA SERIE, apagable entero. Va con la unidad porque es
          la misma pregunta —cómo anotás el peso— y una sección aparte sería
          otra cosa más para leer en Ajustes. */}
      <h3 style={{ marginTop: 22 }}>{T.ajustes.pesoPorSerie}</h3>
      <div className="selector-vista">
        {[true, false].map((si) => (
          <button
            key={String(si)}
            className={anotar === si ? 'activo' : ''}
            onClick={() => {
              setAnotar(si);
              guardarAnotarPeso(si);
            }}
          >
            {si ? T.ajustes.pesoPorSerieSi : T.ajustes.pesoPorSerieNo}
          </button>
        ))}
      </div>
      <p className="nota-privada">{T.ajustes.pesoPorSerieNota}</p>
    </div>
  );
}
