'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import { prepararFoto } from '@/lib/foto';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { hoyISO } from '@nucleo/fechas';
import { planetaDeDia } from '@nucleo/rangos';
import { guardarPerfilCache } from '@compartido/cache';
import { problemaConLaImagen, subirAvatar } from '@compartido/avatar';
import type { Perfil, UsuarioPublico } from '@nucleo/tipos';
import FondoEspacial from '@/components/FondoEspacial';
import Insignia from '@/components/Insignia';
import Avatar from '@/components/Avatar';
import Nav from '@/components/Nav';
import RecorteCircular from '@/components/RecorteCircular';
import GloboPrimeraVez from '@/components/GloboPrimeraVez';
import NoCargo from '@/components/NoCargo';
import { FOTOS_VISIBLES, FotosQueVen, type FotoVisible } from '@/components/ComoMeVen';
import PantallaDeslizable from '@/components/PantallaDeslizable';
import { miniaturas } from '@compartido/album';
import { cargarMisMedallas } from '@compartido/perfil';
import type { Medalla } from '@nucleo/medallas';
import Medallas from '@/components/Medallas';
import { conComa } from '@nucleo/peso';
import { T } from '@nucleo/textos';

/**
 * Mi perfil (§9): el único lugar donde se junta todo lo que es mío. Cambiar
 * la foto, decidir qué fotos ven los amigos sin ir una por una, ver
 * exactamente lo que ellos ven, y administrar la lista de amigos.
 */
