'use client';

import { useEffect, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { MESES, fechaLinda } from '@/lib/fechas';
import { planetaDeDia } from '@/lib/rangos';
import { avisarFallo } from '@/lib/cola';
import FondoEspacial from '@/components/FondoEspacial';
import Nav from '@/components/Nav';
import PantallaDeslizable from '@/components/PantallaDeslizable';
import GloboPrimeraVez from '@/components/GloboPrimeraVez';
import VisorFoto from '@/components/VisorFoto';
import Esqueleto from '@/components/Esqueleto';
import NoCargo from '@/components/NoCargo';
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
  // Qué foto está abierta a pantalla completa. Se guarda el ÍNDICE y no el id
  // porque desde el visor se pasa a la de al lado, y "la de al lado" solo
  // existe como posición en la lista.
  const [abierta, setAbierta] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [noCargo, setNoCargo] = useState(false);

  useEffect(() => {
    (async () => {
      const user = await miUsuario(supabase);
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

      const { data: fotos, error: errFotos } = await supabase
        .from('photos')
        .select('id, storage_path, visibilidad, es_subida_de_rango, log_id, creado')
        .eq('user_id', user.id)
        .order('creado', { ascending: false });

      // Que la consulta FALLE no es lo mismo que no tener fotos, y confundirlos
      // es peor que colgarse: la pantalla decía "Ninguna foto todavía" con toda
      // seguridad, o sea que mentía sobre los datos de la persona.
      if (errFotos) {
        setNoCargo(true);
        return setCargado(true);
      }
      setNoCargo(false);
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

  // La visibilidad va por foto, no por perfil: se cambia foto por foto, desde
  // el visor.
  async function alternarVisibilidad(c: Celda) {
    const nueva = c.visibilidad === 'privada' ? 'amigos' : 'privada';
    const { error } = await supabase.from('photos').update({ visibilidad: nueva }).eq('id', c.id);
    if (error) return avisarFallo(T.general.falloVisibilidad);
    setCeldas((prev) => prev.map((x) => (x.id === c.id ? { ...x, visibilidad: nueva } : x)));
  }

  // Borrado en dos toques; el segundo llega desde el visor.
  //
  // Primero el archivo y después la fila: si el archivo no se pudo borrar, la
  // foto sigue existiendo y se puede reintentar. Al revés quedaría un archivo
  // huérfano en el storage que ya nadie sabe que está.
  async function borrar(c: Celda) {
    setError('');
    const { error: errArchivo } = await supabase.storage.from('fotos').remove([c.ruta]);
    if (errArchivo) return setError(T.album.noSeBorro);
    const { error: errFila } = await supabase.from('photos').delete().eq('id', c.id);
    if (errFila) return setError(T.album.noSeBorro);

    setCeldas((prev) => {
      const quedan = prev.filter((x) => x.id !== c.id);
      // Si era la última, el visor se cierra; si no, se queda en el mismo
      // lugar de la lista, que ahora es la foto siguiente. Cerrar siempre
      // obligaría a volver a entrar para borrar dos seguidas.
      setAbierta((i) => (quedan.length === 0 ? null : i === null ? null : Math.min(i, quedan.length - 1)));
      return quedan;
    });
  }

  // POR MES, y no una grilla corrida. Sin las fechas debajo de cada foto la
  // grilla queda limpia —una miniatura de un tercio de pantalla con letras
  // encima no se lee— pero cincuenta cuadrados iguales sin ninguna referencia
  // no se pueden recorrer: para encontrar una foto habría que abrirlas de a
  // una. El encabezado de mes es lo más barato que devuelve el "cuándo" sin
  // ensuciar ni una celda.
  //
  // Las fotos ya vienen de la más nueva a la más vieja, así que alcanza con
  // cortar cada vez que cambia el mes.
  const meses: { clave: string; titulo: string; desde: number; fotos: Celda[] }[] = [];
  celdas.forEach((c, i) => {
    const clave = c.fecha.slice(0, 7);
    const ultimo = meses[meses.length - 1];
    if (ultimo?.clave === clave) return ultimo.fotos.push(c);
    const [anio, mes] = clave.split('-');
    meses.push({
      clave,
      titulo: T.ajustes.mesYAnio(MESES[Number(mes) - 1], Number(anio)),
      // El índice en la lista COMPLETA: es lo que abre el visor, y el visor
      // pasa de una foto a la siguiente sin saber de meses.
      desde: i,
      fotos: [c],
    });
  });

  return (
    <>
      <FondoEspacial rango={miRango} planeta={miPlaneta} esquina="arriba-derecha" velo={0.72} />
      <PantallaDeslizable>
        <div className="titulo-pantalla">{T.album.titulo}</div>

        <GloboPrimeraVez cual="album">{T.album.globo}</GloboPrimeraVez>

        {error && <p className="error-msg">{error}</p>}

        {!cargado && <Esqueleto como="grilla" />}
        {noCargo && <NoCargo reintentar={() => window.location.reload()} />}

        {/* `noCargo` corta las dos ramas de abajo. Sin esto, una consulta que
            falla mostraba el cartel de "no se pudieron traer tus datos" Y
            debajo "Ninguna foto todavía" — que es la mentira que el `if
            (errFotos)` de arriba vino a arreglar, dicha igual dos líneas más
            abajo. Estaba desde antes de rehacer esta pantalla. */}
        {noCargo ? null : celdas.length > 0 ? (
          /* GRILLA PAREJA: todas las celdas son el mismo cuadrado.

             Antes era un mosaico donde cada quinta foto ocupaba el ancho
             entero con relación 16/10. Con UNA sola foto, esa foto ERA la
             quinta —`nth-child(5n + 1)` agarra también a la primera— y el
             álbum entero era un rectángulo gigante. Un patrón que necesita
             cinco fotos para leerse no puede ser el que decide cómo se ve el
             álbum el día que tenés una. */
          <>
            {meses.map((m) => (
              <div className="album-mes" key={m.clave}>
                <h3>{m.titulo}</h3>
                <div className="album-grilla">
                  {m.fotos.map((c, j) => (
                    <button
                      className="album-celda"
                      key={c.id}
                      onClick={() => setAbierta(m.desde + j)}
                      aria-label={fechaLinda(c.fecha)}
                    >
                      {c.url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.url} alt="" loading="lazy" />
                      )}
                      {/* Un punto y nada más. Quién ve cada foto tiene que
                          poder verse de un vistazo, pero un rótulo con letras
                          encima de una miniatura de un tercio de pantalla no
                          se lee: tapa la foto y no se entiende. */}
                      {c.visibilidad === 'amigos' && <span className="album-punto" />}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
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
      {abierta !== null && celdas[abierta] && (
        <VisorFoto
          foto={celdas[abierta]}
          hayAnterior={abierta > 0}
          haySiguiente={abierta < celdas.length - 1}
          alMover={(paso) => setAbierta((i) => (i === null ? null : i + paso))}
          alCambiarVisibilidad={() => alternarVisibilidad(celdas[abierta])}
          alBorrar={() => borrar(celdas[abierta])}
          alCerrar={() => setAbierta(null)}
        />
      )}

      <Nav />
    </>
  );
}
