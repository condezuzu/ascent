'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import { borrarPerfilCache } from '@/lib/cache';
import { reiniciarGuia } from '@/lib/guia';
import { T } from '@nucleo/textos';

export default function Sesion({ userId }: { userId: string }) {
  const router = useRouter();
  const [supabase] = useState(() => crearCliente());

  // Reinicia el recorrido Y los tres globos: si solo volviera el recorrido,
  // el que quiere repasar de qué va cada pestaña no lo conseguiría.
  async function verLaGuiaDeNuevo() {
    await reiniciarGuia(userId);
    router.push('/bienvenida');
  }

  async function salir() {
    await borrarPerfilCache(); // que la próxima cuenta no vea la racha de esta
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="seccion">
      <button className="boton-texto" onClick={verLaGuiaDeNuevo}>
        {T.ajustes.verGuia}
      </button>
      <button className="boton-texto" onClick={() => router.push('/nueva-clave')}>
        {T.ajustes.cambiarClave}
      </button>
      <button className="boton-texto" onClick={salir}>
        {T.ajustes.cerrarSesion}
      </button>
    </div>
  );
}
