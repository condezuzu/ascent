'use client';

import { useEffect, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { PRESETS_DESCANSO } from '@/lib/reglas';
import { duracionCorta, duracionValida, guardarSonido, leerSonido, puedeVibrar } from '@/lib/descanso';
import { guardarPreferencia } from './guardar';
import type { Perfil } from '@/lib/tipos';

/**
 * Cuánto dura el descanso entre series (§18.5). Acá se elige el
 * PREDETERMINADO —con qué arranca cada sesión—; durante el descanso los
 * mismos presets lo cambian solo para lo que queda de esa sesión.
 */
export default function DescansoEntreSeries({
  perfil,
  alCambiar,
}: {
  perfil: Perfil;
  alCambiar: (parcial: Partial<Perfil>) => void;
}) {
  const [supabase] = useState(() => crearCliente());
  const [sonido, setSonido] = useState(false);
  const [vibra, setVibra] = useState(false);

  // Las dos salen del navegador, así que no se pueden leer al renderizar en
  // el servidor: se leen al montar.
  useEffect(() => {
    (async () => setSonido(await leerSonido()))();
    setVibra(puedeVibrar());
  }, []);

  const actual = duracionValida(perfil.duracion_descanso);

  return (
    <div className="seccion">
      <h3>Descanso entre series</h3>
      <div className="selector-vista">
        {PRESETS_DESCANSO.map((p) => (
          <button
            key={p}
            className={p === actual ? 'activo' : ''}
            onClick={() => guardarPreferencia(supabase, perfil, 'duracion_descanso', p, alCambiar)}
          >
            {duracionCorta(p)}
          </button>
        ))}
      </div>
      <p className="nota-privada">Mientras descansás lo podés cambiar ahí mismo.</p>

      <button
        className="boton-texto"
        style={{ textAlign: 'left', paddingLeft: 0 }}
        onClick={() => {
          const nuevo = !sonido;
          setSonido(nuevo);
          guardarSonido(nuevo);
        }}
      >
        {sonido ? 'Sonido al terminar ✓' : 'Sonido al terminar — apagado'}
      </button>
      {/* Se dice qué va a pasar de verdad en ESTE teléfono. Prometer una
          vibración que no va a llegar hace que alguien guarde el teléfono en
          el bolsillo y se coma tres minutos de descanso (§18.7). */}
      <p className="nota-privada">
        {vibra
          ? 'Vibra al terminar, con la app abierta. Si la cerrás, no avisa.'
          : 'Tu teléfono no vibra desde la web: el aviso es visual, con la app abierta.'}
      </p>
    </div>
  );
}
