import { useContext, useEffect, useId } from 'react';
import { ContextoVisible, pedirFondo, soltarFondo, type Pedido } from './pedidoDeFondo';

/**
 * EL FONDO, VISTO DESDE UNA PANTALLA: no dibuja nada, lo pide.
 *
 * La misma firma que el `FondoEspacial` de la web, para que Inicio lo use
 * igual. Pero acá el motor vive en la raíz (`FondoRaiz`), con un contexto de
 * GL que dura toda la sesión: si viviera adentro de Inicio, cada vuelta a la
 * pestaña recompilaría todos los shaders. Ver `pedidoDeFondo.ts`.
 *
 * PIDE SOLO MIENTRAS SE VE. Desde que las pestañas quedan todas montadas
 * (23/9, el arreglo del titileo), las cinco estaban pidiendo fondo a la vez y
 * ganaba la última que hubiera corrido su efecto: volvías a Inicio y te
 * quedaba el `soloEstrellas` de Ranking, o sea el espacio sin el cuerpo.
 * `ContextoVisible` lo dice y acá se suelta mientras no toque.
 */
export default function FondoEspacial(op: Pedido) {
  // UNA IDENTIDAD POR PANTALLA, para la pila de `pedidoDeFondo`. `useId` da una
  // por instancia y estable entre dibujados, que es exactamente lo que hace
  // falta: dos pantallas distintas no se pisan y la misma se actualiza en su
  // lugar en vez de saltar a la cima.
  const id = useId();
  const visible = useContext(ContextoVisible);

  // De qué depende que haya que pedir otra cosa. Las mismas dependencias que
  // el efecto de la web: si cambia cualquiera, el objeto es otro.
  const clave = JSON.stringify([
    op.rango,
    op.planeta ?? null,
    !!op.apagado,
    !!op.vacio,
    !!op.soloEstrellas,
    !!op.reposo,
    !!op.presagio,
    op.fantasma?.rango ?? null,
    op.fantasma?.planeta ?? null,
    op.esquina ?? null,
    op.animar !== false,
    !!op.atmosfera,
    op.velo ?? null,
  ]);

  useEffect(() => {
    if (!visible) {
      // Escondida: se suelta y se deja que gane la de abajo. Al volver a la
      // vista, este mismo efecto la vuelve a pedir.
      soltarFondo(id);
      return;
    }
    pedirFondo(id, op);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, visible, id]);

  // Al salir, la pantalla deja de pedir y la raíz destapa lo que haya debajo.
  useEffect(() => () => soltarFondo(id), [id]);

  return null;
}
