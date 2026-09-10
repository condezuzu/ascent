'use client';

import { useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { guardarPreferencia } from './guardar';
import { UMBRALES, umbralValido, type Umbral } from '@nucleo/estancamiento';
import type { Perfil } from '@nucleo/tipos';
import { T } from '@nucleo/textos';

/**
 * LOS AVISOS DE ESTANCAMIENTO: cada cuánto, o ninguno.
 *
 * Dos controles y no uno, porque son dos preguntas distintas: si querés que
 * la app te diga que algo no se mueve, y a partir de cuánto tiempo cuenta
 * como "no se mueve". Juntarlas en un solo selector con un "nunca" al final
 * mezcla una preferencia de contenido con una de frecuencia.
 *
 * El umbral se dice EN SEMANAS y no en "poco/medio/mucho": el que entrena
 * sabe perfectamente qué son tres semanas sin subir, y una etiqueta vaga
 * obliga a adivinar qué decidió la app por vos.
 */
export default function Estancamiento({
  perfil,
  alCambiar,
}: {
  perfil: Perfil;
  alCambiar: (p: Partial<Perfil>) => void;
}) {
  // Si la migración 30 todavía no corrió, la columna no viene y el valor es
  // `undefined`: se muestra el valor por omisión de la base, que es lo que la
  // base va a usar igual.
  const [supabase] = useState(() => crearCliente());
  const prendido = perfil.avisos_estancamiento !== false;
  const umbral = umbralValido(perfil.umbral_estancamiento);

  const guardarUmbral = (u: Umbral) =>
    guardarPreferencia(supabase, perfil, 'umbral_estancamiento', u, alCambiar);
  const guardarPrendido = (v: boolean) =>
    guardarPreferencia(supabase, perfil, 'avisos_estancamiento', v, alCambiar);

  return (
    <div className="seccion">
      <h3>{T.ajustes.estancamiento}</h3>
      <div className="selector-vista">
        <button
          className={prendido ? 'activo' : ''}
          onClick={() => guardarPrendido(true)}
        >
          {T.ajustes.estancamientoSi}
        </button>
        <button
          className={!prendido ? 'activo' : ''}
          onClick={() => guardarPrendido(false)}
        >
          {T.ajustes.estancamientoNo}
        </button>
      </div>

      {prendido && (
        <>
          <div className="selector-vista" style={{ marginTop: 10 }}>
            {UMBRALES.map((u: Umbral) => (
              <button
                key={u}
                className={u === umbral ? 'activo' : ''}
                onClick={() => guardarUmbral(u)}
              >
                {T.ajustes.semanas(u)}
              </button>
            ))}
          </div>
          <p className="nota-privada">{T.ajustes.estancamientoNota(umbral)}</p>
        </>
      )}
    </div>
  );
}
