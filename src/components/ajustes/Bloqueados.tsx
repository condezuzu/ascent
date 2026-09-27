'use client';

import { useEffect, useState } from 'react';
import { cargarBloqueados, desbloquear, type Bloqueado } from '@compartido/ranking';
import { crearCliente } from '@/lib/supabase/client';
import { T } from '@nucleo/textos';
import Avatar from '@/components/Avatar';

/**
 * CUENTAS BLOQUEADAS (migración 53). Plegado como "Cómo se compara": el que no
 * bloqueó a nadie no tiene por qué ver la lista. Se carga al abrir, una vez.
 * Espejo de `movil/src/ajustes/Bloqueados.tsx`.
 */
export default function Bloqueados() {
  const [supabase] = useState(() => crearCliente());
  const [abierto, setAbierto] = useState(false);
  const [lista, setLista] = useState<Bloqueado[] | null>(null);

  useEffect(() => {
    if (abierto && lista === null) {
      cargarBloqueados(supabase)
        .then(setLista)
        .catch(() => setLista([]));
    }
  }, [abierto, lista, supabase]);

  async function quitar(id: string) {
    // Optimista: sale de la lista al instante; si el RPC falla, la próxima
    // apertura lo vuelve a traer (no se pierde el bloqueo, solo la vista).
    setLista((l) => (l ?? []).filter((b) => b.id !== id));
    await desbloquear(supabase, id);
  }

  return (
    <div className="seccion">
      <button className="fila-plegable" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        <h3>{T.ajustes.bloqueados}</h3>
        <span>{abierto ? '−' : '+'}</span>
      </button>

      {abierto && (
        <div>
          <p className="nota-privada" style={{ marginTop: 0, marginBottom: 6 }}>
            {T.ajustes.bloqueadosPie}
          </p>
          {lista === null ? null : lista.length === 0 ? (
            <p style={{ fontSize: 14, color: 'var(--sub)', marginTop: 12 }}>{T.ajustes.bloqueadosVacio}</p>
          ) : (
            lista.map((b) => (
              <div className="fila" key={b.id}>
                <Avatar url={b.avatar_url} nombre={b.username} tam={34} />
                <span className="nombre">{b.username}</span>
                <button
                  className="boton-texto"
                  style={{ width: 'auto' }}
                  onClick={() => quitar(b.id)}
                >
                  {T.ajustes.desbloquear}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
