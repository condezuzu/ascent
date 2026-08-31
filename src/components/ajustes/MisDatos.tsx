'use client';

import { useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { hoyISO } from '@nucleo/fechas';
import { juntarMisDatos } from '@/lib/cuenta';
import type { Perfil } from '@nucleo/tipos';
import { T } from '@nucleo/textos';

export default function MisDatos({ perfil }: { perfil: Perfil }) {
  const [supabase] = useState(() => crearCliente());
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState('');

  async function exportar() {
    setExportando(true);
    setError('');
    try {
      const datos = await juntarMisDatos(supabase, perfil.id);
      const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ascent-${perfil.username ?? 'mis-datos'}-${hoyISO()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(T.ajustes.exportarError);
    }
    setExportando(false);
  }

  return (
    <div className="seccion">
      <h3>{T.ajustes.misDatos}</h3>
      <button className="boton-fantasma" onClick={exportar} disabled={exportando}>
        {exportando ? T.ajustes.exportando : T.ajustes.exportar}
      </button>
      <p className="nota-privada">{T.ajustes.exportarNota}</p>
      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
