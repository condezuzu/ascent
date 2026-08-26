'use client';

import { useEffect, useState } from 'react';
import { T } from '@/textos';

type EventoInstalar = Event & { prompt: () => Promise<void> };

// Instalación de la PWA: botón directo donde el navegador lo permite
// (Android/Chrome), instrucciones donde no (iPhone).
// El evento lo captura RegistroPWA al arrancar la app; acá solo se consume.
export default function InstalarPWA() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [esIOS, setEsIOS] = useState(false);
  const [instalada, setInstalada] = useState(false);

  useEffect(() => {
    setEsIOS(/iPhone|iPad|iPod/.test(navigator.userAgent));
    setInstalada(window.matchMedia('(display-mode: standalone)').matches);
    const leer = () => {
      const e = (window as unknown as { __eventoInstalar?: EventoInstalar }).__eventoInstalar;
      if (e) setEvento(e);
    };
    leer();
    window.addEventListener('ascent:instalable', leer);
    return () => window.removeEventListener('ascent:instalable', leer);
  }, []);

  if (instalada) return null;

  return (
    <div className="seccion">
      <h3>{T.ajustes.instalar}</h3>
      {evento ? (
        <button
          className="boton-fantasma"
          onClick={async () => {
            await evento.prompt();
            setEvento(null);
            (window as unknown as { __eventoInstalar?: EventoInstalar }).__eventoInstalar =
              undefined;
          }}
        >
          {T.ajustes.instalarBoton}
        </button>
      ) : esIOS ? (
        <p style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.6 }}>
          {T.ajustes.instalarIOS}{' '}
          <strong style={{ color: 'var(--tinta)', fontWeight: 500 }}>
            {T.ajustes.instalarIOSAccion}
          </strong>
          {T.ajustes.instalarIOSFin}
        </p>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.6 }}>
          {T.ajustes.instalarNota}
        </p>
      )}
    </div>
  );
}
