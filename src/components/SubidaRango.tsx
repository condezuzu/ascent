'use client';

import { useEffect, useRef, useState } from 'react';
import { RANGOS } from '@/lib/rangos';

// Se dispara SOLO después de que la escritura en base confirmó.
// Sin confeti, sin sonido, sin cartel de felicitaciones: el silencio es lo
// que lo hace sentir importante. Se puede saltar tocando la pantalla.
export default function SubidaRango({
  rangoAntes,
  rangoDespues,
  alCerrar,
}: {
  rangoAntes: number;
  rangoDespues: number;
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
      });
    });
    return () => {
      cancelado = true;
      controlRef.current?.destruir();
    };
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
          <div className="chico">Nuevo rango</div>
          <div className="grande">{nombre}</div>
        </div>
      )}
    </div>
  );
}
