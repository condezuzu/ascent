'use client';

/**
 * LOS IMPULSOS QUE QUEDAN, en estrellas (26/10: eran puntos; la nativa ya usaba la estrella).
 *
 * DISCRETO A PROPÓSITO. Un contador grande convertiría los impulsos en un
 * recurso que se administra —"me quedan dos, puedo faltar dos"—, que es
 * exactamente lo contrario de para qué están. Tres puntos en voz baja dicen
 * lo único que hace falta saber antes de gastarlas: si hay o no hay.
 *
 * PERO TIENEN QUE VERSE ANTES, y por eso existe esto: enterarse recién cuando
 * ya se usó una no sirve para decidir nada.
 */
// La misma de movil/src/Estrella.tsx.
const PUNTAS = 'M0,-48 C3,-15 9,-6 27,0 C9,6 3,15 0,48 C-3,15 -9,6 -27,0 C-9,-6 -3,-15 0,-48 Z';

export default function Impulsos({
  quedan,
  total,
  /** El punto que acaba de apagarse, para animarlo al aparecer el aviso. */
  gastando = 0,
}: {
  quedan: number;
  total: number;
  gastando?: number;
}) {
  return (
    <span className="impulsos" role="img" aria-label={`${quedan} de ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        // Se dibujan de izquierda a derecha: primero las que quedan.
        const viva = i < quedan;
        // Las que se están gastando en este momento son las que vienen justo
        // después de las vivas: se apagan con una transición corta.
        const apagandose = !viva && i < quedan + gastando;
        return (
          <svg key={i} viewBox="-50 -50 100 100" className={`${viva ? 'viva' : ''} ${apagandose ? 'apagandose' : ''}`}>
            <path d={PUNTAS} />
          </svg>
        );
      })}
    </span>
  );
}
