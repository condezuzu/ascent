'use client';

import { useEffect, useState } from 'react';
import { eventos } from '@/plataforma/eventos';
import { FALLO } from '@/lib/cola';
import { anotar } from '@/lib/bitacora';

/**
 * "No se pudo guardar", una sola vez y en un solo lugar.
 *
 * Existe para que arreglar los seis caminos mudos no fuera plomería: sin esto,
 * cada uno tendría que llevarse su `useState` de error hasta la pantalla que
 * lo dibuja, y el séptimo camino que aparezca volvería a fallar callado porque
 * conectar el suyo cuesta trabajo. Acá cuesta una línea: `avisarFallo(...)`.
 *
 * Se va solo a los seis segundos. No es un diálogo que haya que despachar: no
 * hay nada que decidir, es información. Y queda anotado en la bitácora, así
 * que si pasa en el gimnasio se puede mirar después aunque el aviso ya no esté.
 */
export default function AvisoDeFallo() {
  const [que, setQue] = useState('');

  useEffect(() => {
    return eventos.escuchar(FALLO, (mensaje) => {
      const texto = String(mensaje ?? '');
      setQue(texto);
      anotar('no se pudo', { que: texto });
      setTimeout(() => setQue(''), 6000);
    });
  }, []);

  if (!que) return null;

  return (
    <div className="aviso-fallo" role="status" aria-live="polite">
      {que}
    </div>
  );
}
