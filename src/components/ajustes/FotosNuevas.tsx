'use client';

import { useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { guardarPreferencia } from './guardar';
import type { Perfil } from '@/lib/tipos';

export default function FotosNuevas({
  perfil,
  alCambiar,
}: {
  perfil: Perfil;
  alCambiar: (parcial: Partial<Perfil>) => void;
}) {
  const [supabase] = useState(() => crearCliente());

  function elegir(valor: 'privada' | 'amigos') {
    guardarPreferencia(supabase, perfil, 'visibilidad_default', valor, alCambiar);
  }

  return (
    <div className="seccion">
      <h3>Fotos nuevas</h3>
      <div className="selector-vista">
        {/* !== 'amigos' y no === 'privada': si algún día aparece un tercer
            valor, el botón seguro es el que menos comparte */}
        <button
          className={perfil.visibilidad_default !== 'amigos' ? 'activo' : ''}
          onClick={() => elegir('privada')}
        >
          Solo yo
        </button>
        <button
          className={perfil.visibilidad_default === 'amigos' ? 'activo' : ''}
          onClick={() => elegir('amigos')}
        >
          Amigos
        </button>
      </div>
      <p className="nota-privada">
        Con qué arranca cada foto nueva. Después la cambiás una por una desde tu perfil.
      </p>
    </div>
  );
}
