import { createElement, useState, type ComponentType } from 'react';

/**
 * UNA HOJA NUEVA EN CADA APERTURA (4/10).
 *
 * Las hojas quedan siempre montadas —así cierran con su animación— y se abren
 * con una prop. Su estado nacía UNA vez, al montarse la pantalla, antes de saber
 * con qué se iban a abrir. Ya van dos bugs con esa forma: la marca que se
 * guardaba en otro ejercicio, y la foto que salía compartida porque "quién la
 * ve" quedaba en lo último que se había tocado y no en lo de Ajustes.
 *
 * Esto envuelve a la hoja y le cambia la `key` cada vez que pasa de cerrada a
 * abierta: React la monta de nuevo y todo su estado arranca de las props de ESE
 * momento. Al cerrar la `key` no cambia, así que se va siendo la misma, con lo
 * que tenía y con su animación.
 *
 * Toda hoja con estado propio sale por acá (lo mira la sección 182 de
 * `test:db`): no hay que acordarse en cada pantalla que la usa.
 *
 * Sin JSX a propósito: así `test:db` lo puede correr.
 */
export function nuevaEnCadaApertura<P extends object>(Hoja: ComponentType<P>, abierta: (props: P) => boolean) {
  return function HojaNueva(props: P) {
    const ahora = abierta(props);
    const [antes, setAntes] = useState(ahora);
    const [apertura, setApertura] = useState(0);
    // Recordar algo del render anterior se hace así, durante el render: React
    // descarta este resultado y vuelve a dibujar con la llave nueva.
    if (ahora !== antes) {
      setAntes(ahora);
      if (ahora) setApertura((n) => n + 1);
    }
    return createElement(Hoja, { ...props, key: apertura });
  };
}
