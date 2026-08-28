'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { anotar } from '@/lib/bitacora';

/**
 * Cuánto tarda en aparecer cada pantalla, medido EN EL TELÉFONO.
 *
 * POR QUÉ ASÍ Y NO CON UNA HERRAMIENTA. Desde la máquina de desarrollo se
 * puede frenar la CPU y aproximar un teléfono, pero esa medición ya me mintió
 * dos veces en una noche: una vez reportó veinte segundos donde el toque
 * llegaba a la pantalla en treinta y seis milisegundos —era Playwright
 * esperando, no la app— y otra dio veintiocho segundos con siete de red y cero
 * tareas largas, que es una combinación imposible.
 *
 * Un navegador sin ventana, con la CPU frenada artificialmente, no es un
 * teléfono. El teléfono sí lo es. Así que la medición vive adentro de la app y
 * la hace el aparato de verdad, andando por la calle.
 *
 * QUÉ MIDE: desde que cambia la ruta hasta que el navegador terminó de pintar
 * la pantalla nueva. Dos `requestAnimationFrame` seguidos: el primero se
 * agenda antes del pintado, el segundo corre después. Es lo más cerca que se
 * puede estar de "ya lo veo" sin adivinar qué elemento mirar en cada pantalla.
 *
 * No dibuja nada y no cuesta nada: dos cuadros y una línea en la bitácora.
 */
export default function MedirPantallas() {
  const ruta = usePathname();
  const anterior = useRef<string | null>(null);

  useEffect(() => {
    if (anterior.current === null) {
      // La primera vez no es un cambio de pantalla, es abrir la app. Se mide
      // aparte porque incluye descargar y arrancar todo.
      anterior.current = ruta;
      if (typeof performance !== 'undefined') {
        const nav = performance.getEntriesByType('navigation')[0] as
          | PerformanceNavigationTiming
          | undefined;
        if (nav) {
          anotar('abrir la app', {
            hastaInteractiva: Math.round(nav.domInteractive),
            hastaCargada: Math.round(nav.loadEventEnd || nav.domComplete),
            ruta,
          });
        }
      }
      return;
    }
    if (anterior.current === ruta) return;

    const desde = anterior.current;
    anterior.current = ruta;
    const t = performance.now();

    let vivo = true;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!vivo) return;
        anotar('cambio de pantalla', {
          de: desde,
          a: ruta,
          ms: Math.round(performance.now() - t),
        });
      })
    );
    return () => {
      vivo = false;
    };
  }, [ruta]);

  return null;
}
