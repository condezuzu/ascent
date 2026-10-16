import { useEffect, useState } from 'react';

/**
 * QUÉ PEDIDO ESTÁ MOSTRANDO EL CARTEL DE ARRIBA (15/10). Inicio lo mira para no
 * dibujar la tarjeta del mismo pedido debajo: si el cartel está arriba, la
 * tarjeta no va.
 */
export type EnCartel = { tipo: 'amistad' | 'union'; id: string } | null;

let actual: EnCartel = null;
const oyentes = new Set<() => void>();

export function fijarCartel(c: EnCartel): void {
  actual = c;
  oyentes.forEach((f) => f());
}

export function useCartelVisible(): EnCartel {
  const [c, setC] = useState<EnCartel>(actual);
  useEffect(() => {
    const f = () => setC(actual);
    oyentes.add(f);
    f();
    return () => {
      oyentes.delete(f);
    };
  }, []);
  return c;
}
