import { useState } from 'react';
import Bienvenida from './Bienvenida';
import Login from './Login';

/**
 * LA ENTRADA: primero las diapositivas de bienvenida, después el login.
 *
 * Se muestran CADA vez que se llega al login, no solo la primera —requisito del
 * humano—: no se guarda ningún "ya las viste". Como `_layout` monta esto cuando
 * `sesion === 'sin'` y eso pasa de nuevo en cada logout, este componente se
 * vuelve a montar y las diapositivas se repiten solas, sin estado persistido.
 *
 * Lo que se eligió al final (crear vs entrar) abre el formulario en ese modo.
 */
export default function EntradaYLogin({ alEntrar }: { alEntrar: () => void }) {
  const [verSlides, setVerSlides] = useState(true);
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar');

  if (verSlides) {
    return (
      <Bienvenida
        alSalir={(destino) => {
          setModo(destino);
          setVerSlides(false);
        }}
      />
    );
  }
  return <Login alEntrar={alEntrar} modoInicial={modo} />;
}
