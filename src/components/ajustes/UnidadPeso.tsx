'use client';

import { useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { guardarPreferencia } from './guardar';
import type { Unidad } from '@/lib/peso';
import type { Perfil } from '@/lib/tipos';
import { T } from '@/textos';

export default function UnidadPeso({
  perfil,
  alCambiar,
}: {
  perfil: Perfil;
  alCambiar: (parcial: Partial<Perfil>) => void;
}) {
  const [supabase] = useState(() => crearCliente());

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

    </div>
  );
}
