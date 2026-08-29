'use client';

import { useEffect, useState } from 'react';
import { fechaLinda } from '@/lib/fechas';
import { T } from '@/textos';

export type FotoDelVisor = {
  id: string;
  url: string;
  fecha: string;
  planeta: string | null;
  visibilidad: 'privada' | 'amigos';
  esSubida: boolean;
};

/**
 * UNA FOTO, A PANTALLA COMPLETA, CON LO QUE SE PUEDE HACER CON ELLA.
 *
 * POR QUÉ EXISTE. En la grilla, cada foto medía un tercio de pantalla y encima
 * tenía dos botones de 34 px superpuestos: uno para la visibilidad y otro para
 * borrar. O sea que las dos únicas acciones vivían pegadas ENCIMA de la foto,
 * tapándola, en el tamaño más chico en que la foto va a estar nunca — y no
 * había forma de ver la foto en grande, porque tocarla no hacía nada.
 *
 * Ahora la grilla solo muestra, y todo lo que se hace se hace acá, con la foto
 * en el tamaño que corresponde para decidir si te gusta o la borrás.
 *
 * LAS FORMAS SIGUEN §19.1: la visibilidad es una PÍLDORA porque se elige entre
 * dos opciones; borrar es texto subrayado porque es secundario y no puede
 * competir; no hay ninguna caja, porque nada acá necesita sentirse contenido.
 *
 * EL BORRADO SIGUE SIENDO DE DOS TOQUES y la confirmación aparece en el mismo
 * lugar del botón, no en un diálogo del navegador. Un `confirm()` del sistema
 * habría sido más corto de escribir y es lo único de toda la app que se vería
 * como otra app.
 */
export default function VisorFoto({
  foto,
  hayAnterior,
  haySiguiente,
  alMover,
  alCambiarVisibilidad,
  alBorrar,
  alCerrar,
}: {
  foto: FotoDelVisor;
  hayAnterior: boolean;
  haySiguiente: boolean;
  alMover: (paso: -1 | 1) => void;
  alCambiarVisibilidad: () => void;
  alBorrar: () => void;
  alCerrar: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);

  // Cambiar de foto cancela la confirmación: si no, pasás a la siguiente con
  // el "¿Borrar?" ya abierto y el próximo toque borra la que no era.
  useEffect(() => {
    setConfirmando(false);
  }, [foto.id]);

  // Escape cierra, las flechas mueven. Es gratis en teléfono y es lo que hace
  // que la pantalla sea usable con teclado, que es como la reviso yo.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
      if (e.key === 'ArrowLeft' && hayAnterior) alMover(-1);
      if (e.key === 'ArrowRight' && haySiguiente) alMover(1);
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [alCerrar, alMover, hayAnterior, haySiguiente]);

  return (
    <div className="visor" role="dialog" aria-modal="true">
      {/* El fondo cierra. La foto y la barra de abajo no: tocar la foto para
          verla mejor no puede sacarte de la pantalla. */}
      <div className="visor-fondo" onClick={alCerrar} />

      <button className="visor-cerrar" onClick={alCerrar} aria-label={T.general.cerrar}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div className="visor-marco">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={foto.url} alt="" />
      </div>

      {hayAnterior && (
        <button className="visor-paso izq" onClick={() => alMover(-1)} aria-label={T.album.anterior}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      )}
      {haySiguiente && (
        <button className="visor-paso der" onClick={() => alMover(1)} aria-label={T.album.siguiente}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      <div className="visor-pie">
        {/* La fecha manda y el planeta la acompaña: el planeta es el dato que
            solo tiene esta app, pero sin la fecha no se ubica en el tiempo. */}
        <div className="visor-cuando">
          <span className="fecha">{fechaLinda(foto.fecha)}</span>
          {foto.planeta && <span className="planeta">{foto.planeta}</span>}
          {foto.esSubida && <span className="planeta">{T.album.deSubida}</span>}
        </div>

        <div className="visor-acciones">
          {/* Píldora: se elige entre dos estados y se ve en cuál estás. */}
          <button
            className={`pastilla ${foto.visibilidad === 'amigos' ? 'prendida' : ''}`}
            onClick={alCambiarVisibilidad}
          >
            {foto.visibilidad === 'privada' ? T.album.soloVos : T.album.amigos}
          </button>

          {confirmando ? (
            <span className="visor-confirmar">
              <span>{T.album.borrarPregunta}</span>
              <button className="boton-texto" onClick={alBorrar}>
                {T.album.si}
              </button>
              <button className="boton-texto" onClick={() => setConfirmando(false)}>
                {T.album.no}
              </button>
            </span>
          ) : (
            <button className="boton-texto" onClick={() => setConfirmando(true)}>
              {T.album.borrarFoto}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
