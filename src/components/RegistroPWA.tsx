'use client';

import { useEffect } from 'react';

// Registra el service worker y captura el beforeinstallprompt apenas dispara.
// El navegador lo emite una sola vez y temprano — si no se guarda acá,
// cuando el usuario llega a Ajustes el botón de instalar ya no puede existir.
export default function RegistroPWA() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      (window as unknown as { __eventoInstalar?: Event }).__eventoInstalar = e;
      window.dispatchEvent(new CustomEvent('ascent:instalable'));
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);
  return null;
}
