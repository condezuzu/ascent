'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import { fechaLinda, hoyISO, restarDias } from '@/lib/fechas';
import { planetaDeDia } from '@/lib/rangos';
import { guardarPerfilCache } from '@/lib/cache';
import { problemaConLaImagen, subirAvatar } from '@/lib/avatar';
import type { Log, Perfil, UsuarioPublico } from '@/lib/tipos';
import FondoEspacial from '@/components/FondoEspacial';
import Insignia from '@/components/Insignia';
import Avatar from '@/components/Avatar';
import Nav from '@/components/Nav';
import RecorteCircular from '@/components/RecorteCircular';
import ComoMeVen, { DIAS_VISIBLES, FOTOS_VISIBLES } from '@/components/ComoMeVen';

type MiFoto = {
  id: string;
  url: string;
  fecha: string | null;
  visibilidad: 'privada' | 'amigos';
};

/**
 * Mi perfil (§9): el único lugar donde se junta todo lo que es mío. Cambiar
 * la foto, decidir qué fotos ven los amigos sin ir una por una, ver
 * exactamente lo que ellos ven, y administrar la lista de amigos.
 */
export default function Yo() {
  const router = useRouter();
  const [supabase] = useState(() => crearCliente());
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [yoPublico, setYoPublico] = useState<UsuarioPublico | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [fotos, setFotos] = useState<MiFoto[]>([]);
  const [amigos, setAmigos] = useState<UsuarioPublico[]>([]);
  const [comoMeVen, setComoMeVen] = useState(false);
  const [porQuitar, setPorQuitar] = useState<string | null>(null);
  const [aRecortar, setARecortar] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [cargado, setCargado] = useState(false);
  const inputFoto = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (p) setPerfil(p);

    // Se lee de la MISMA vista de la que lee un amigo, no de profiles: si la
    // vista alguna vez expusiera algo de más, acá se vería igual que allá.
    const { data: pub } = await supabase
      .from('usuarios_publicos')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (pub) setYoPublico(pub as UsuarioPublico);

    const { data: ls } = await supabase
      .from('logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('fecha', restarDias(hoyISO(), DIAS_VISIBLES - 1))
      .order('fecha');
    setLogs(ls ?? []);

    const { data: fs } = await supabase
      .from('photos')
      .select('id, storage_path, visibilidad, log_id, creado')
      .eq('user_id', user.id)
      .order('creado', { ascending: false });

    if (fs && fs.length > 0) {
      const logIds = fs.map((f) => f.log_id).filter(Boolean) as string[];
      const { data: logsFotos } = logIds.length
        ? await supabase.from('logs').select('id, fecha').in('id', logIds)
        : { data: [] };
      const mapa = new Map((logsFotos ?? []).map((l) => [l.id, l.fecha]));
      const { data: firmadas } = await supabase.storage
        .from('fotos')
        .createSignedUrls(fs.map((f) => f.storage_path), 3600);
      setFotos(
        fs.map((f, i) => ({
          id: f.id,
          url: firmadas?.[i]?.signedUrl ?? '',
          fecha: f.log_id ? (mapa.get(f.log_id) ?? null) : (f.creado?.slice(0, 10) ?? null),
          visibilidad: f.visibilidad as 'privada' | 'amigos',
        }))
      );
    } else {
      setFotos([]);
    }

    const { data: rel } = await supabase.from('friendships').select('*').eq('estado', 'aceptada');
    const ids = (rel ?? []).map((r) =>
      r.solicitante === user.id ? r.destinatario : r.solicitante
    );
    if (ids.length > 0) {
      const { data: us } = await supabase.from('usuarios_publicos').select('*').in('id', ids);
      setAmigos(
        ((us ?? []) as UsuarioPublico[]).sort((a, b) =>
          (a.username ?? '').localeCompare(b.username ?? '')
        )
      );
    } else {
      setAmigos([]);
    }
    setCargado(true);
  }, [supabase]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ---- foto de perfil ----
  function elegirArchivo(archivo: File) {
    setError('');
    setAviso('');
    const problema = problemaConLaImagen(archivo);
    if (problema) return setError(problema);
    setARecortar(archivo);
  }

  async function guardarRecorte(recorte: Blob) {
    if (!perfil) return;
    setARecortar(null);
    setSubiendo(true);
    setError('');
    const r = await subirAvatar(supabase, perfil.id, recorte);
    setSubiendo(false);
    if ('error' in r) return setError(r.error);
    const actualizado = { ...perfil, avatar_url: r.url };
    setPerfil(actualizado);
    setYoPublico((y) => (y ? { ...y, avatar_url: r.url } : y));
    // sin esto, Inicio sigue mostrando la foto vieja desde la caché local
    guardarPerfilCache(actualizado);
    setAviso('Foto actualizada.');
    setTimeout(() => setAviso(''), 3000);
  }

  // ---- qué fotos ven los amigos ----
  async function alternarFoto(f: MiFoto) {
    const nueva = f.visibilidad === 'privada' ? 'amigos' : 'privada';
    setFotos((prev) => prev.map((x) => (x.id === f.id ? { ...x, visibilidad: nueva } : x)));
    const { error } = await supabase.from('photos').update({ visibilidad: nueva }).eq('id', f.id);
    if (error) {
      // no se guardó: se vuelve a lo que dice la base
      setFotos((prev) => prev.map((x) => (x.id === f.id ? { ...x, visibilidad: f.visibilidad } : x)));
      setError('No se pudo cambiar esa foto. Probá de nuevo.');
    }
  }

  async function todasA(visibilidad: 'privada' | 'amigos') {
    if (!perfil) return;
    setError('');
    const antes = fotos;
    setFotos((prev) => prev.map((x) => ({ ...x, visibilidad })));
    const { error } = await supabase
      .from('photos')
      .update({ visibilidad })
      .eq('user_id', perfil.id);
    if (error) {
      setFotos(antes);
      setError('No se pudieron cambiar las fotos. Probá de nuevo.');
    }
  }

  // ---- amigos ----
  async function quitarAmigo(id: string) {
    const { error } = await supabase.rpc('eliminar_amigo', { p_otro: id });
    setPorQuitar(null);
    if (error) return setError('No se pudo eliminar. Probá de nuevo.');
    setAmigos((prev) => prev.filter((a) => a.id !== id));
  }

  if (!perfil || !yoPublico) {
    return (
      <>
        <FondoEspacial rango={1} vacio esquina="centro" velo={0.7} />
        <div className="pantalla" />
        <Nav />
      </>
    );
  }

  const compartidas = fotos.filter((f) => f.visibilidad === 'amigos');
  const fotosQueVen = compartidas.slice(0, FOTOS_VISIBLES).map((f) => ({
    id: f.id,
    url: f.url,
    fecha: f.fecha,
  }));

  return (
    <>
      <FondoEspacial
        rango={perfil.rango_actual}
        planeta={planetaDeDia(perfil.racha_actual)}
        esquina="abajo-derecha"
        velo={0.72}
      />
      <div className="pantalla">
        <button
          className="boton-texto"
          style={{ textAlign: 'left', padding: '0 0 10px', width: 'auto' }}
          onClick={() => router.back()}
        >
          ← Volver
        </button>

        <div className="yo-cabecera">
          <button
            className="yo-foto"
            onClick={() => inputFoto.current?.click()}
            disabled={subiendo}
            aria-label="Cambiar la foto de perfil"
          >
            <Avatar url={perfil.avatar_url} nombre={perfil.username} tam={104} />
            <span className="yo-lapiz" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20h4L19 9l-4-4L4 16v4z" />
              </svg>
            </span>
          </button>
          <div className="yo-identidad">
            <div className="yo-nombre">{perfil.username}</div>
            <div className="yo-meta">
              <Insignia rango={perfil.rango_actual} tam={16} />
              <span>{subiendo ? 'subiendo la foto…' : `${perfil.racha_actual} de racha`}</span>
            </div>
          </div>
        </div>

        <input
          ref={inputFoto}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const a = e.target.files?.[0];
            // se limpia para que elegir dos veces la misma foto vuelva a abrir el recorte
            e.target.value = '';
            if (a) elegirArchivo(a);
          }}
        />

        {aviso && <p className="ok-msg">{aviso}</p>}
        {error && <p className="error-msg">{error}</p>}

        {/* ---- ver como lo ven los demás ---- */}
        <button
          className={`mirilla-control ${comoMeVen ? 'encendida' : ''}`}
          onClick={() => setComoMeVen((v) => !v)}
          aria-pressed={comoMeVen}
        >
          <span className="rotulo">
            <strong>Ver como lo ven los demás</strong>
            <span>
              {comoMeVen
                ? 'Esto es todo lo que le llega a un amigo.'
                : 'Mirá tu perfil con los ojos de un amigo.'}
            </span>
          </span>
          <span className="interruptor" aria-hidden="true" />
        </button>

        {comoMeVen && (
          <div className="mirilla">
            <div className="mirilla-etiqueta">lo que ve {amigos[0]?.username ?? 'un amigo'}</div>
            <ComoMeVen usuario={yoPublico} logs={logs} fotos={fotosQueVen} />
            <p className="nota-privada" style={{ paddingBottom: 12 }}>
              Tu peso y tus días de descanso no aparecen acá, y no aparecen nunca.
            </p>
          </div>
        )}

        {!comoMeVen && (
          <>
            {/* ---- qué fotos ven los amigos ---- */}
            <div className="seccion" style={{ marginTop: 26 }}>
              <h3>
                Qué fotos ven tus amigos{' '}
                <span className="yo-conteo">
                  {fotos.length > 0 ? `${compartidas.length}/${fotos.length}` : ''}
                </span>
              </h3>

              {fotos.length > 0 ? (
                <>
                  <div className="album-grilla">
                    {fotos.map((f) => (
                      <button
                        key={f.id}
                        className={`yo-foto-celda ${f.visibilidad === 'amigos' ? 'compartida' : 'privada'}`}
                        onClick={() => alternarFoto(f)}
                        aria-pressed={f.visibilidad === 'amigos'}
                      >
                        <div className="album-celda">
                          {f.url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={f.url} alt="" loading="lazy" />
                          )}
                          <span className="album-vis">
                            {f.visibilidad === 'privada' ? 'Solo vos' : 'Amigos'}
                          </span>
                          {f.fecha && (
                            <div className="album-pie">
                              <span>{fechaLinda(f.fecha)}</span>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="yo-masivo">
                    <button
                      onClick={() => todasA('amigos')}
                      disabled={compartidas.length === fotos.length}
                    >
                      Compartir todas
                    </button>
                    <button onClick={() => todasA('privada')} disabled={compartidas.length === 0}>
                      Guardar todas
                    </button>
                  </div>
                  <p className="nota-privada">
                    Tocá una foto para prenderla o apagarla. Las apagadas las ves solo vos.
                  </p>
                </>
              ) : (
                cargado && (
                  <p className="nota-privada" style={{ marginTop: 0 }}>
                    Todavía no sacaste ninguna. Cuando registres un día con foto, la vas a poder
                    prender o apagar desde acá.
                  </p>
                )
              )}
            </div>

            {/* ---- amigos ---- */}
            <div className="seccion">
              <h3>
                Amigos <span className="yo-conteo">{amigos.length > 0 ? amigos.length : ''}</span>
              </h3>
              {amigos.length > 0 ? (
                <div className="tarjeta">
                  {amigos.map((a) => (
                    <div className="fila" key={a.id}>
                      <Avatar url={a.avatar_url} nombre={a.username} />
                      <Link href={`/perfil/${a.id}`} className="nombre">
                        {a.username}
                      </Link>
                      {porQuitar === a.id ? (
                        <>
                          <button
                            className="boton-texto"
                            style={{ width: 'auto', padding: '6px 2px' }}
                            onClick={() => quitarAmigo(a.id)}
                          >
                            Eliminar
                          </button>
                          <button
                            className="boton-texto"
                            style={{ width: 'auto', padding: '6px 2px', color: 'var(--apagado)' }}
                            onClick={() => setPorQuitar(null)}
                          >
                            No
                          </button>
                        </>
                      ) : (
                        <button
                          className="boton-texto"
                          style={{ width: 'auto', padding: '6px 2px', color: 'var(--apagado)' }}
                          onClick={() => setPorQuitar(a.id)}
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                cargado && (
                  <p className="nota-privada" style={{ marginTop: 0 }}>
                    Todavía no agregaste a nadie. Se buscan desde Leaderboard.
                  </p>
                )
              )}
            </div>
          </>
        )}
      </div>

      {aRecortar && (
        <RecorteCircular
          archivo={aRecortar}
          alConfirmar={guardarRecorte}
          alCancelar={() => setARecortar(null)}
        />
      )}

      <Nav />
    </>
  );
}
