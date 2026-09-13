'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * MONTA LO QUE TIENE ADENTRO AL FINAL DEL BODY, no donde se escribió.
 *
 * TODAS LAS HOJAS VAN ACÁ, y es la tercera vez que esto aparece. Una hoja
 * abierta desde el medio de una pantalla queda atrapada en el contexto de
 * apilado de esa pantalla —`.pantalla` tiene `z-index: 1`— y termina POR
 * DEBAJO de la barra de navegación, que vive afuera, con su botón de cerrar
 * tapado. Pasó con el selector de ejercicios, se arregló ahí solo, y volvió a
 * pasar con la hoja del día y con la lista de bloques, que es justo la que abre
 * "Terminar serie". Las demás no lo tenían por casualidad: se montaban sueltas
 * al final de la página.
 *
 * Arreglarlo hoja por hoja es garantizar la cuarta. Por eso es un componente, y
 * por eso hay un test que falla si alguna hoja no lo usa.
 */
export default function EnElBody({ children }: { children: ReactNode }) {
  const [montado, setMontado] = useState(false);
  // En el servidor no hay `document`; se espera al primer cuadro del cliente.
  useEffect(() => setMontado(true), []);
  if (!montado) return null;
  return createPortal(children, document.body);
}
