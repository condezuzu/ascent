'use client';

import { useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { guardarPreferencia } from './guardar';
import type { Perfil, Sexo as SexoValor } from '@/lib/tipos';

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
      <h3>Sexo — solo para el DOTS</h3>
      <div className="selector-vista">
        <button className={actual === null ? 'activo' : ''} onClick={() => elegir(null)}>
          Sin cargar
        </button>
        <button className={actual === 'f' ? 'activo' : ''} onClick={() => elegir('f')}>
          Mujer
        </button>
        <button className={actual === 'm' ? 'activo' : ''} onClick={() => elegir('m')}>
          Hombre
        </button>
      </div>
      <p className="nota-privada">
        La fórmula que compara fuerza entre personas de distinto tamaño usa dos juegos de números
        según el sexo. Sin este dato no hay DOTS ni ranking; el resto de tus marcas funciona igual.
      </p>
      <p className="nota-privada">
        Al cargarlo, tus amigos van a poder deducir aproximadamente cuánto pesás: ya ven tus
        levantamientos, y el DOTS los relaciona con el peso corporal. Por eso solo se muestra la
        banda y nunca el número exacto, pero la banda no lo esconde del todo.
      </p>
      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
