'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import { borrarPerfilCache } from '@/lib/cache';
import { eliminarCuenta } from '@/lib/cuenta';
import type { Perfil } from '@/lib/tipos';

// Lo último de la pantalla, y lo único que pide escribir algo a mano.
export default function BajaDeCuenta({ perfil }: { perfil: Perfil }) {
  const router = useRouter();
  const [supabase] = useState(() => crearCliente());
  const [abierta, setAbierta] = useState(false);
  const [confirmacion, setConfirmacion] = useState('');
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState('');

  // Baja definitiva. Se pide escribir el nombre de usuario a mano: un botón
  // de "¿seguro?" se aprieta sin leer, y esto no tiene vuelta atrás.
  async function borrar() {
    setBorrando(true);
    setError('');
    const r = await eliminarCuenta(supabase, perfil.id);
    if ('error' in r) {
      setBorrando(false);
      return setError(r.error);
    }
    await borrarPerfilCache();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="seccion">
      {!abierta ? (
        <button className="boton-texto peligro" onClick={() => setAbierta(true)}>
          Eliminar mi cuenta
        </button>
      ) : (
        <div className="contenida peligro">
          <h3 style={{ marginBottom: 8 }}>Eliminar mi cuenta</h3>
          <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 12 }}>
            Se borra todo: tus {perfil.racha_actual} días de racha, tus fotos, tus pesos, tus
            marcas y tus amigos. No hay forma de recuperarlo, ni siquiera pidiéndomelo.
          </p>
          <p className="nota-privada" style={{ marginTop: 0, marginBottom: 8 }}>
            Si querés seguir, escribí <strong>{perfil.username}</strong> acá abajo.
          </p>
          <input
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            placeholder={perfil.username ?? ''}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              className="boton-peligro"
              onClick={borrar}
              disabled={borrando || confirmacion.trim() !== perfil.username}
            >
              {borrando ? 'Borrando…' : 'Eliminar para siempre'}
            </button>
            <button
              className="boton-fantasma"
              style={{ flex: 1, width: 'auto' }}
              onClick={() => {
                setAbierta(false);
                setConfirmacion('');
                setError('');
              }}
              disabled={borrando}
            >
              Mejor no
            </button>
          </div>
          {error && <p className="error-msg">{error}</p>}
        </div>
      )}
    </div>
  );
}
