'use client';

import { useState } from 'react';
import { bloquear, denunciar, MOTIVOS_DENUNCIA, type MotivoDenuncia } from '@compartido/ranking';
import { crearCliente } from '@/lib/supabase/client';
import { T } from '@nucleo/textos';
import EnElBody from './EnElBody';

/**
 * DENUNCIAR O BLOQUEAR a alguien (migración 53). La versión web de la hoja
 * nativa (`movil/src/AccionesDeUsuario.tsx`): una hoja que sube desde abajo,
 * reutilizada desde el perfil de un amigo y desde el ranking.
 *
 * El motivo de la denuncia sale de una lista cerrada, no de texto libre.
 * Bloquear pide confirmación porque corta la amistad y no se deshace solo.
 *
 * Se abre cuando `usuario` deja de ser null; se cierra volviendo a null. La
 * hoja se monta al final del body (ver `EnElBody`) para no quedar debajo de la
 * barra de navegación.
 */
type Usuario = { id: string; username: string };

export default function AccionesDeUsuario({
  usuario,
  onCerrar,
  onBloqueado,
}: {
  usuario: Usuario | null;
  onCerrar: () => void;
  onBloqueado?: (id: string) => void;
}) {
  const [supabase] = useState(() => crearCliente());
  const [paso, setPaso] = useState<'menu' | 'motivos' | 'bloqueo'>('menu');
  const [ocupado, setOcupado] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [error, setError] = useState('');
  const [cerrando, setCerrando] = useState(false);

  // Mientras no hay a quién, no hay hoja. Durante el cierre sigue montada para
  // que la animación de bajada llegue a verse.
  if (!usuario && !cerrando) return null;

  function cerrar() {
    setCerrando(true);
    setTimeout(() => {
      onCerrar();
      // que la próxima vez abra en el menú, no donde quedó
      setPaso('menu');
      setEnviada(false);
      setError('');
      setOcupado(false);
      setCerrando(false);
    }, 200);
  }

  async function elegirMotivo(m: MotivoDenuncia) {
    if (!usuario || ocupado) return;
    setOcupado(true);
    setError('');
    const ok = await denunciar(supabase, usuario.id, m);
    setOcupado(false);
    if (!ok) return setError(T.general.noSePudo);
    setEnviada(true);
  }

  async function confirmarBloqueo() {
    if (!usuario || ocupado) return;
    setOcupado(true);
    setError('');
    const ok = await bloquear(supabase, usuario.id);
    setOcupado(false);
    if (!ok) return setError(T.general.noSePudo);
    onBloqueado?.(usuario.id);
    cerrar();
  }

  return (
    <EnElBody>
      <div className={`hoja-fondo ${cerrando ? 'cerrando' : ''}`} onClick={cerrar} />
      <div className={`hoja ${cerrando ? 'cerrando' : ''}`} role="dialog" aria-modal>
        {enviada ? (
          <>
            <p style={{ fontSize: 16, lineHeight: 1.4, padding: '8px 0' }}>{T.social.denunciaEnviada}</p>
            <button className="boton-texto" style={{ marginTop: 6 }} onClick={cerrar}>
              {T.general.entendido}
            </button>
          </>
        ) : paso === 'menu' ? (
          <>
            <h2>@{usuario?.username}</h2>
            <div style={{ marginTop: 12 }}>
              <button className="hoja-item" onClick={() => setPaso('motivos')}>
                {T.social.denunciar}
              </button>
              <button className="hoja-item peligro" onClick={() => setPaso('bloqueo')}>
                {T.social.bloquear}
              </button>
            </div>
            <button className="boton-texto" style={{ marginTop: 6 }} onClick={cerrar}>
              {T.general.cancelar}
            </button>
          </>
        ) : paso === 'motivos' ? (
          <>
            <h2>{T.social.denunciaTitulo}</h2>
            <div style={{ marginTop: 12 }}>
              {MOTIVOS_DENUNCIA.map((m) => (
                <button
                  key={m}
                  className="hoja-item"
                  disabled={ocupado}
                  onClick={() => elegirMotivo(m)}
                >
                  {T.social.denunciaMotivos[m]}
                </button>
              ))}
            </div>
            {error !== '' && <p className="error-msg">{error}</p>}
            <button className="boton-texto" style={{ marginTop: 6 }} onClick={() => setPaso('menu')}>
              {T.general.volver}
            </button>
          </>
        ) : (
          <>
            <h2>{usuario ? T.social.bloquearTitulo(usuario.username) : ''}</h2>
            <p className="sub" style={{ marginTop: 8, lineHeight: 1.5 }}>{T.social.bloquearQue}</p>
            {error !== '' && <p className="error-msg">{error}</p>}
            <div style={{ display: 'flex' }}>
              <button className="boton-peligro" disabled={ocupado} onClick={confirmarBloqueo}>
                {T.social.bloquearConfirmar}
              </button>
            </div>
            <button className="boton-texto" style={{ marginTop: 6 }} onClick={() => setPaso('menu')}>
              {T.general.volver}
            </button>
          </>
        )}
      </div>
    </EnElBody>
  );
}
