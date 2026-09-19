'use client';

import { useEffect, useRef } from 'react';

/**
 * LA ACCIÓN DE LA PANTALLA, SIEMPRE EN EL MISMO LUGAR.
 *
 * El botón principal de Inicio flotaba en medio del contenido, así que su
 * posición dependía de cuánto hubiera arriba: con una sesión corriendo caía en
 * un lado, sin sesión en otro, y con el aviso de la pérdida en un tercero. El
 * pulgar tenía que buscarlo cada vez.
 *
 * Anclado abajo, el pulgar ya sabe dónde está antes de mirar. Es lo que hacen
 * Hevy y Strong, y en un gimnasio —una mano ocupada, la otra transpirada—
 * importa más que en cualquier otra app.
 *
 * UNA SOLA PRINCIPAL, y por eso `children` es una y no una lista: si hubiera
 * dos, ninguna sería la principal.
 *
 * Lo secundario puede venir con ella, en `secundaria`, y va debajo como texto
 * subrayado (§19.1). Al principio lo dejé suelto en el flujo del contenido y
 * quedó mal: sacar el botón principal del flujo dejó a "Anotar peso" flotando
 * arriba de la tira semanal, en un lugar que no significaba nada. Las dos
 * acciones de una pantalla se leen juntas o no se leen.
 *
 * CUANDO NO HAY ACCIÓN, NO HAY BARRA. No se deja un hueco reservado: una
 * franja vacía esperando un botón se lee como algo que se rompió.
 */
export default function AccionPrincipal({
  children,
  secundaria,
}: {
  children: React.ReactNode;
  secundaria?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // El padding de abajo del contenido lo pone una clase en el body, igual que
  // hace la franja de la sesión: `.pantalla` está anidada dentro de
  // `.deslizable`, así que no es hermana de esta barra y no hay ningún
  // selector de CSS que las relacione.
  //
  // Y EL ALTO LO MIDE ELLA MISMA (19/9). Era un número escrito a mano
  // (`--alto-accion: 90px`) y se desincronizó dos veces: "Registrar día" con
  // "Anotar peso" abajo mide más que 90, y el último renglón de Inicio quedaba
  // tapado detrás del botón en el SE y en Safari. Ahora publica lo que mide,
  // solo cuando cambia (no en cada render), y el 90 queda de valor inicial.
  useEffect(() => {
    document.body.classList.add('con-accion');
    const el = ref.current;
    const publicar = () => {
      if (el) document.body.style.setProperty('--alto-accion', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    };
    publicar();
    const mirar = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publicar);
    if (el) mirar?.observe(el);
    return () => {
      mirar?.disconnect();
      document.body.classList.remove('con-accion');
      document.body.style.removeProperty('--alto-accion');
    };
  }, []);

  return (
    <div ref={ref} className="accion-anclada">
      {children}
      {secundaria}
    </div>
  );
}
