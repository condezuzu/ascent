'use client';

import { useEffect, useRef, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { DIAS_SEMANA, hoyISO } from '@nucleo/fechas';
import type { Perfil } from '@nucleo/tipos';
import { avisarFallo } from '@compartido/cola';
import { escritorEnFila } from '@compartido/enFila';
import { T } from '@nucleo/textos';

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
  //
  // EN FILA (4/10): dos toques seguidos eran dos escrituras sueltas. Ver
  // `escritorEnFila`. `alCambiar` y `recargar` llegan nuevos en cada dibujo y la
  // fila vive más que un dibujo: se llama a los últimos.
  const ultimos = useRef({ alCambiar, recargar });
  useEffect(() => {
    ultimos.current = { alCambiar, recargar };
  });
  const [fila] = useState(() =>
    escritorEnFila<number[]>({
      guardado: perfil.dias_descanso,
      escribir: async (dias) => !(await supabase.rpc('fijar_descansos', { p_dias: dias })).error,
      iguales: (a, b) => a.length === b.length && a.every((d) => b.includes(d)),
      pintar: (dias) => ultimos.current.alCambiar({ dias_descanso: dias }),
      alFallar: () => {
        ultimos.current.recargar(); // no se guardó: se vuelve a lo que dice la base
        avisarFallo(T.general.falloDescansos);
      },
    })
  );
  useEffect(() => {
    fila.alDia(perfil.dias_descanso);
  }, [fila, perfil.dias_descanso]);

  function alternar(dia: number) {
    const ahora = fila.deseado();
    const nuevos = ahora.includes(dia) ? ahora.filter((d) => d !== dia) : [...ahora, dia];
    alCambiar({ dias_descanso: nuevos });
    fila.pedir(nuevos);
  }

  return (
    <div className="seccion">
      <h3>{T.ajustes.diasDescanso}</h3>
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
        {T.ajustes.diasDescansoNota}
      </p>
    </div>
  );
}
