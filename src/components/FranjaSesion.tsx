'use client';

import { useCallback, useEffect, useState } from 'react';
import { leerPerfilCache } from '@/lib/cache';
import { cronoLindo, transcurrido } from '@/lib/sesiones';
import {
  AVISO,
  duracionPredeterminada,
  guardarDuracionDeSesion,
  leerDuracionDeSesion,
  leerSesionCache,
  type SesionCacheada,
} from '@/lib/sesionCache';
import {
  duracionValida,
  guardarDescanso,
  leerDescanso,
  type DescansoVivo,
} from '@/lib/descanso';
import Descanso from '@/components/Descanso';

/**
 * La franja de la sesión, apoyada arriba de la barra de navegación y visible
 * en TODAS las pantallas mientras haya una sesión corriendo (§17.6b).
 *
 * Es la pieza que resuelve el problema real: descansar pasa quince o veinte
 * veces por entrenamiento, y tener que volver a Inicio cada vez es lo mismo
 * que no tenerlo. Empezar la sesión pasa una sola vez, y para eso está la
 * pestaña.
 *
 * Se pinta desde la caché y no desde un `mi_sesion` por pantalla: la franja
 * aparece en las seis pestañas y un viaje de red por navegación se notaría.
 * La autoridad sigue siendo la base, y la reconcilia `/sesion`.
 */
export default function FranjaSesion() {
  const [sesion, setSesion] = useState<SesionCacheada | null>(null);
  const [descanso, setDescanso] = useState<DescansoVivo | null>(null);
  const [, repintar] = useState(0);

  const releer = useCallback(() => {
    setSesion(leerSesionCache());
    setDescanso(leerDescanso());
  }, []);

  useEffect(() => {
    releer();
    const alVolver = () => releer();
    // `AVISO` es de ESTA pestaña —empezar o terminar la sesión—; `storage`
    // es de las otras; `visibilitychange` cubre que la caché haya vencido
    // sola mientras la app estaba dormida.
    window.addEventListener(AVISO, alVolver);
    window.addEventListener('storage', alVolver);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.removeEventListener(AVISO, alVolver);
      window.removeEventListener('storage', alVolver);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [releer]);

  // La franja tapa el final del contenido, así que avisa para que las
  // pantallas dejen lugar. Se saca al terminar y al desmontar.
  useEffect(() => {
    document.body.classList.toggle('con-franja', !!sesion);
    return () => document.body.classList.remove('con-franja');
  }, [sesion]);

  // Solo repinta; el número sale siempre de restar contra el inicio (§17.5).
  useEffect(() => {
    if (!sesion) return;
    const id = setInterval(() => repintar((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [sesion]);

  function empezarDescanso() {
    const seg =
      leerDuracionDeSesion() ?? duracionValida(duracionPredeterminada(leerPerfilCache()));
    setDescanso(guardarDescanso(seg));
  }

  if (!sesion && !descanso) return null;

  return (
    <>
      {sesion && (
        <div className="franja-sesion">
          <span className="franja-tiempo">
            {cronoLindo(transcurrido(sesion.inicio, sesion.desfasaje))}
          </span>
          <button onClick={empezarDescanso}>Descansar</button>
        </div>
      )}

      {descanso && (
        <Descanso
          vivo={descanso}
          alReiniciar={(d) => {
            setDescanso(d);
            guardarDuracionDeSesion(d.duracion);
          }}
          alCerrar={() => setDescanso(null)}
        />
      )}
    </>
  );
}
