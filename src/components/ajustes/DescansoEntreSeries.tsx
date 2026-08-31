'use client';

import { useEffect, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { plataforma } from '@/plataforma';
import { PRESETS_DESCANSO } from '@nucleo/reglas';
import { duracionCorta, duracionValida, guardarSonido, leerSonido, puedeVibrar } from '@/lib/descanso';
import { guardarPreferencia } from './guardar';
import type { Perfil } from '@nucleo/tipos';
import { T } from '@nucleo/textos';

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
  const [respeta, setRespeta] = useState(false);

  // Las dos salen del navegador, así que no se pueden leer al renderizar en
  // el servidor: se leen al montar.
  useEffect(() => {
    (async () => setSonido(await leerSonido()))();
    setVibra(puedeVibrar());
    setRespeta(plataforma.audio.respetaLaMusica());
  }, []);

  const actual = duracionValida(perfil.duracion_descanso);

  return (
    <div className="seccion">
      <h3>{T.ajustes.descansoEntreSeries}</h3>
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
      <p className="nota-privada">{T.ajustes.descansoNota}</p>

      <button
        className="boton-texto"
        style={{ textAlign: 'left', paddingLeft: 0 }}
        onClick={() => {
          const nuevo = !sonido;
          setSonido(nuevo);
          guardarSonido(nuevo);
        }}
      >
        {sonido ? T.ajustes.sonidoPrendido : T.ajustes.sonidoApagado}
      </button>
      {/* Se dice qué va a pasar de verdad en ESTE teléfono. Prometer una
          vibración que no va a llegar hace que alguien guarde el teléfono en
          el bolsillo y se coma tres minutos de descanso (§18.7). */}
      <p className="nota-privada">
        {vibra ? T.ajustes.vibra : T.ajustes.noVibra}
      </p>
      {/* Misma idea que arriba: decir qué va a pasar de verdad en ESTE
          teléfono. Si el aviso puede cortarle la música a alguien que entrena
          con auriculares, se avisa antes de que lo prenda y no después. */}
      {sonido && (
        <p className="nota-privada">
          {respeta ? T.ajustes.sonidoRespeta : T.ajustes.sonidoCorta}
        </p>
      )}
    </div>
  );
}
