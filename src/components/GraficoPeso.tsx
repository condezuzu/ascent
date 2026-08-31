'use client';

import { deKilos, type Unidad } from '@nucleo/peso';
import { T } from '@nucleo/textos';

export type PesoAnotado = { fecha: string; valor: number };

/**
 * LA TENDENCIA DEL PESO.
 *
 * QUÉ ESTABA MAL. Era un `<svg>` suelto con una línea de 1,6 px y, debajo,
 * tres números en fila: mínimo, hoy, máximo. Dos problemas, y el segundo es
 * grave.
 *
 * 1. La línea sola no se puede leer. Sin ningún punto marcado no se sabe
 *    dónde está el dato de hoy ni cuánto abarca lo que se ve.
 * 2. **El mínimo y el máximo NO eran datos: eran los bordes del dibujo**,
 *    calculados como `min - 0.5` y `max + 0.5` para que la línea no tocara el
 *    techo. O sea que la pantalla mostraba con toda seriedad dos pesos con un
 *    decimal que esta persona nunca pesó. Un número inventado que parece un
 *    dato es peor que no mostrar nada, porque se cree.
 *
 * AHORA: la línea, un punto en el último dato, y abajo lo único que se puede
 * afirmar — cuánto pesás hoy y cuánto cambió en lo que se ve. Es el acabado de
 * los gráficos de Hevy: sin ejes, sin grilla, sin marcos; la línea, el último
 * punto y el rango en chico.
 *
 * SE MUESTRA SUAVIZADO, NUNCA EL DATO CRUDO. El peso oscila casi un kilo por
 * razones que no tienen nada que ver con entrenar —sal, agua, la hora—, y una
 * línea con esos dientes se lee como progreso o como fracaso según el día que
 * te toque mirar. La media móvil de siete días es lo que se puede afirmar.
 */

const ANCHO = 300;
const ALTO = 84;
const VENTANA = 7; // días de la media móvil

export default function GraficoPeso({
  pesos,
  unidad,
}: {
  pesos: PesoAnotado[];
  unidad: Unidad;
}) {
  const suavizado = pesos.map((_, i) => {
    const ventana = pesos.slice(Math.max(0, i - (VENTANA - 1)), i + 1);
    return deKilos(ventana.reduce((s, w) => s + w.valor, 0) / ventana.length, unidad);
  });
  if (suavizado.length < 2) return null;

  // El alto del dibujo se reparte con un margen arriba y abajo para que la
  // línea no toque los bordes. ESTOS números son de dibujo y por eso no se
  // muestran en ningún lado — que era exactamente el error de la versión
  // anterior.
  const piso = Math.min(...suavizado);
  const techo = Math.max(...suavizado);
  const luz = Math.max(0.4, (techo - piso) * 0.25); // aire, y algo si es plano
  const min = piso - luz;
  const max = techo + luz;

  const punto = (v: number, i: number) => ({
    x: (i / (suavizado.length - 1)) * ANCHO,
    y: ALTO - ((v - min) / (max - min)) * ALTO,
  });
  const puntos = suavizado.map(punto);
  const linea = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  // El relleno le da cuerpo a la línea sin agregar ni una marca más. Cierra
  // por abajo del área visible para que el degradado se apague solo.
  const area = `${linea} L${ANCHO},${ALTO} L0,${ALTO} Z`;
  const ultimo = puntos[puntos.length - 1];

  const hoy = suavizado[suavizado.length - 1];
  const cambio = hoy - suavizado[0];
  const dias = pesos.length;

  return (
    <div className="grafico-peso">
      {/* El svg y el punto van juntos adentro de su propio rectángulo: si el
          punto se posicionara contra el bloque entero, el `top` en porcentaje
          contaría también el padding de arriba y el pie de abajo, y quedaría
          desplazado hacia abajo del lugar donde está la línea. */}
      <div className="grafico-peso-lienzo">
        <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="peso-relleno" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--pal-claro)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--pal-claro)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#peso-relleno)" />
          {/* `non-scaling-stroke` porque el viewBox se estira sin conservar la
              proporción: sin esto la línea saldría más gruesa en horizontal que
              en vertical, que es el detalle que hace que un gráfico se vea
              hecho a las apuradas. */}
          <path
            d={linea}
            fill="none"
            stroke="var(--pal-claro)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* El punto de hoy va en HTML y no en el SVG: adentro del viewBox
            estirado saldría ovalado. */}
        <span
          className="grafico-peso-punto"
          style={{ left: `${(ultimo.x / ANCHO) * 100}%`, top: `${(ultimo.y / ALTO) * 100}%` }}
        />
      </div>

      <div className="grafico-peso-pie">
        <span className="hoy">
          {hoy.toFixed(1)}
          <em>{unidad}</em>
        </span>
        {/* Lo único que se puede afirmar además del peso de hoy: cuánto se
            movió en lo que se está viendo. Con signo, siempre: sin él, "0.4"
            no dice si subiste o bajaste. */}
        <span className="cambio">
          {T.stats.pesoCambio(
            dias,
            `${cambio >= 0 ? '+' : '−'}${Math.abs(cambio).toFixed(1)}`,
            unidad
          )}
        </span>
      </div>
    </div>
  );
}
