import { useEffect, useState, type ReactNode } from 'react';

/**
 * LO QUE CAMBIA CADA SEGUNDO, Y NADA MÁS (15/10). El reloj de la sesión y la
 * cuenta del descanso se redibujaban redibujando Inicio ENTERO una vez por
 * segundo (y también el vigilante, que no muestra nada). Medido con la CPU
 * frenada como un teléfono, era el trabajo de fondo de toda la sesión. Ahora
 * solo se redibuja esto: el tiempo sale de restar contra el inicio, igual que antes.
 */
export default function CadaSegundo({ children }: { children: () => ReactNode }) {
  const [, tic] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tic((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <>{children()}</>;
}
