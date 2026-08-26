'use client';

import { useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { guardarPreferencia } from './guardar';
import type { Perfil, Sexo as SexoValor } from '@/lib/tipos';
import { T } from '@/textos';

/**
 * El sexo es un campo OPCIONAL y existe por una sola razón: DOTS usa dos
 * juegos de coeficientes (§16.7). Quien no lo carga no tiene DOTS ni ranking,
 * y no se asume ninguno: un DOTS calculado con la fórmula equivocada es un
 * dato falso que además ordena mal el ranking, y nadie lo notaría.
 *
 * El aviso de abajo NO es letra chica ni una advertencia con tono de alarma
 * (§16.7c): activar el DOTS deja que los amigos deduzcan aproximadamente el
 * peso corporal, y eso se dice antes de guardar, no después.
 */
export default function Sexo({
  perfil,
  alCambiar,
}: {
  perfil: Perfil;
  alCambiar: (parcial: Partial<Perfil>) => void;
}) {
  const [supabase] = useState(() => crearCliente());
  const [error, setError] = useState('');

  async function elegir(valor: SexoValor) {
    setError('');
    const ok = await guardarPreferencia(supabase, perfil, 'sexo', valor, alCambiar);
    if (!ok) setError('No se pudo guardar. Probá de nuevo.');
  }

  // ?? null y no === null a secas: si el código llega antes que la migración
  // la columna no existe y el valor es undefined, que no es "sin cargar" para
  // una comparación estricta y dejaría los tres botones apagados.
  const actual = perfil.sexo ?? null;

  return (
    <div className="seccion">
      <h3>{T.ajustes.sexo}</h3>
      <div className="selector-vista">
        <button className={actual === null ? 'activo' : ''} onClick={() => elegir(null)}>
          {T.ajustes.sinCargar}
        </button>
        <button className={actual === 'f' ? 'activo' : ''} onClick={() => elegir('f')}>
          {T.ajustes.mujer}
        </button>
        <button className={actual === 'm' ? 'activo' : ''} onClick={() => elegir('m')}>
          {T.ajustes.hombre}
        </button>
      </div>
      {/* El aviso de §16.7c no se puede acortar hasta que desaparezca: es lo
          que hace que activar el DOTS sea una decisión y no una sorpresa. */}
      <p className="nota-privada">{T.ajustes.sexoNota}</p>
      <p className="nota-privada">
        {T.ajustes.sexoAviso}
      </p>
      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
