import MisMarcas from '../src/MisMarcas';
import DesenfoqueDeVuelta from '../src/DesenfoqueDeVuelta';

/**
 * `/marcas` — mis marcas de fuerza, apilada encima de las pestañas.
 *
 * Apilada y no una sexta pestaña: se entra desde Stats, se mira, se vuelve.
 * Poner esto en la barra sería darle el lugar más tocado de la app a algo que
 * se usa una vez por mes.
 */
export default function Pantalla() {
  return (
    <DesenfoqueDeVuelta>
      <MisMarcas />
    </DesenfoqueDeVuelta>
  );
}
