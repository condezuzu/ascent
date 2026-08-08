'use client';

import { useEffect, useRef } from 'react';
import type { OpcionesFondo } from '@/motor/escena';
import { aplicarTema } from '@/lib/paletas';

// El fondo vive detrás de todo, con un velo plano oscuro entre el render y
// la interfaz. Cuanto más detallado el fondo, más velo.
// También aplica acá la paleta del rango a toda la app (variables CSS):
// este componente está en todas las pantallas y ya sabe rango y planeta.
export default function FondoEspacial(op: OpcionesFondo & { velo?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    aplicarTema(op.rango, op.planeta);
  }, [op.rango, op.planeta]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const equipoLento = (navigator.hardwareConcurrency ?? 8) < 4;
    const animar = op.animar !== false && !reduceMotion && !equipoLento;

    let fondo: { destruir: () => void } | null = null;
    let cancelado = false;
    // el motor se carga aparte para no meter three.js en el bundle inicial
    import('@/motor/escena').then(({ montarFondo }) => {
      if (cancelado) return;
      fondo = montarFondo(canvas, { ...op, animar });
    });
    return () => {
      cancelado = true;
      fondo?.destruir();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [op.rango, op.planeta, op.apagado, op.vacio, op.esquina]);

  const velo = op.velo ?? (op.rango >= 5 ? 0.62 : 0.5);

  return (
    <div className="fondo-espacial" aria-hidden>
      <canvas ref={ref} />
      <div className="velo" style={{ opacity: velo }} />
    </div>
  );
}
