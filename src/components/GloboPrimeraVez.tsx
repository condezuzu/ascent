'use client';

import { useEffect, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { faltaElGlobo, marcarGloboVisto, type Globo } from '@/lib/guia';

/**
 * Una línea explicando para qué sirve la pantalla, la primera vez que se
 * entra. Se cierra y no vuelve más (salvo que se reinicie la guía desde
 * Ajustes).
 *
 * Arranca oculto y aparece recién cuando se confirmó que falta verlo: si se
 * mostrara mientras se consulta, el que ya lo cerró vería el globo parpadear
 * en cada visita.
 */
export default function GloboPrimeraVez({ cual, children }: { cual: Globo; children: string }) {
  const [visible, setVisible] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [uid, setUid] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      const supabase = crearCliente();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!vivo || !user) return;
      setUid(user.id);
      if (await faltaElGlobo(user.id, cual)) setVisible(true);
    })();
    return () => {
      vivo = false;
    };
  }, [cual]);

  function cerrar() {
    if (uid) void marcarGloboVisto(uid, cual); // no bloquea el cierre
    setCerrando(true);
    setTimeout(() => setVisible(false), 300);
  }

  if (!visible) return null;

  return (
    <div className={`globo ${cerrando ? 'cerrando' : ''}`}>
      <p>{children}</p>
      <button onClick={cerrar} aria-label="Entendido">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
