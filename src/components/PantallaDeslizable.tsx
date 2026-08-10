'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// El mismo orden que la barra de abajo
export const PESTANAS = ['/', '/social', '/album', '/stats', '/ajustes'] as const;

const UMBRAL = 0.22; // fracción del ancho a partir de la cual se cambia
const VELOCIDAD_MIN = 0.35; // px/ms: un gesto rápido cambia aunque sea corto

/**
 * Envuelve el contenido de una pestaña y permite cambiar deslizando.
 *
 * El contenido SIGUE AL DEDO mientras se arrastra —no salta al soltar— y al
 * soltar completa el movimiento o vuelve a su lugar. La barra de abajo sigue
 * funcionando igual.
 */
export default function PantallaDeslizable({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const [saliendo, setSaliendo] = useState<'izq' | 'der' | null>(null);

  const indice = PESTANAS.indexOf(ruta as (typeof PESTANAS)[number]);

  useEffect(() => {
    const el = ref.current;
    if (el === null || indice < 0) return;

    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    let arrastrando = false;
    let decidido = false;

    const ancho = () => el.clientWidth || window.innerWidth;

    function alEmpezar(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      t0 = performance.now();
      arrastrando = true;
      decidido = false;
      el!.style.transition = 'none';
    }

    function alMover(e: TouchEvent) {
      if (!arrastrando) return;
      const dx = e.touches[0].clientX - x0;
      const dy = e.touches[0].clientY - y0;

      // Hasta no saber si el gesto es horizontal o vertical no se toca nada:
      // si no, se rompe el scroll de la pantalla.
      if (!decidido) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          arrastrando = false; // es scroll, no es nuestro
          return;
        }
        decidido = true;
      }

      // en los extremos el arrastre ofrece resistencia, para que se note
      // que no hay nada más de ese lado
      const haciaAtras = dx > 0;
      const sinDestino = (haciaAtras && indice === 0) || (!haciaAtras && indice === PESTANAS.length - 1);
      const d = sinDestino ? dx * 0.25 : dx;
      el!.style.transform = `translate3d(${d}px, 0, 0)`;
      el!.style.opacity = String(Math.max(0.55, 1 - Math.abs(d) / (ancho() * 1.6)));
      e.preventDefault();
    }

    function alSoltar(e: TouchEvent) {
      if (!arrastrando) return;
      arrastrando = false;
      if (!decidido) return;

      const dx = (e.changedTouches[0]?.clientX ?? x0) - x0;
      const dt = Math.max(1, performance.now() - t0);
      const veloz = Math.abs(dx) / dt > VELOCIDAD_MIN;
      const suficiente = Math.abs(dx) > ancho() * UMBRAL;
      const haciaAtras = dx > 0;
      const destino = haciaAtras ? indice - 1 : indice + 1;

      el!.style.transition = 'transform 0.34s cubic-bezier(0.16,1,0.3,1), opacity 0.34s ease';

      if ((veloz || suficiente) && destino >= 0 && destino < PESTANAS.length) {
        // completa el movimiento y recién ahí navega
        setSaliendo(haciaAtras ? 'der' : 'izq');
        el!.style.transform = `translate3d(${haciaAtras ? ancho() : -ancho()}px, 0, 0)`;
        el!.style.opacity = '0';
        setTimeout(() => router.push(PESTANAS[destino]), 180);
      } else {
        el!.style.transform = 'translate3d(0,0,0)';
        el!.style.opacity = '1';
      }
    }

    el.addEventListener('touchstart', alEmpezar, { passive: true });
    el.addEventListener('touchmove', alMover, { passive: false });
    el.addEventListener('touchend', alSoltar, { passive: true });
    el.addEventListener('touchcancel', alSoltar, { passive: true });
    return () => {
      el.removeEventListener('touchstart', alEmpezar);
      el.removeEventListener('touchmove', alMover);
      el.removeEventListener('touchend', alSoltar);
      el.removeEventListener('touchcancel', alSoltar);
    };
  }, [indice, router]);

  // al montar una pestaña nueva, se limpia cualquier resto del gesto anterior
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = 'none';
    el.style.transform = 'translate3d(0,0,0)';
    el.style.opacity = '1';
    setSaliendo(null);
  }, [ruta]);

  // Renderiza la propia .pantalla para que las pantallas solo tengan que
  // cambiar su contenedor por este componente.
  return (
    <div ref={ref} className={`deslizable ${saliendo ? 'saliendo' : ''}`}>
      <div className="pantalla" onClick={onClick}>
        {children}
      </div>
    </div>
  );
}
