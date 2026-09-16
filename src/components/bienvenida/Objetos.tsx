'use client';

import { paletaDe } from '@/lib/paletas';
import { RANGOS_DE_LA_ENTRADA } from '@/lib/bienvenida';

/**
 * EL FONDO DE LA TERCERA: los objetos de otras rachas, flotando lejos. La
 * pantalla habla de otra gente entrenando, y esto lo dice sin decirlo — cada
 * objeto es alguien en su punto del camino.
 *
 * CADA UNO CON SU FORMA (15/9). Antes eran ocho círculos con distinto color y
 * se parecían todos: si el objeto es lo que se gana, ocho bolas iguales dicen
 * que no se gana nada. Ahora Saturno tiene anillo, la luna cráteres, el sol
 * corona, el asteroide silueta irregular, la galaxia es una elipse borrosa y
 * el agujero negro un aro naranja sobre negro.
 *
 * SIN MOTOR, a propósito: son degradados de CSS. A este tamaño y con esta
 * opacidad, partículas de verdad no se distinguirían, y el motor está ocupado
 * bajándose para la cuarta pantalla.
 *
 * NUNCA SE NOMBRAN (§7): descubrir en qué te convertís es del juego.
 */

// Dónde flota cada uno. Repartidos a mano: al azar quedaban tres pegados y
// media pantalla vacía.
const LUGARES = [
  { x: 10, y: 20, tam: 30, s: 13 },
  { x: 72, y: 12, tam: 26, s: 17 },
  { x: 30, y: 44, tam: 34, s: 11 },
  { x: 82, y: 46, tam: 52, s: 19 }, // Saturno: el más grande, se tiene que leer
  { x: 6, y: 64, tam: 30, s: 15 },
  { x: 56, y: 70, tam: 44, s: 21 },
  { x: 22, y: 86, tam: 56, s: 12 },
  { x: 76, y: 90, tam: 38, s: 16 },
];

const TIPOS: Record<number, string> = {
  1: 'polvo',
  2: 'roca',
  3: 'luna',
  4: 'saturno',
  5: 'sol',
  6: 'sistema',
  7: 'galaxia',
  8: 'agujero',
};

export default function Objetos({ quieto = false }: { quieto?: boolean }) {
  return (
    <div className="bienv-objetos" aria-hidden>
      {RANGOS_DE_LA_ENTRADA.map((r, i) => {
        const l = LUGARES[i];
        const p = paletaDe(r);
        return (
          <span
            key={r}
            className={`obj obj-${TIPOS[r]} ${quieto ? '' : 'flota'}`}
            style={
              {
                left: `${l.x}%`,
                top: `${l.y}%`,
                width: l.tam,
                height: l.tam,
                animationDuration: `${l.s}s`,
                animationDelay: `${-i * 1.7}s`,
                '--claro': p.claro,
                '--principal': p.principal,
                '--apagado': p.apagado,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
