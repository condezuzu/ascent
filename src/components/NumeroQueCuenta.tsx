'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Un número que VIAJA hasta su valor nuevo en vez de reemplazarse.
 *
 * La racha pasaba de 46 a 47 con un corte: en un cuadro decía una cosa y en
 * el siguiente otra. Es la diferencia más barata que hay entre una app que
 * parece hecha por una persona y una que parece un formulario — el estado
 * nuevo tiene que salir del viejo, nunca aparecer en su lugar.
 *
 * DOS REGLAS QUE NO SE ROMPEN:
 *
 * 1. **La primera vez no se anima.** Si al abrir la app la racha contara de 0
 *    a 47, estaría contando una historia falsa: no subiste 47 hoy. Solo se
 *    anima cuando el número cambia estando la pantalla a la vista.
 * 2. **Cifra tabular.** Sin `tabular-nums` cada dígito tiene su ancho y el
 *    número se sacude mientras cuenta, que se ve peor que no animarlo. La
 *    clase que lo use tiene que traerla; `.racha-numero` ya la tiene y
 *    `.numero-cuenta` la pone para el resto.
 *
 * Con "reducir movimiento" salta directo: contar es movimiento.
 */
export default function NumeroQueCuenta({
  valor,
  ms = 700,
  className,
}: {
  valor: number;
  ms?: number;
  className?: string;
}) {
  const [mostrado, setMostrado] = useState(valor);
  const anterior = useRef(valor);

  useEffect(() => {
    const desde = anterior.current;
    anterior.current = valor;
    if (desde === valor) return;

    const quieto =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Un salto grande no se cuenta: de 3 a 47 serían cuarenta y cuatro
    // números ilegibles pasando. Eso es carga de datos, no un cambio.
    if (quieto || Math.abs(valor - desde) > 12) {
      setMostrado(valor);
      return;
    }

    let vivo = true;
    const t0 = performance.now();
    const paso = (ahora: number) => {
      if (!vivo) return;
      const t = Math.min(1, (ahora - t0) / ms);
      // misma curva que --curva-salida: llega rápido y se asienta
      const suave = 1 - Math.pow(1 - t, 3);
      setMostrado(Math.round(desde + (valor - desde) * suave));
      if (t < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
    return () => {
      vivo = false;
    };
  }, [valor, ms]);

  return <span className={className}>{mostrado}</span>;
}
