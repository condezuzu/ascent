'use client';

import { paletaDe } from '@/lib/paletas';
import { RANGOS_DE_LA_ENTRADA } from '@/lib/bienvenida';

/**
 * EL FONDO DE LA TERCERA: los objetos de los rangos, flotando lejos, cada uno
 * con su paleta. La pantalla habla de otra gente entrenando, y esto lo dice
 * sin decirlo — son las rachas de otros, cada una en su punto del camino.
 *
 * SIN MOTOR: son círculos con degradado. A este tamaño y con esta opacidad,
 * una nube de partículas no se distinguiría de un punto de color, y costaría
 * la biblioteca entera justo mientras se está descargando para la cuarta.
 *
 * NUNCA SE NOMBRAN. Son objetos flotando: descubrir en qué te convertís es del
 * juego, no de la entrada (§7).
 */

// Dónde flota cada uno y cuánto tarda en respirar. Repartidos a mano: al azar
// quedaban tres pegados y media pantalla vacía.
const LUGARES = [
  { x: 12, y: 22, tam: 26, s: 13 },
  { x: 74, y: 14, tam: 34, s: 17 },
  { x: 32, y: 48, tam: 20, s: 11 },
  { x: 84, y: 52, tam: 44, s: 19 },
  { x: 8, y: 68, tam: 30, s: 15 },
  { x: 58, y: 74, tam: 52, s: 21 },
  { x: 26, y: 88, tam: 24, s: 12 },
  { x: 78, y: 92, tam: 38, s: 16 },
];

export default function Objetos({ quieto = false }: { quieto?: boolean }) {
  return (
    <div className="bienv-objetos" aria-hidden>
      {RANGOS_DE_LA_ENTRADA.map((r, i) => {
        const l = LUGARES[i];
        const p = paletaDe(r);
        return (
          <span
            key={r}
            className={quieto ? '' : 'flota'}
            style={{
              left: `${l.x}%`,
              top: `${l.y}%`,
              width: l.tam,
              height: l.tam,
              background: `radial-gradient(circle at 36% 32%, ${p.claro}, ${p.principal} 52%, ${p.apagado} 78%, transparent 80%)`,
              animationDuration: `${l.s}s`,
              animationDelay: `${-i * 1.7}s`,
            }}
          />
        );
      })}
    </div>
  );
}
