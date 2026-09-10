'use client';

import { useEffect, useState } from 'react';
import Vidas from '@/components/Vidas';
import { fechaLinda } from '@nucleo/fechas';
import { T } from '@nucleo/textos';

/**
 * "FALTASTE, SE USÓ UNA VIDA."
 *
 * CUÁNDO. Al abrir la app el día después de faltar, una sola vez. No hace
 * falta guardar si ya se mostró: `verificar_perdida` devuelve los días que
 * ACABA de cubrir en esa llamada, y en la siguiente ya no hay nada nuevo que
 * cubrir. El aviso no se puede repetir porque el hecho no se repite.
 *
 * QUÉ DICE, Y QUÉ NO. Dice el hecho —faltaste, se usó, quedan dos— y nada
 * más. No felicita ("¡tu racha está a salvo!") ni reta ("no faltes"). La app
 * no opina sobre el día que alguien no fue al gimnasio; solo cuenta lo que
 * hizo con eso.
 *
 * LA ANIMACIÓN ES EL PUNTO QUE SE APAGA. Es corta y es lo único que se mueve:
 * enseña la mecánica sin explicarla, porque el mismo dibujo está en Stats con
 * un punto más. Con "reducir movimiento" no se anima: el texto ya lo dice.
 */
export default function VidaUsada({
  dias,
  quedan,
  total,
}: {
  /** Los días que se cubrieron en esta llamada, en ISO. */
  dias: string[];
  quedan: number;
  total: number;
}) {
  const [cerrado, setCerrado] = useState(false);
  // Arranca mostrando las vidas que había ANTES de gastar, y se apagan.
  const [gastando, setGastando] = useState(dias.length);

  useEffect(() => {
    const quieto =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (quieto) {
      setGastando(0);
      return;
    }
    const t = setTimeout(() => setGastando(0), 900);
    return () => clearTimeout(t);
  }, [dias.length]);

  if (cerrado || dias.length === 0) return null;

  return (
    <div className="globo globo-quieto vida-usada">
      <p>
        {dias.length === 1
          ? T.vidas.faltasteUno(fechaLinda(dias[0]))
          : T.vidas.faltasteVarios(dias.length)}{' '}
        <span className="quedan">
          {T.vidas.quedan(quedan)} <Vidas quedan={quedan} total={total} gastando={gastando} />
        </span>
      </p>
      <button onClick={() => setCerrado(true)} aria-label={T.general.entendido}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
