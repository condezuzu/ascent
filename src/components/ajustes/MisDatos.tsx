'use client';

import { useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { hoyISO } from '@/lib/fechas';
import { juntarMisDatos } from '@/lib/cuenta';
import type { Perfil } from '@/lib/tipos';

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
      setError('No se pudo armar el archivo. Probá de nuevo.');
    }
    setExportando(false);
  }

  return (
    <div className="seccion">
      <h3>Mis datos</h3>
      <button className="boton-fantasma" onClick={exportar} disabled={exportando}>
        {exportando ? 'Armando el archivo…' : 'Exportar mis datos'}
      </button>
      <p className="nota-privada">Todo tu historial, en un archivo.</p>
      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
