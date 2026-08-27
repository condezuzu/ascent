'use client';

import { useEffect, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { fechaLinda } from '@/lib/fechas';
import { planetaDeDia } from '@/lib/rangos';
import FondoEspacial from '@/components/FondoEspacial';
import Nav from '@/components/Nav';
import PantallaDeslizable from '@/components/PantallaDeslizable';
import GloboPrimeraVez from '@/components/GloboPrimeraVez';
import Esqueleto from '@/components/Esqueleto';
import { T } from '@/textos';

type Celda = {
  id: string;
  url: string;
  ruta: string;
  fecha: string;
  planeta: string | null;
  visibilidad: 'privada' | 'amigos';
  esSubida: boolean;
};

// El historial no son filas iguales: cada foto queda asociada al planeta
// del día en que se sacó.
export default function Album() {
  const [supabase] = useState(() => crearCliente());
  const [celdas, setCeldas] = useState<Celda[]>([]);
  const [cargado, setCargado] = useState(false);
  const [miRango, setMiRango] = useState(1);
  const [miPlaneta, setMiPlaneta] = useState<string | null>(null);
  const [porBorrar, setPorBorrar] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: p } = await supabase
        .from('profiles')
        .select('rango_actual, racha_actual')
        .eq('id', user.id)
        .single();
      if (p) {
        setMiRango(p.rango_actual);
        setMiPlaneta(planetaDeDia(p.racha_actual));
      }

      const { data: fotos } = await supabase
        .from('photos')
        .select('id, storage_path, visibilidad, es_subida_de_rango, log_id, creado')
        .eq('user_id', user.id)
        .order('creado', { ascending: false });

      if (!fotos || fotos.length === 0) return setCargado(true);

      const logIds = fotos.map((f) => f.log_id).filter(Boolean) as string[];
      const { data: logsDatos } = logIds.length
        ? await supabase.from('logs').select('id, fecha, planeta_del_dia').in('id', logIds)
        : { data: [] };
      const mapa = new Map((logsDatos ?? []).map((l) => [l.id, l]));

      const { data: firmadas } = await supabase.storage
        .from('fotos')
        .createSignedUrls(fotos.map((f) => f.storage_path), 3600);

      setCeldas(
        fotos.map((f, i) => {
          const log = f.log_id ? mapa.get(f.log_id) : null;
          return {
            id: f.id,
            url: firmadas?.[i]?.signedUrl ?? '',
            ruta: f.storage_path,
            fecha: log?.fecha ?? f.creado.slice(0, 10),
            planeta: log?.planeta_del_dia ?? null,
            visibilidad: f.visibilidad as 'privada' | 'amigos',
            esSubida: f.es_subida_de_rango,
          };
        })
      );
      setCargado(true);
    })();
  }, [supabase]);

  // La visibilidad va por foto, no por perfil: se cambia acá, foto por foto.
  async function alternarVisibilidad(c: Celda) {
    const nueva = c.visibilidad === 'privada' ? 'amigos' : 'privada';
    const { error } = await supabase.from('photos').update({ visibilidad: nueva }).eq('id', c.id);
    if (!error) {
      setCeldas((prev) => prev.map((x) => (x.id === c.id ? { ...x, visibilidad: nueva } : x)));
    }
  }

  // Borrado en dos toques: el primero pide confirmación en la misma celda.
  // Primero el archivo, después la fila: si el archivo no se pudo borrar,
  // la foto sigue existiendo y el usuario puede reintentar.
  async function borrar(c: Celda) {
    setError('');
    const { error: errArchivo } = await supabase.storage.from('fotos').remove([c.ruta]);
    if (errArchivo) {
      setPorBorrar(null);
      return setError(T.album.noSeBorro);
    }
    const { error: errFila } = await supabase.from('photos').delete().eq('id', c.id);
    if (errFila) {
      setPorBorrar(null);
      return setError(T.album.noSeBorro);
    }
    setCeldas((prev) => prev.filter((x) => x.id !== c.id));
    setPorBorrar(null);
  }

  return (
    <>
      <FondoEspacial rango={miRango} planeta={miPlaneta} esquina="arriba-derecha" velo={0.72} />
      <PantallaDeslizable onClick={() => porBorrar && setPorBorrar(null)}>
        <div className="titulo-pantalla">{T.album.titulo}</div>

        <GloboPrimeraVez cual="album">
          {T.album.globo}
        </GloboPrimeraVez>

        {error && <p className="error-msg">{error}</p>}

        {!cargado && <Esqueleto como="grilla" />}

        {celdas.length > 0 ? (
          <div className="album-grilla mosaico">
            {celdas.map((c) => (
              <div className="album-pieza" key={c.id}>
                <div className="album-celda">
                  {c.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.url} alt="" loading="lazy" />
                  )}

                  {porBorrar === c.id ? (
                    <div className="album-confirmar">
                      <span>{T.album.borrarPregunta}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          borrar(c);
                        }}
                      >
                        {T.album.si}
                      </button>
                      <button
                        className="no"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPorBorrar(null);
                        }}
                      >
                        {T.album.no}
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        className="album-vis"
                        onClick={(e) => {
                          e.stopPropagation();
                          alternarVisibilidad(c);
                        }}
                      >
                        {c.visibilidad === 'privada' ? T.album.soloVos : T.album.amigos}
                      </button>
                      <button
                        className="album-borrar"
                        aria-label={T.album.borrarFoto}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPorBorrar(c.id);
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                          <path d="M5 7h14M10 7V5h4v2M8 7l1 12h6l1-12" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
                <div className="album-pie">
                  <span>{fechaLinda(c.fecha)}</span>
                  {c.planeta && <span>{c.planeta}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          cargado && (
            <div className="vacio-cosmico">
              <div className="particulas">
                <i /><i /><i /><i />
              </div>
              {T.album.vacioTitulo}
              <br />
              {T.album.vacioPie}
            </div>
          )
        )}
      </PantallaDeslizable>
      <Nav />
    </>
  );
}
