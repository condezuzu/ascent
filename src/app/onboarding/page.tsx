'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import FondoEspacial from '@/components/FondoEspacial';
import { T } from '@/textos';

// El username se elige acá, después del primer login.
// Único e insensible a mayúsculas (lo garantiza un índice en la base).
export default function Onboarding() {
  const router = useRouter();
  const supabase = crearCliente();
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const limpio = nombre.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(limpio)) {
      return setError(T.entrar.nombreFormato);
    }
    setCargando(true);
    const user = await miUsuario(supabase);
    if (!user) return router.push('/login');

    const { error } = await supabase
      .from('profiles')
      .update({ username: limpio })
      .eq('id', user.id);
    setCargando(false);
    if (error) {
      if (error.code === '23505') return setError(T.ajustes.nombreTomado);
      if (error.code === '23514')
        return setError(T.entrar.nombreFormato);
      return setError(error.message);
    }
    // el recorrido va entre elegir el nombre y la primera pantalla
    router.push('/bienvenida');
    router.refresh();
  }

  return (
    <>
      <FondoEspacial rango={1} vacio esquina="centro" velo={0.55} />
      <div className="centrado">
        <div className="marca">{T.entrar.marca}</div>
        <h1 style={{ fontSize: 22, fontWeight: 400, marginBottom: 6 }}>{T.entrar.elegiNombre}</h1>
        <p style={{ color: 'var(--sub)', fontSize: 14, marginBottom: 22 }}>
          {T.entrar.elegiNombreSub}
        </p>
        <form onSubmit={guardar}>
          <div className="campo">
            <input
              placeholder={T.ajustes.nombrePlaceholder}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
            />
          </div>
          <button className="boton-solido" disabled={cargando}>
            {T.entrar.empezar}
          </button>
        </form>
        {error && <p className="error-msg">{error}</p>}
      </div>
    </>
  );
}
