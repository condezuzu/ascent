'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { faltaElGlobo, marcarGloboVisto, type Globo } from '@compartido/guia';
import { T } from '@nucleo/textos';

/**
 * EL GLOBO DE CÓMIC (15/10, aprobado en la galería): una línea, del ancho de su
 * texto, con una colita que sale de lo que explica. Se cierra y no vuelve más
 * (salvo "Volver a ver la guía" en Ajustes).
 *
 * Va DESPUÉS del elemento del que habla, en un ancla de alto cero: flota sin
 * correr nada. `apuntaA` es un selector de ese elemento, buscado en el mismo
 * contenedor que el ancla; el globo se mide contra él y aparece 9 px debajo,
 * con la cola en su centro. `alinear` decide hacia dónde crece.
 *
 * Arranca oculto y aparece recién cuando se confirmó que falta verlo: si se
 * mostrara mientras se consulta, el que ya lo cerró lo vería parpadear.
 */
export default function GloboPrimeraVez({
  cual,
  children,
  apuntaA,
  alinear = 'izquierda',
  cerrarCuando = false,
  vistoAlMostrar = false,
}: {
  cual: Globo;
  children: string;
  apuntaA: string;
  alinear?: 'izquierda' | 'centro' | 'derecha';
  /** Se cierra solo —y queda visto— cuando esto pasa a `true`: la cosa que explica ya se usó. */
  cerrarCuando?: boolean;
  /** Queda visto apenas aparece: los que no tienen un "ya se usó" claro. */
  vistoAlMostrar?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [uid, setUid] = useState('');
  const [lugar, setLugar] = useState<{ arriba: number; izquierda: number; cola: number } | null>(null);
  const ancla = useRef<HTMLDivElement>(null);
  const globo = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const supabase = crearCliente();
      const user = await miUsuario(supabase);
      if (!vivo || !user) return;
      setUid(user.id);
      if (!(await faltaElGlobo(user.id, cual, user.created_at)) || !vivo) return;
      setVisible(true);
      if (vistoAlMostrar) void marcarGloboVisto(user.id, cual);
    })();
    return () => {
      vivo = false;
    };
  }, [cual, vistoAlMostrar]);

  useLayoutEffect(() => {
    const a = ancla.current;
    const contenedor = a?.parentElement;
    if (!visible || !a || !contenedor) return;
    const medir = () => {
      const blanco = contenedor.querySelector(apuntaA);
      if (!blanco || !globo.current) return;
      const caja = a.getBoundingClientRect();
      const b = blanco.getBoundingClientRect();
      const cola = b.left + b.width / 2 - caja.left;
      const anchoGlobo = globo.current.offsetWidth;
      const sobra = Math.max(0, caja.width - anchoGlobo);
      const izquierda = alinear === 'izquierda' ? 0 : alinear === 'derecha' ? sobra : Math.min(Math.max(0, cola - anchoGlobo / 2), sobra);
      setLugar({ arriba: b.bottom - caja.top + 9, izquierda, cola });
    };
    medir();
    const mirar = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir);
    mirar?.observe(contenedor);
    return () => mirar?.disconnect();
  }, [visible, apuntaA, alinear]);

  function cerrar() {
    if (uid) void marcarGloboVisto(uid, cual); // no bloquea el cierre
    setCerrando(true);
    setTimeout(() => setVisible(false), 200);
  }

  useEffect(() => {
    if (cerrarCuando && visible && !cerrando) cerrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cerrarCuando, visible]);

  if (!visible) return null;

  return (
    <div className="globo-ancla" ref={ancla}>
      <div
        className={`globo-capa ${lugar && !cerrando ? 'listo' : ''}`}
        style={{ top: lugar?.arriba ?? 0 }}
      >
        <button ref={globo} className="globo-comic" data-testid={`globo-${cual}`} style={{ left: lugar?.izquierda ?? 0 }} onClick={cerrar} aria-label={`${children} ${T.general.entendido}`}>
          <span>{children}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        {/* La cola: un cuadrado girado con el borde en los dos lados de afuera, encima del borde del globo. */}
        <span className="globo-cola" style={{ left: (lugar?.cola ?? 0) - 6 }} aria-hidden />
      </div>
    </div>
  );
}
