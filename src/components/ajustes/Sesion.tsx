'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import { cerrarSesion } from '@compartido/cuenta';
import { avisarFallo } from '@compartido/cola';
import { olvidarPendientes } from '@/lib/avisos';
import { borrarTema } from '@/plataforma/web/tema';
import { reiniciarGuia } from '@compartido/guia';
import { T } from '@nucleo/textos';

export default function Sesion({ userId }: { userId: string }) {
  const router = useRouter();
  const [supabase] = useState(() => crearCliente());

  // Reinicia el recorrido Y los tres globos: si solo volviera el recorrido,
  // el que quiere repasar de qué va cada pestaña no lo conseguiría.
  async function verLaGuiaDeNuevo() {
    await reiniciarGuia(userId);
    router.push('/ajustes');
  }

  async function salir() {
    // Sube lo pendiente, cierra SOLO en este aparato y recién si cerró borra:
    // ver `cerrarSesion`. Sin señal no cierra, y se dice.
    if (!(await cerrarSesion(supabase))) return avisarFallo(T.ajustes.noSeCerro);
    olvidarPendientes(); // el punto de "te espera algo" era de esta cuenta
    borrarTema(); // y el color de esta cuenta, que se pinta antes de todo
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
