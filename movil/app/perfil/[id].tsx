import PerfilDeAmigo from '../../src/PerfilDeAmigo';

/**
 * `/perfil/[id]` — el perfil de otra persona.
 *
 * LOS CORCHETES SON LA DIRECCIÓN: el router saca el `id` del nombre del
 * archivo y se lo pasa a la pantalla. Es la misma forma que la ruta de la web
 * (`src/app/perfil/[id]`), a propósito: el día que un enlace lleve a un perfil,
 * la misma URL sirve en los dos lados.
 */
export default function Pantalla() {
  return <PerfilDeAmigo />;
}
