'use client';

/**
 * LOS IMPULSOS QUE QUEDAN, en puntos.
 *
 * DISCRETO A PROPÓSITO. Un contador grande convertiría los impulsos en un
 * recurso que se administra —"me quedan dos, puedo faltar dos"—, que es
 * exactamente lo contrario de para qué están. Tres puntos en voz baja dicen
 * lo único que hace falta saber antes de gastarlas: si hay o no hay.
 *
 * PERO TIENEN QUE VERSE ANTES, y por eso existe esto: enterarse recién cuando
 * ya se usó una no sirve para decidir nada.
 */
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
          <i key={i} className={`${viva ? 'viva' : ''} ${apagandose ? 'apagandose' : ''}`} />
        );
      })}
    </span>
  );
}