export default function Yo() {
  const router = useRouter();
  const [supabase] = useState(() => crearCliente());
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [fotos, setFotos] = useState<FotoVisible[]>([]);
  const [amigos, setAmigos] = useState<UsuarioPublico[]>([]);
  const [porQuitar, setPorQuitar] = useState<string | null>(null);
  const [aRecortar, setARecortar] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [sumandoFoto, setSumandoFoto] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [medallas, setMedallas] = useState<Medalla[]>([]);
  const [dots, setDots] = useState<number | null>(null);
  const [cargado, setCargado] = useState(false);
  const [noCargo, setNoCargo] = useState(false);
  const inputFoto = useRef<HTMLInputElement>(null);
  const inputFotoNueva = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    const user = await miUsuario(supabase);
    if (!user) return;

    // TODO A LA VEZ (19/9). Eran ocho consultas en fila y la pantalla se
    // dibujaba con la primera: el planeta, las fotos y los amigos iban
    // apareciendo de a uno. Ahora van juntas en dos tandas y la pantalla
    // aparece entera (ver `PantallaDeslizable`).
    const [{ data: p }, { data: fs }, { data: rel }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      // LAS FOTOS QUE VEN TUS AMIGOS, y nada más: las mismas nueve que ve un
      // amigo en tu perfil (misma cuenta que `perfil/[id]`). Todas las fotos
      // y cuáles se comparten se manejan en el Álbum.
      supabase
        .from('photos')
        .select('id, storage_path, log_id, creado')
        .eq('user_id', user.id)
        .eq('visibilidad', 'amigos')
        .order('creado', { ascending: false })
        .limit(FOTOS_VISIBLES),
      supabase.from('friendships').select('*').eq('estado', 'aceptada'),
    ]);
    setNoCargo(!p);
    if (!p) return setCargado(true);

    const lista = fs ?? [];
    const logIds = lista.map((f) => f.log_id).filter(Boolean) as string[];
    const rutas = lista.map((f) => f.storage_path as string);
    const ids = (rel ?? []).map((r) => (r.solicitante === user.id ? r.destinatario : r.solicitante));
    const [logsFotos, firmadas, chicas, us, misMedallas] = await Promise.all([
      logIds.length ? supabase.from('logs').select('id, fecha').in('id', logIds).then((r) => r.data ?? []) : [],
      rutas.length ? supabase.storage.from('fotos').createSignedUrls(rutas, 3600).then((r) => r.data ?? []) : [],
      miniaturas(supabase, rutas),
      ids.length ? supabase.from('usuarios_publicos').select('*').in('id', ids).then((r) => (r.data ?? []) as UsuarioPublico[]) : [],
      // Van en la SEGUNDA tanda porque necesitan el sexo, que viene en el
      // perfil. La regla de qué medalla se gana es compartida con la nativa
      // (`cargarMisMedallas`): tenerla dos veces es tenerla mal en una.
      cargarMisMedallas(supabase, user.id, p.sexo),
    ]);
    const mapa = new Map((logsFotos as { id: string; fecha: string }[]).map((l) => [l.id, l.fecha]));
    setFotos(
      lista.map((f, i) => ({
        id: f.id,
        url: (firmadas as { signedUrl: string }[])[i]?.signedUrl ?? '',
        miniatura: chicas[i] ?? undefined,
        // Como la ve un amigo: con fecha solo si cuelga de un día.
        fecha: f.log_id ? (mapa.get(f.log_id) ?? null) : null,
      }))
    );
    setAmigos(((us as UsuarioPublico[]) ?? []).sort((a, b) => (a.username ?? '').localeCompare(b.username ?? '')));
    setMedallas(misMedallas);
    setPerfil(p);
    setCargado(true);
    // El DOTS propio, número crudo (dos decimales de la base), no el redondeo
    // del ranking. Su propia carga: si no llega, el perfil no se rompe.
    supabase.rpc('mi_fuerza').then(({ data }) => {
      const d = (data as { dots?: number | null } | null)?.dots;
      setDots(typeof d === 'number' ? d : null);
    });
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
   * sección de lo que ven tus amigos. Se apaga desde el Álbum, como todas.
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

    // Igual que en la hoja de registrar: se recodifica para que el archivo
    // que queda en el storage no lleve el EXIF —y con él, las coordenadas de
    // dónde se sacó la foto. Ver `lib/foto.ts`.
    const lista = await prepararFoto(archivo);
    if (!lista.ok) {
      setSumandoFoto(false);
      return setError(T.general.falloFotoPreparar);
    }
    const ruta = `${perfil.id}/${hoy}-${Date.now()}.jpg`;
    const { error: errSubida } = await supabase.storage
      .from('fotos')
      .upload(ruta, lista.blob, { contentType: lista.tipo });
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

  // ---- amigos ----
  async function quitarAmigo(id: string) {
    const { error } = await supabase.rpc('eliminar_amigo', { p_otro: id });
    setPorQuitar(null);
    if (error) return setError(T.yo.noSePudoEliminar);
    setAmigos((prev) => prev.filter((a) => a.id !== id));
  }

  if (!perfil) {
    return (
      <>
        {/* Sin rango: todavía no se sabe, y se dibuja el último propio con su
            planeta, en el MISMO lugar que la pantalla de verdad (19/9). */}
        <FondoEspacial esquina="abajo-derecha" velo={0.72} />
        <PantallaDeslizable listo={noCargo}>{noCargo && <NoCargo reintentar={cargar} />}</PantallaDeslizable>
        <Nav />
      </>
    );
  }


  return (
    <>
      <FondoEspacial
        rango={perfil.rango_actual}
        propio
        planeta={planetaDeDia(perfil.racha_actual)}
        esquina="abajo-derecha"
        velo={0.72}
      />
      <PantallaDeslizable listo={cargado}>
        <button
          className="boton-texto"
          style={{ textAlign: 'left', padding: '0 0 10px', width: 'auto' }}
          onClick={() => router.back()}
        >
          {T.general.volver}
        </button>

        <GloboPrimeraVez cual="perfil">{T.yo.globo}</GloboPrimeraVez>

        <div className="yo-cabecera">
          <button
            className="yo-foto"
            onClick={() => inputFoto.current?.click()}
            disabled={subiendo}
            aria-label={T.yo.cambiarFoto}
          >
            <Avatar url={perfil.avatar_url} nombre={perfil.username} tam={76} />
            <span className="yo-lapiz" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20h4L19 9l-4-4L4 16v4z" />
              </svg>
            </span>
          </button>
          <div className="yo-identidad">
            {/* LAS MEDALLAS VAN EN LA MISMA FILA QUE EL NOMBRE. Estuvieron
                debajo y chicas un rato por miedo a que un nombre largo las
                empujara afuera; lo arregla envolver la fila, no esconderlas. */}
            <Medallas medallas={medallas} nombre={<span className="yo-nombre">{perfil.username}</span>} />
            <div className="yo-meta">
              <Insignia rango={perfil.rango_actual} tam={16} />
              <span>{subiendo ? T.yo.subiendoFoto : T.yo.deRacha(perfil.racha_actual)}</span>
            </div>
            {dots !== null && (
              <div className="yo-dots">
                <strong>{conComa(String(dots))}</strong> DOTS
              </div>
            )}
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

        {/* TUS FOTOS COMO LAS VEN TUS AMIGOS (19/9, decisión del humano): las
            compartidas, las últimas nueve, con el MISMO componente que usa el
            perfil de un amigo. Acá no se ven todas ni se administran: eso es
            el Álbum. Sumar una foto sin registrar el día sigue acá, abajo y
            aparte, para que la grilla sea idéntica a la que ven ellos. */}
        <>
            <FotosQueVen fotos={fotos} />
            <div style={{ marginTop: fotos.length > 0 ? 0 : 26, marginBottom: 30 }}>
              <p className="nota-privada">{fotos.length > 0 ? T.yo.fotosPie : T.yo.sinFotos}</p>
              <button
                className="boton-texto"
                style={{ textAlign: 'left', width: 'auto', padding: '4px 0' }}
                onClick={() => inputFotoNueva.current?.click()}
                disabled={sumandoFoto}
              >
                {sumandoFoto ? '…' : T.yo.sumarFotos}
              </button>
            </div>

            {/* ---- amigos ---- */}
            <div className="seccion">
              <h3>
                {T.yo.amigos} <span className="yo-conteo">{amigos.length > 0 ? amigos.length : ''}</span>
              </h3>
              <div className="tarjeta">
                {/* "Sumar amigos" NO va acá. Estaba como segunda puerta a
                    Ranking, y dos puertas a lo mismo en pantallas distintas no
                    dan dos caminos: dan la duda de si llevan al mismo lado. */}
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
      </PantallaDeslizable>

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
