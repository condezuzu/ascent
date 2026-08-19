'use client';

import { useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { hoyISO } from '@/lib/fechas';
import { RANGOS } from '@/lib/rangos';
import { borrarPerfilCache } from '@/lib/cache';
import type { Perfil } from '@/lib/tipos';

/** La única cuenta que ve esto. El candado de verdad está en el servidor. */
export const DUENO = 'condeeladmin';

/**
 * Ponerse en cualquier rango para revisar los colores y el objeto de fondo sin
 * entrenar ochenta días.
 *
 * Esconder la sección es comodidad, no seguridad: el permiso lo comprueba
 * `simular_racha` contra el nombre de usuario, así que desde otra cuenta la
 * llamada falla aunque alguien encuentre el RPC en el bundle —que viaja al
 * navegador de todos, siempre—.
 */
export default function SimularRacha({
  perfil,
  recargar,
}: {
  perfil: Perfil;
  recargar: () => void;
}) {
  const [supabase] = useState(() => crearCliente());
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');

  if (perfil.username !== DUENO) return null;

  async function poner(racha: number) {
    setOcupado(true);
    setAviso('');
    const { error } = await supabase.rpc('simular_racha', { p_racha: racha });
    setOcupado(false);
    if (error) return setAviso('No se pudo. ¿Corriste la migración 11?');
    // la caché tiene la racha vieja y la pinta al entrar
    borrarPerfilCache();
    recargar();
  }

  async function volverAloReal() {
    setOcupado(true);
    setAviso('');
    const { error } = await supabase.rpc('recalcular_desde_cero', { p_hoy: hoyISO() });
    setOcupado(false);
    if (error) return setAviso('No se pudo recalcular.');
    borrarPerfilCache();
    setAviso('Listo, tu racha volvió a salir del historial.');
    recargar();
  }

  return (
    <div className="seccion">
      <h3>Revisar rangos</h3>
      <div className="rangos-simular">
        {RANGOS.map((r) => (
          <button
            key={r.n}
            // el primer día de cada rango: ahí se ve el objeto recién formado
            onClick={() => poner(r.desde === 0 ? 1 : r.desde)}
            disabled={ocupado}
            className={perfil.rango_actual === r.n ? 'activo' : ''}
          >
            {r.nombre}
          </button>
        ))}
      </div>
      <p className="nota-privada">
        El rango 4 cambia de planeta cada día: del 30 al 39 hay uno distinto por día.
      </p>
      <button className="boton-texto" onClick={volverAloReal} disabled={ocupado}>
        Volver a mi racha real
      </button>
      {aviso && <p className="ok-msg">{aviso}</p>}
    </div>
  );
}
