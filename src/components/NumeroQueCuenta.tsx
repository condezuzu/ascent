'use client';

import { useEffect, useRef, useState } from 'react';
import { hayQueContar, valorContado } from '@/lib/contar';

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
  // Lo que está EN PANTALLA, que no siempre es el valor anterior: si el número
  // cambia de nuevo a mitad de una cuenta —47 y enseguida 48—, la cuenta nueva
  // tiene que salir de donde quedó la vieja. Antes salía del 47 aunque en
  // pantalla todavía dijera 46, y el número daba un salto.
  const enPantalla = useRef(valor);
  enPantalla.current = mostrado;

  useEffect(() => {
    const desde = enPantalla.current;

    const quieto =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Cuándo se cuenta y qué número va en cada instante vive en `lib/contar.ts`,
    // probado con números. Acá queda solo el reloj.
    if (!hayQueContar(desde, valor, quieto)) {
      setMostrado(valor);
      return;
    }

    let vivo = true;
    const t0 = performance.now();
    const paso = (ahora: number) => {
      if (!vivo) return;
      const t = (ahora - t0) / ms;
      setMostrado(valorContado(desde, valor, t));
      if (t < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
    return () => {
      vivo = false;
    };
  }, [valor, ms]);

  return <span className={className}>{mostrado}</span>;
}
