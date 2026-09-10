'use client';

import { useEffect, useRef, useState } from 'react';
import { fechaLinda } from '@nucleo/fechas';
import { T } from '@nucleo/textos';

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
  // El marco es lo que se arrastra al pasar de foto.
  const marcoRef = useRef<HTMLDivElement>(null);

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

  // DESLIZAR PARA PASAR DE FOTO.
  //
  // Las flechas ya estaban y no alcanzan: son dos blancos de 40 px en los
  // bordes de una pantalla que se mira con el pulgar. Nadie las busca, porque
  // en una foto a pantalla completa el gesto que uno ya tiene aprendido es
  // arrastrar. Sin esto había que cerrar el visor y elegir otra, que es
  // exactamente lo que se reportó.
  //
  // El mismo criterio que `PantallaDeslizable`: la foto SIGUE AL DEDO y al
  // soltar completa o vuelve. Un gesto que no muestra nada hasta soltar se
  // siente como un botón escondido.
  useEffect(() => {
    const el = marcoRef.current;
    if (!el) return;
    let x0 = 0;
    let y0 = 0;
    let arrastrando = false;
    let decidido = false;

    const ancho = () => el.clientWidth || window.innerWidth;

    function empezar(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      arrastrando = true;
      decidido = false;
      el!.style.transition = 'none';
    }

    function mover(e: TouchEvent) {
      if (!arrastrando) return;
      const dx = e.touches[0].clientX - x0;
      const dy = e.touches[0].clientY - y0;
      if (!decidido) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        // Vertical no es nuestro: cerrar el visor tirando hacia abajo es otro
        // gesto y no está; robarle el evento sería impedirlo para siempre.
        if (Math.abs(dy) > Math.abs(dx)) {
          arrastrando = false;
          return;
        }
        decidido = true;
      }
      // En los extremos el arrastre ofrece resistencia: se nota que de ese
      // lado no hay nada, sin un cartel que lo diga.
      const sinDestino = (dx > 0 && !hayAnterior) || (dx < 0 && !haySiguiente);
      el!.style.transform = `translate3d(${sinDestino ? dx * 0.25 : dx}px, 0, 0)`;
    }

    function soltar(e: TouchEvent) {
      if (!arrastrando) return;
      arrastrando = false;
      if (!decidido) return;
      const dx = (e.changedTouches[0]?.clientX ?? x0) - x0;
      el!.style.transition = 'transform 0.24s var(--curva-salida)';
      el!.style.transform = '';
      if (Math.abs(dx) > ancho() * 0.2) {
        if (dx > 0 && hayAnterior) alMover(-1);
        if (dx < 0 && haySiguiente) alMover(1);
      }
    }

    el.addEventListener('touchstart', empezar, { passive: true });
    el.addEventListener('touchmove', mover, { passive: true });
    el.addEventListener('touchend', soltar, { passive: true });
    el.addEventListener('touchcancel', soltar, { passive: true });
    return () => {
      el.removeEventListener('touchstart', empezar);
      el.removeEventListener('touchmove', mover);
      el.removeEventListener('touchend', soltar);
      el.removeEventListener('touchcancel', soltar);
    };
  }, [alMover, hayAnterior, haySiguiente]);

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

      <div className="visor-marco" ref={marcoRef}>
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
