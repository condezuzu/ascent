'use client';

import { useEffect } from 'react';
import { eventos } from '@/plataforma/eventos';
import { PULSO } from '@/lib/pulso';
import { plataforma } from '@/plataforma';

/**
 * EL DÍA SE VUELVE MATERIA.
 *
 * Registrar el día es uno de los tres momentos de la app y hasta ahora no
 * pasaba nada: quedaba "día registrado" y se acabó.
 *
 * EL CONCEPTO. Un solo punto de luz sube desde abajo, en un arco, hacia el
 * cuerpo celeste de la esquina, y se absorbe. El objeto da un pulso corto y
 * denso. Después el número cuenta y el punto de hoy se llena en la tira.
 *
 * POR QUÉ UN PUNTO Y NO CONFETI. La tesis entera de la app es que cada día es
 * un poco de masa que se acumula. El confeti dice "ganaste"; un punto dice
 * "esto se sumó". Y escala: el día 3 y el día 47 se ven igual, que es
 * justamente lo que hay que decir.
 *
 * POR QUÉ NO CAMBIA CON EL RANGO. La subida de rango ya es dueña de "el objeto
 * se transforma"; si el gesto diario también cambiara por rango, los dos
 * momentos competirían y el raro perdería. Y de fondo: el acto diario tiene
 * que sentirse IGUAL todos los días — eso es una racha. Lo que cambia es el
 * marco (la paleta ya cambia sola, y en los últimos días está el presagio), no
 * el gesto.
 *
 * NO BLOQUEA NADA. No hay overlay ni captura de toques: la pantalla queda
 * usable mientras esto pasa. Con "reducir movimiento" no se dibuja el viaje y
 * el pulso no se pide — el número y el punto de la tira ya cuentan la historia
 * solos.
 */

// El viaje, el impacto, y lo que tarda en desaparecer del DOM.
const VIAJE_MS = 400;
const HASTA_EL_IMPACTO_MS = 380;
const VIDA_MS = 1200;

export default function DiaSumado({ alTerminar }: { alTerminar: () => void }) {
  useEffect(() => {
    const quieto =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Un golpe corto al confirmarse, no al tocar: el toque confirma que
    // pediste algo, esto confirma que ya está hecho.
    plataforma.haptica.pulso();

    if (quieto) {
      alTerminar();
      return;
    }

    // El impacto se pide cuando el punto LLEGA, no cuando sale. Si el pulso
    // saliera al principio, la luz del objeto subiría antes de que nada lo
    // toque y el gesto se leería al revés.
    const aImpactar = setTimeout(() => eventos.emitir(PULSO), HASTA_EL_IMPACTO_MS);
    const aTerminar = setTimeout(alTerminar, VIDA_MS);
    return () => {
      clearTimeout(aImpactar);
      clearTimeout(aTerminar);
    };
  }, [alTerminar]);

  return (
    <span
      className="dia-chispa"
      style={{ animationDuration: `${VIAJE_MS}ms` }}
      aria-hidden
    />
  );
}
