import AmigoPorEnlace from '../../src/AmigoPorEnlace';
import DesenfoqueDeVuelta from '../../src/DesenfoqueDeVuelta';

/**
 * `ascent://amigo/<nombre>`: a dónde abre la app el link de invitación. El
 * router saca el nombre del archivo, igual que en `perfil/[id]`.
 */
export default function Pantalla() {
  return (
    <DesenfoqueDeVuelta>
      <AmigoPorEnlace />
    </DesenfoqueDeVuelta>
  );
}
