'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import { borrarPerfilCache } from '@/lib/cache';
import { reiniciarGuia } from '@/lib/guia';

export default function Sesion({ userId }: { userId: string }) {
  const router = useRouter();
  const [supabase] = useState(() => crearCliente());

  // Reinicia el recorrido Y los tres globos: si solo volviera el recorrido,
  // el que quiere repasar de qué va cada pestaña no lo conseguiría.
  function verLaGuiaDeNuevo() {
    reiniciarGuia(userId);
    router.push('/bienvenida');
  }

  async function salir() {
    borrarPerfilCache(); // que la próxima cuenta no vea la racha de esta
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="seccion">
      <button className="boton-texto" onClick={verLaGuiaDeNuevo}>
        Volver a ver la guía
      </button>
      <button className="boton-texto" onClick={() => router.push('/nueva-clave')}>
        Cambiar contraseña
      </button>
      <button className="boton-texto" onClick={salir}>
        Cerrar sesión
      </button>
    </div>
  );
}
