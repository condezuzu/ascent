import { paletaDe } from '@nucleo/paletas';
import { fijarPaleta } from './colores';
import { escucharFondo } from './pedidoDeFondo';

/**
 * LA PALETA ES LA DEL FONDO QUE SE VE (30/10), como `aplicarTema` en `FondoEspacial` de la web. Sin
 * pedidos queda la última: entre soltar una pestaña y pedir la otra no hay nadie arriba.
 */
export function seguirElFondo() {
  return escucharFondo((p) => {
    if (p) fijarPaleta(paletaDe(p.rango, p.planeta), p.rango);
  });
}
