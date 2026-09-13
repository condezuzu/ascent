'use client';

import { useEffect, useRef, useState } from 'react';
import { RANGOS } from '@nucleo/rangos';
import { T } from '@nucleo/textos';

// Se dispara SOLO después de que la escritura en base confirmó.
// Sin confeti, sin sonido, sin cartel de felicitaciones: el silencio es lo
// que lo hace sentir importante. Se puede saltar tocando la pantalla.
export default function SubidaRango({
  rangoAntes,
  rangoDespues,
  planeta,
  alCerrar,
}: {
  rangoAntes: number;
  rangoDespues: number;
  /** El planeta de esta persona: el rango 4 no es un planeta cualquiera. */
  planeta?: string | null;
  alCerrar: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mostrarNombre, setMostrarNombre] = useState(false);
  const controlRef = useRef<{ saltar: () => void; destruir: () => void } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelado = false;
    import('@/motor/subida').then(({ animarSubida }) => {
      if (cancelado) return;
      controlRef.current = animarSubida(canvas, rangoAntes, rangoDespues, () => {
        // el nombre del rango aparece último, cuando el objeto ya está formado
        setMostrarNombre(true);
      }, planeta);
    });
    return () => {
      cancelado = true;
      controlRef.current?.destruir();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangoAntes, rangoDespues]);

  const nombre = RANGOS.find((r) => r.n === rangoDespues)?.nombre ?? '';

  function tocar() {
    if (mostrarNombre) alCerrar();
    else controlRef.current?.saltar();
  }

  return (
    <div className="subida" onClick={tocar}>
      <canvas ref={canvasRef} />
      {mostrarNombre && (
        <div className="subida-nombre">
          <div className="chico">{T.sesion.nuevoRango}</div>
          <div className="grande">{nombre}</div>
        </div>
      )}
    </div>
  );
}
