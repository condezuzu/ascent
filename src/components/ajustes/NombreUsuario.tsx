'use client';

import { useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { borrarPerfilCache } from '@/lib/cache';
import type { Perfil } from '@/lib/tipos';
import { T } from '@/textos';

export default function NombreUsuario({
  perfil,
  alCambiar,
}: {
  perfil: Perfil;
  alCambiar: (parcial: Partial<Perfil>) => void;
}) {
  const [supabase] = useState(() => crearCliente());
  const [nombre, setNombre] = useState(perfil.username ?? '');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  // El nombre es único e insensible a mayúsculas: la unicidad la garantiza el
  // índice de la base, no una consulta previa. Preguntar "¿está libre?" y
  // después escribir deja una ventana en el medio donde otro se lo lleva.
  async function guardar() {
    const limpio = nombre.trim();
    setAviso('');
    setError('');
    if (limpio === perfil.username) return;
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(limpio)) {
      return setError(T.ajustes.nombreFormato);
    }
    setGuardando(true);
    const { error: err } = await supabase
      .from('profiles')
      .update({ username: limpio })
      .eq('id', perfil.id);
    setGuardando(false);
    if (err) {
      if (err.code === '23505') return setError(T.ajustes.nombreTomado);
      return setError(T.general.noSePudo);
    }
    alCambiar({ username: limpio });
    await borrarPerfilCache(); // la caché tiene el nombre viejo
    setAviso(T.ajustes.nombreListo);
    setTimeout(() => setAviso(''), 3000);
  }

  return (
    <div className="seccion">
      <h3>{T.ajustes.nombreUsuario}</h3>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={T.ajustes.nombrePlaceholder}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={20}
        />
        <button
          className="boton-fantasma"
          style={{ width: 'auto', flex: 'none', padding: '13px 18px' }}
          onClick={guardar}
          disabled={guardando || nombre.trim() === perfil.username}
        >
          {guardando ? '…' : T.general.guardar}
        </button>
      </div>
      <p className="nota-privada">{T.ajustes.nombreNota}</p>
      {aviso && <p className="ok-msg">{aviso}</p>}
      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
