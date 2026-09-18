import { useEffect } from 'react';
import { pedirFondo, soltarFondo, type Pedido } from './pedidoDeFondo';

/**
 * EL FONDO, VISTO DESDE UNA PANTALLA: no dibuja nada, lo pide.
 *
 * La misma firma que el `FondoEspacial` de la web, para que Inicio lo use
 * igual. Pero acá el motor vive en la raíz (`FondoRaiz`), con un contexto de
 * GL que dura toda la sesión: si viviera adentro de Inicio, cada vuelta a la
 * pestaña recompilaría todos los shaders. Ver `pedidoDeFondo.ts`.
 */
export default function FondoEspacial(op: Pedido) {
  // De qué depende que haya que pedir otra cosa. Las mismas dependencias que
  // el efecto de la web: si cambia cualquiera, el objeto es otro.
  const clave = JSON.stringify([
    op.rango,
    op.planeta ?? null,
    !!op.apagado,
    !!op.vacio,
    !!op.reposo,
    !!op.presagio,
    op.fantasma?.rango ?? null,
    op.fantasma?.planeta ?? null,
    op.esquina ?? null,
    op.animar !== false,
    !!op.atmosfera,
  ]);

  useEffect(() => {
    pedirFondo(op);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  // Al salir, la pantalla deja de pedir y la raíz guarda la escena en pausa.
  useEffect(() => () => soltarFondo(), []);

  return null;
}
