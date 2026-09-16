'use client';

import { useEffect, useRef, useState } from 'react';
import { paletaDe } from '@/lib/paletas';

/**
 * EL FONDO DE LA SEGUNDA PANTALLA: una lista de ejercicios que sube, se
 * inclina, acelera hasta desenfocarse por la velocidad, y termina siendo
 * estrellas (idea del humano, 15/9).
 *
 * POR QUÉ FUNCIONA: dice lo que dice el texto —"se anota todo"— y además hace
 * el puente al lenguaje del resto de la entrada. Del registro al espacio sin
 * corte, que es exactamente lo que hace la app: anotás series y eso se
 * convierte en un objeto en el cielo.
 *
 * DOS CUIDADOS, y por eso está acotado:
 *  - NO COMPITE CON EL TEXTO. Pasa detrás, al 40% de opacidad, y se calma
 *    antes de que la persona termine de leer.
 *  - SE HACE UNA SOLA VEZ. Un bucle que se repite convierte el fondo en una
 *    máquina tragamonedas y la vista no puede dejar de mirarlo.
 *
 * El desenfoque es `filter: blur()` sobre UN elemento que ya se está moviendo
 * con `transform`: el navegador lo resuelve en la GPU. Desenfocar cada renglón
 * por separado sí costaría caro.
 */

// Nombres del catálogo de la app. Son de verdad: inventar ejercicios en la
// pantalla que promete que anota los tuyos sería empezar mintiendo.
const EJERCICIOS = [
  'Press de banca · 4 × 80 kg',
  'Sentadilla · 5 × 100 kg',
  'Dominadas · 3 × 8',
  'Peso muerto · 3 × 140 kg',
  'Remo con barra · 4 × 60 kg',
  'Press militar · 4 × 45 kg',
  'Curl con barra · 3 × 30 kg',
  'Zancadas · 3 × 20 kg',
  'Fondos · 3 × 10',
  'Elevaciones laterales · 4 × 10 kg',
  'Prensa · 4 × 180 kg',
  'Plancha · 3 × 60 s',
];

/** Lo que dura el viaje de la lista, en segundos. */
const VIAJE_S = 3.4;

export default function Registro({ quieto = false }: { quieto?: boolean }) {
  const [t, setT] = useState(quieto ? 1 : 0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (quieto) return;
    let vivo = true;
    let pedido = 0;
    const t0 = performance.now();
    const paso = (ahora: number) => {
      if (!vivo) return;
      const p = Math.min(1, (ahora - t0) / 1000 / VIAJE_S);
      setT(p);
      if (p < 1) pedido = requestAnimationFrame(paso);
    };
    pedido = requestAnimationFrame(paso);
    return () => {
      vivo = false;
      cancelAnimationFrame(pedido);
    };
  }, [quieto]);

  // El recorrido: arranca quieto, acelera —el desplazamiento crece con el
  // cuadrado del tiempo— y en el último tercio se desarma en puntos.
  const avance = t * t;
  const desenfoque = Math.min(6, Math.max(0, (t - 0.45) * 14));
  const inclina = 6 + t * 16;
  const desvanece = t < 0.62 ? 1 : Math.max(0, 1 - (t - 0.62) / 0.28);
  const estrellas = t < 0.55 ? 0 : Math.min(1, (t - 0.55) / 0.35);
  const pal = paletaDe(3);

  return (
    <div className="bienv-registro" aria-hidden>
      <div
        ref={ref}
        className="bienv-lista"
        style={{
          opacity: desvanece * 0.4,
          filter: `blur(${desenfoque}px)`,
          transform: `perspective(700px) rotateX(${inclina}deg) translate3d(0, ${-avance * 62}%, 0)`,
        }}
      >
        {[...EJERCICIOS, ...EJERCICIOS].map((e, i) => (
          <div key={`${e}-${i}`} className="bienv-renglon">
            {e}
          </div>
        ))}
      </div>

      {/* Lo que queda cuando la lista se deshace: los mismos renglones, ahora
          puntos. No aparecen de la nada — se encienden donde estaba el texto. */}
      <div className="bienv-polvo" style={{ opacity: estrellas }}>
        {Array.from({ length: 26 }).map((_, i) => (
          <span
            key={i}
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 61) % 100}%`,
              background: i % 4 === 0 ? pal.claro : '#cfd8f0',
              transform: `scale(${0.6 + ((i * 13) % 7) / 10})`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
