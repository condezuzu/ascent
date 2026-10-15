import PerfilPropio from '../src/PerfilPropio';
import DesenfoqueDeVuelta from '../src/DesenfoqueDeVuelta';

/**
 * `/yo` — tu perfil, apilado encima de las pestañas.
 *
 * La pantalla vive en `src/` como todas las demás; acá solo está la ruta. Es
 * el archivo el que la hace existir para el router: mover este archivo es
 * cambiar la dirección, y eso tiene que poder hacerse sin tocar la pantalla.
 */
export default function Pantalla() {
  return (
    <DesenfoqueDeVuelta>
      <PerfilPropio />
    </DesenfoqueDeVuelta>
  );
}
