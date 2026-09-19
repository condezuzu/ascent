'use client';

import { useEffect, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { fechaLinda } from '@nucleo/fechas';
import { cambiarVisibilidad, cargarAlbum, porMes, quitarFoto, type Celda } from '@compartido/album';
import { avisarFallo } from '@compartido/cola';
import FondoEspacial from '@/components/FondoEspacial';
import Nav from '@/components/Nav';
import PantallaDeslizable from '@/components/PantallaDeslizable';
import VisorFoto from '@/components/VisorFoto';
import Esqueleto from '@/components/Esqueleto';
import NoCargo from '@/components/NoCargo';
import { T } from '@nucleo/textos';

export default function Album() {
  const [supabase] = useState(() => crearCliente());
  const [celdas, setCeldas] = useState<Celda[]>([]);
  const [cargado, setCargado] = useState(false);
  // `undefined` = todavía no se sabe: el fondo usa el último propio, no el
  // gris del rango 1 (19/9).
  const [miRango, setMiRango] = useState<number | undefined>(undefined);
  const [miPlaneta, setMiPlaneta] = useState<string | null>(null);
  // Qué foto está abierta a pantalla completa. Se guarda el ÍNDICE y no el id
  // porque desde el visor se pasa a la de al lado, y "la de al lado" solo
  // existe como posición en la lista.
  const [abierta, setAbierta] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [noCargo, setNoCargo] = useState(false);

  // LAS CONSULTAS VIVEN EN `compartido/album.ts` desde el 18/9: las usa
  // también la app nativa.
  useEffect(() => {
    (async () => {
      const user = await miUsuario(supabase);
      if (!user) return;
      const d = await cargarAlbum(supabase, user.id);
      if (!d) {
        setNoCargo(true);
        return setCargado(true);
      }
      setNoCargo(false);
      setMiRango(d.miRango);
      setMiPlaneta(d.miPlaneta);
      setCeldas(d.celdas);
      setCargado(true);
    })();
  }, [supabase]);

  async function alternarVisibilidad(c: Celda) {
    const nueva = c.visibilidad === 'privada' ? 'amigos' : 'privada';
    if (!(await cambiarVisibilidad(supabase, c.id, nueva))) return avisarFallo(T.general.falloVisibilidad);
    setCeldas((prev) => prev.map((x) => (x.id === c.id ? { ...x, visibilidad: nueva } : x)));
  }

  // Borrado en dos toques; el segundo llega desde el visor.
  //
  // Primero el archivo y después la fila: si el archivo no se pudo borrar, la
  // foto sigue existiendo y se puede reintentar. Al revés quedaría un archivo
  // huérfano en el storage que ya nadie sabe que está.
  async function borrar(c: Celda) {
    setError('');
    if (!(await quitarFoto(supabase, c.id, c.ruta))) return setError(T.album.noSeQuito);

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
  const meses = porMes(celdas);

  return (
    <>
      <FondoEspacial rango={miRango} planeta={miPlaneta} propio esquina="arriba-derecha" velo={0.72} />
      {/* No aparece hasta tener la lista de fotos (19/9): antes se veía el
          álbum vacío y después las fotos. Ver `PantallaDeslizable`. */}
      <PantallaDeslizable listo={cargado}>
        <div className="titulo-pantalla">{T.album.titulo}</div>


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
                        // <img> y no next/image: son URLs firmadas de Supabase que vencen en una hora, y el optimizador las cachearia vencidas.
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
