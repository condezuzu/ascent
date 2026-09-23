'use client';

import { useEffect, useRef, useState } from 'react';
import { RANGOS } from '@nucleo/rangos';
import { T } from '@nucleo/textos';
import { plataforma } from '@/plataforma';

// Se dispara SOLO después de que la escritura en base confirmó.
// Sin confeti, sin sonido, sin cartel de felicitaciones: el silencio es lo
// que lo hace sentir importante. Se puede saltar tocando la pantalla.
export default function SubidaRango({
  rangoAntes,
  rangoDespues,
  planeta,
  racha,
  alCerrar,
}: {
  rangoAntes: number;
  rangoDespues: number;
  /** Los días que se llevan: el número es la mitad de lo que se ganó. */
  racha?: number;
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
        // Un golpe corto cuando la forma queda hecha: es un momento del juego,
        // no un aviso de sistema, y el teléfono lo dice como dice los otros.
        plataforma.haptica.pulso();
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
          {/* DE DÓNDE VENÍAS NO SE DICE. "Dejaste atrás Luna" se sacó del
              teléfono el 23/9 y de acá el 24/9: la misma decisión en las dos
              apps. El momento es el rango al que llegaste, y nombrar el que
              dejaste le reparte la atención a lo que se acaba de perder.
              El argumento viejo era que "Luna" es una palabra hasta que se ve
              contra "Asteroide"; el objeto que se está mirando ya lo dice. */}
          {racha !== undefined && <div className="dias">{T.sesion.rangoDia(racha)}</div>}
          <div className="seguir">{T.sesion.rangoSeguir}</div>
        </div>
      )}
    </div>
  );
}
