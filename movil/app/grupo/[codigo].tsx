import GrupoPorEnlace from '../../src/GrupoPorEnlace';
import DesenfoqueDeVuelta from '../../src/DesenfoqueDeVuelta';

/**
 * `ascent://grupo/<código>` y `https://…/grupo/<código>`: a dónde abre la app el
 * link para entrar a un grupo (migración 88). El router saca el código del nombre.
 */
export default function Pantalla() {
  return (
    <DesenfoqueDeVuelta>
      <GrupoPorEnlace />
    </DesenfoqueDeVuelta>
  );
}
