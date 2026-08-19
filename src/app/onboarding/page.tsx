'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import FondoEspacial from '@/components/FondoEspacial';

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
      return setError('Entre 3 y 20 caracteres: letras, números o guion bajo.');
    }
    setCargando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { error } = await supabase
      .from('profiles')
      .update({ username: limpio })
      .eq('id', user.id);
    setCargando(false);
    if (error) {
      if (error.code === '23505') return setError('Ese nombre ya está tomado.');
      if (error.code === '23514')
        return setError('Entre 3 y 20 caracteres: letras, números o guion bajo.');
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
        <div className="marca">Ascent</div>
        <h1 style={{ fontSize: 22, fontWeight: 400, marginBottom: 6 }}>Elegí tu nombre</h1>
        <p style={{ color: 'var(--sub)', fontSize: 14, marginBottom: 22 }}>
          Así te van a encontrar tus amigos.
        </p>
        <form onSubmit={guardar}>
          <div className="campo">
            <input
              placeholder="nombre_de_usuario"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
            />
          </div>
          <button className="boton-solido" disabled={cargando}>
            Empezar
          </button>
        </form>
        {error && <p className="error-msg">{error}</p>}
      </div>
    </>
  );
}
