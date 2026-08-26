'use client';

import { useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { DIAS_SEMANA, hoyISO } from '@/lib/fechas';
import type { Perfil } from '@/lib/tipos';

export default function Descansos({
  perfil,
  alCambiar,
  recargar,
}: {
  perfil: Perfil;
  alCambiar: (parcial: Partial<Perfil>) => void;
  recargar: () => void;
}) {
  const [supabase] = useState(() => crearCliente());

  // Días fijos de descanso semanal. El cambio rige DESDE HOY hacia adelante:
  // el pasado queda con la configuración que estaba vigente entonces, así que
  // cambiar de rutina nunca hace perder rachas ya ganadas.
  async function alternar(dia: number) {
    const nuevos = perfil.dias_descanso.includes(dia)
      ? perfil.dias_descanso.filter((d) => d !== dia)
      : [...perfil.dias_descanso, dia];
    alCambiar({ dias_descanso: nuevos });
    const { error } = await supabase.rpc('fijar_descansos', { p_dias: nuevos });
    if (error) recargar(); // no se guardó: se vuelve a lo que dice la base
  }

  return (
    <div className="seccion">
      <h3>Días de descanso</h3>
      <div className="dias-selector">
        {DIAS_SEMANA.map((d, i) => (
          <button
            key={i}
            className={perfil.dias_descanso.includes(i) ? 'activo' : ''}
            onClick={() => alternar(i)}
          >
            {d}
          </button>
        ))}
      </div>
      <p className="nota-privada" style={{ marginTop: 8 }}>
        Esos días podés faltar sin perder la racha.
      </p>
    </div>
  );
}
