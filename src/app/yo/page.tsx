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
import Esqueleto from '@/components/Esqueleto';
import ComoMeVen, { DIAS_VISIBLES, FOTOS_VISIBLES } from '@/components/ComoMeVen';
import { T } from '@/textos';

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
  const [sumandoFoto, setSumandoFoto] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [cargado, setCargado] = useState(false);
  const inputFoto = useRef<HTMLInputElement>(null);
  const inputFotoNueva = useRef<HTMLInputElement>(null);

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
    setAviso(T.yo.fotoActualizada);
    setTimeout(() => setAviso(''), 3000);
  }

  // ---- qué fotos ven los amigos ----

  /**
   * Sumar una foto desde acá, sin pasar por registrar un día.
   *
   * Antes la única forma de que existiera una foto era registrar el día con
   * ella: el que quería agregar una después no tenía por dónde. Se cuelga del
   * día de HOY si ya está registrado — así queda con su planeta, igual que
   * las otras — y si no, queda suelta con su fecha de subida.
   *
   * Nace COMPARTIDA, porque el único lugar donde existe este botón es la
   * sección de "qué fotos ven tus amigos". Se apaga tocando la foto, como
   * todas.
   */
  async function sumarFotoNueva(archivo: File) {
    if (!perfil) return;
    setError('');
    setAviso('');
    const problema = problemaConLaImagen(archivo);
    if (problema) return setError(problema);

    setSumandoFoto(true);
    const hoy = hoyISO();
    const { data: logHoy } = await supabase
      .from('logs')
      .select('id')
      .eq('user_id', perfil.id)
      .eq('fecha', hoy)
      .maybeSingle();

    const ext = archivo.name.split('.').pop() || 'jpg';
    const ruta = `${perfil.id}/${hoy}-${Date.now()}.${ext}`;
    const { error: errSubida } = await supabase.storage.from('fotos').upload(ruta, archivo);
    if (errSubida) {
      setSumandoFoto(false);
      return setError(T.yo.noSeSumoLaFoto);
    }
    const { error: errFila } = await supabase.from('photos').insert({
      user_id: perfil.id,
      log_id: logHoy?.id ?? null,
      storage_path: ruta,
      visibilidad: 'amigos',
      es_subida_de_rango: false,
    });
    setSumandoFoto(false);
    if (errFila) return setError(T.yo.noSeSumoLaFoto);
    await cargar();
  }

  async function alternarFoto(f: MiFoto) {
    const nueva = f.visibilidad === 'privada' ? 'amigos' : 'privada';
    setFotos((prev) => prev.map((x) => (x.id === f.id ? { ...x, visibilidad: nueva } : x)));
    const { error } = await supabase.from('photos').update({ visibilidad: nueva }).eq('id', f.id);
    if (error) {
      // no se guardó: se vuelve a lo que dice la base
      setFotos((prev) => prev.map((x) => (x.id === f.id ? { ...x, visibilidad: f.visibilidad } : x)));
      setError(T.yo.noSeCambioFoto);
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
      setError(T.yo.noSeCambiaronFotos);
    }
  }

  // ---- amigos ----
  async function quitarAmigo(id: string) {
    const { error } = await supabase.rpc('eliminar_amigo', { p_otro: id });
    setPorQuitar(null);
    if (error) return setError(T.yo.noSePudoEliminar);
    setAmigos((prev) => prev.filter((a) => a.id !== id));
  }

  if (!perfil || !yoPublico) {
    return (
      <>
        <FondoEspacial rango={1} vacio esquina="centro" velo={0.7} />
        <div className="pantalla">
          <Esqueleto como="perfil" />
        </div>
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
          {T.general.volver}
        </button>

        <div className="yo-cabecera">
          <button
            className="yo-foto"
            onClick={() => inputFoto.current?.click()}
            disabled={subiendo}
            aria-label={T.yo.cambiarFoto}
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
              <span>{subiendo ? T.yo.subiendoFoto : T.yo.deRacha(perfil.racha_actual)}</span>
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

        <input
          ref={inputFotoNueva}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const a = e.target.files?.[0];
            e.target.value = ''; // elegir dos veces la misma foto tiene que andar
            if (a) sumarFotoNueva(a);
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
            <strong>{T.yo.comoMeVen}</strong>
            <span>
              {comoMeVen ? T.yo.comoMeVenSi : T.yo.comoMeVenNo}
            </span>
          </span>
          <span className="interruptor" aria-hidden="true" />
        </button>

        {comoMeVen && (
          <div className="mirilla">
            <div className="mirilla-etiqueta">{T.yo.loQueVe(amigos[0]?.username ?? T.yo.unAmigo)}</div>
            <ComoMeVen usuario={yoPublico} logs={logs} fotos={fotosQueVen} />
            <p className="nota-privada" style={{ paddingBottom: 12 }}>
              {T.yo.noApareceNunca}
            </p>
          </div>
        )}

        {!comoMeVen && (
          <>
            {/* ---- qué fotos ven los amigos ---- */}
            <div className="seccion" style={{ marginTop: 26 }}>
              <h3>
                {T.yo.misFotos}{' '}
                <span className="yo-conteo">
                  {fotos.length > 0 ? T.yo.deTantas(compartidas.length, fotos.length) : ''}
                </span>
              </h3>

              <div className="album-grilla">
                {/* La puerta para sumar una foto sin registrar un día. Va
                    PRIMERA y con la misma forma que las fotos: en una grilla,
                    el hueco con un + se entiende sin rótulo. */}
                <button
                  className="celda-sumar"
                  onClick={() => inputFotoNueva.current?.click()}
                  disabled={sumandoFoto}
                  aria-label={T.yo.sumarFotos}
                >
                  <span aria-hidden="true">{sumandoFoto ? '…' : '+'}</span>
                </button>
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
                        {f.visibilidad === 'privada' ? T.album.soloVos : T.album.amigos}
                      </span>
                    </div>
                    {f.fecha && (
                      <div className="album-pie">
                        <span>{fechaLinda(f.fecha)}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {fotos.length > 0 && (
                <div className="yo-masivo">
                  <button
                    onClick={() => todasA('amigos')}
                    disabled={compartidas.length === fotos.length}
                  >
                    {T.yo.compartirTodas}
                  </button>
                  <button onClick={() => todasA('privada')} disabled={compartidas.length === 0}>
                    {T.yo.guardarTodas}
                  </button>
                </div>
              )}
              {/* Se espera a `cargado`: sin eso, el que TIENE fotos ve por un
                  instante que no tiene ninguna, cada vez que entra. */}
              {(fotos.length > 0 || cargado) && (
                <p className="nota-privada">
                  {fotos.length > 0 ? T.yo.tocaUnaFoto : T.yo.sinFotos}
                </p>
              )}
            </div>

            {/* ---- amigos ---- */}
            <div className="seccion">
              <h3>
                {T.yo.amigos} <span className="yo-conteo">{amigos.length > 0 ? amigos.length : ''}</span>
              </h3>
              <div className="tarjeta">
                {/* La otra puerta: buscar gente vive en Ranking, y desde acá
                    no había forma de llegar sin saberlo de antes. */}
                <Link href="/social#buscar" className="fila">
                  <span className="cuadro-sumar" aria-hidden="true">
                    +
                  </span>
                  <span className="nombre">{T.social.sumarAmigo}</span>
                </Link>
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
                          {T.yo.eliminar}
                        </button>
                        <button
                          className="boton-texto"
                          style={{ width: 'auto', padding: '6px 2px', color: 'var(--apagado)' }}
                          onClick={() => setPorQuitar(null)}
                        >
                          {T.yo.no}
                        </button>
                      </>
                    ) : (
                      <button
                        className="boton-texto"
                        style={{ width: 'auto', padding: '6px 2px', color: 'var(--apagado)' }}
                        onClick={() => setPorQuitar(a.id)}
                      >
                        {T.yo.quitar}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {amigos.length === 0 && cargado && (
                <p className="nota-privada">{T.yo.sinAmigos}</p>
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
