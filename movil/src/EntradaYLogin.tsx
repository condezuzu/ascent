import { useEffect, useState } from 'react';
import { anotarEntradaVista, vioLaEntrada } from '@compartido/entradaVista';
import Bienvenida from './Bienvenida';
import Login from './Login';

/**
 * LA ENTRADA: primero la bienvenida, después el login.
 *
 * DESDE EL 15/10 SOLO LA PRIMERA VEZ en este aparato, igual que la web: se anota al
 * terminarla, y también cuando hay una sesión (`app/_layout.tsx`), así que las
 * cuentas que ya existían no la ven al salir. Hasta el 15/10 se mostraba en cada
 * login.
 *
 * Lo que se eligió al final (crear vs entrar) abre el formulario en ese modo.
 */
export default function EntradaYLogin({ alEntrar }: { alEntrar: () => void }) {
  // `null` mientras se averigua: con `true` de entrada, quien ya la vio la vería parpadear.
  const [verSlides, setVerSlides] = useState<boolean | null>(null);
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar');

  useEffect(() => {
    let vivo = true;
    void vioLaEntrada().then((vista) => vivo && setVerSlides(!vista));
    return () => {
      vivo = false;
    };
  }, []);

  if (verSlides === null) return null;
  if (verSlides) {
    return (
      <Bienvenida
        alSalir={(destino) => {
          // Se anota al SALIR: si cierra la app a la mitad, la próxima vez la ve entera.
          void anotarEntradaVista();
          setModo(destino);
          setVerSlides(false);
        }}
      />
    );
  }
  return <Login alEntrar={alEntrar} modoInicial={modo} />;
}
