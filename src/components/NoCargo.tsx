'use client';

import { T } from '@nucleo/textos';

/**
 * "No se pudieron traer tus datos" y un botón para reintentar.
 *
 * Todas las pantallas que piden datos antes de dibujar tenían el mismo agujero:
 * si la consulta fallaba, se quedaban en el armazón para siempre, sin error y
 * sin nada que tocar. Con una conexión mala —el subsuelo de un gimnasio— eso es
 * quedarse afuera de la app sin forma de salir, y encima hoy no hay
 * recuperación de contraseña por si a alguien se le ocurre reinstalar.
 *
 * Va como componente y no copiado en cada pantalla por la misma razón que
 * `avisarFallo`: si conectarlo cuesta trabajo, la próxima pantalla que se
 * escriba va a volver a quedarse muda.
 */
export default function NoCargo({ reintentar }: { reintentar: () => void }) {
  return (
    <div className="no-cargo">
      <p>{T.inicio.noCargo}</p>
      <button className="boton-fantasma" onClick={reintentar}>
        {T.inicio.reintentar}
      </button>
    </div>
  );
}
