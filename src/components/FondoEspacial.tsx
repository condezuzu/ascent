'use client';

import { useEffect, useRef, useState } from 'react';
import type { OpcionesFondo } from '@/motor/escena';
import { aplicarTema } from '@/lib/paletas';
import { marca, medir, instalarLector } from '@/lib/medir';

// El fondo vive detrás de todo, con un velo plano oscuro entre el render y
// la interfaz. Cuanto más detallado el fondo, más velo.
//
// La interfaz NUNCA espera al motor: el degradado de la paleta se pinta en
// CSS al instante y el canvas entra con un fundido recién cuando está listo.
export default function FondoEspacial(op: OpcionesFondo & { velo?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [listo, setListo] = useState(false);

  // La paleta se aplica de forma sincrónica, antes de pintar: así el fondo
  // ya sale con el color del rango y no hay salto de gris a color.
  if (typeof document !== 'undefined') aplicarTema(op.rango, op.planeta);

  useEffect(() => {
    aplicarTema(op.rango, op.planeta);
  }, [op.rango, op.planeta]);

  useEffect(() => {
    instalarLector();
    const cont = ref.current;
    if (!cont) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animar = op.animar !== false && !reduceMotion;

    let soltar: (() => void) | null = null;
    let cancelado = false;

    marca('ascent:motor-import-inicio');
    // el motor se carga aparte para no meter three.js en el bundle inicial
    import('@/motor/escena').then(({ montarFondo }) => {
      marca('ascent:motor-import-fin');
      medir('ascent:motor-import', 'ascent:motor-import-inicio', 'ascent:motor-import-fin');
      if (cancelado) return;
      marca('ascent:motor-montar-inicio');
      soltar = montarFondo(cont, { ...op, animar });
      marca('ascent:motor-montar-fin');
      medir('ascent:motor-montar', 'ascent:motor-montar-inicio', 'ascent:motor-montar-fin');
      medir('ascent:motor-total', 'ascent:motor-import-inicio', 'ascent:motor-montar-fin');
      if (!cancelado) setListo(true);
    });

    return () => {
      cancelado = true;
      soltar?.();
      setListo(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    op.rango,
    op.planeta,
    op.apagado,
    op.vacio,
    op.esquina,
    op.reposo,
    op.fantasma?.rango,
    op.fantasma?.planeta,
  ]);

  const velo = op.velo ?? (op.rango >= 5 ? 0.62 : 0.5);

  return (
    <div className="fondo-espacial" aria-hidden>
      {/* Base en CSS puro: se ve al instante, sin esperar a WebGL */}
      <div className="fondo-base" />
      <div ref={ref} className={`fondo-lienzo ${listo ? 'listo' : ''}`} />
      <div className="velo" style={{ opacity: velo }} />
    </div>
  );
}
