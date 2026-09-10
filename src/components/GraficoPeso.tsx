'use client';

import { useRef, useState } from 'react';
import { deKilos, suavizarPorFecha, ultimosDias, type Unidad } from '@nucleo/peso';
import { fechaLinda } from '@nucleo/fechas';
import { T } from '@nucleo/textos';

export type PesoAnotado = { fecha: string; valor: number };

/**
 * LA TENDENCIA DEL PESO.
 *
 * QUÉ ESTABA MAL AL PRINCIPIO. Era un `<svg>` suelto con una línea de 1,6 px
 * y, debajo, tres números: mínimo, hoy, máximo. **El mínimo y el máximo NO
 * eran datos: eran los bordes del dibujo**, calculados como `min - 0.5` y
 * `max + 0.5` para que la línea no tocara el techo. La pantalla mostraba con
 * toda seriedad dos pesos que esa persona nunca pesó. Un número inventado que
 * parece un dato es peor que no mostrar nada, porque se cree.
 *
 * QUÉ ESTABA MAL DESPUÉS, y es el arreglo de esta tanda: **la media móvil era
 * de siete REGISTROS, no de siete días**. Para quien se pesa tres veces por
 * semana, la "tendencia de 7 días" abarcaba dos semanas y media. El rótulo
 * decía una cosa y el número era otro. Ahora la ventana es por fecha, en
 * `nucleo/peso.ts`.
 *
 * Y LO QUE FALTABA: no se podía leer un día. Ahora se arrastra el dedo y sale
 * la fecha con el peso, **crudo, no suavizado** — el suavizado es lo que se
 * puede afirmar sobre la tendencia, pero el número de un día es lo que decía
 * la balanza. Mostrar ahí el promedio sería el error del mínimo y el máximo
 * otra vez, con otra ropa.
 *
 * SIN EJES Y SIN GRILLA. La línea, el último punto y el rango en chico. Es el
 * acabado de los gráficos de Hevy y es lo que hace que se lea de un vistazo.
 */

const ANCHO = 300;
const ALTO = 84;
const VENTANA = 7; // días de la media móvil

// Las ventanas de tiempo. `null` es todo el historial.
const RANGOS: { dias: number | null; etiqueta: () => string }[] = [
  { dias: 30, etiqueta: () => T.stats.pesoMes },
  { dias: 90, etiqueta: () => T.stats.pesoTresMeses },
  { dias: null, etiqueta: () => T.stats.pesoTodo },
];

export default function GraficoPeso({
  pesos,
  unidad,
}: {
  pesos: PesoAnotado[];
  unidad: Unidad;
}) {
  const [rango, setRango] = useState<number | null>(null);
  const [tocado, setTocado] = useState<number | null>(null);
  const lienzoRef = useRef<HTMLDivElement>(null);

  // Se suaviza con TODO el historial y recién después se recorta la ventana:
  // al revés, el primer punto de "último mes" se promediaría solo consigo
  // mismo y la línea arrancaría con un escalón que no existe.
  const todo = suavizarPorFecha(
    pesos.map((p) => ({ fecha: p.fecha, valor: deKilos(p.valor, unidad) })),
    VENTANA
  );
  const serie = ultimosDias(todo, rango);
  if (serie.length < 2) return null;

  // El alto del dibujo se reparte con un margen arriba y abajo para que la
  // línea no toque los bordes. ESTOS números son de dibujo y por eso no se
  // muestran en ningún lado — que era exactamente el error de la primera
  // versión.
  const piso = Math.min(...serie.map((p) => p.suave));
  const techo = Math.max(...serie.map((p) => p.suave));
  const luz = Math.max(0.4, (techo - piso) * 0.25); // aire, y algo si es plano
  const min = piso - luz;
  const max = techo + luz;

  const punto = (v: number, i: number) => ({
    x: (i / (serie.length - 1)) * ANCHO,
    y: ALTO - ((v - min) / (max - min)) * ALTO,
  });
  const puntos = serie.map((p, i) => punto(p.suave, i));
  const linea = puntos
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  // El relleno le da cuerpo a la línea sin agregar ni una marca más. Cierra
  // por abajo del área visible para que el degradado se apague solo.
  const area = `${linea} L${ANCHO},${ALTO} L0,${ALTO} Z`;
  const ultimo = puntos[puntos.length - 1];

  const hoy = serie[serie.length - 1].suave;
  const cambio = hoy - serie[0].suave;
  const dias = serie.length;

  // ---- leer un día con el dedo ----
  //
  // Se busca el punto MÁS CERCANO en x, no el de abajo del dedo: el dedo tapa
  // 40 px y los puntos pueden estar a 3 px uno de otro. Sin esto hay que
  // apuntar, y apuntar en un gráfico de 84 px de alto no se puede.
  function alMover(clientX: number) {
    const caja = lienzoRef.current?.getBoundingClientRect();
    if (!caja || caja.width === 0) return;
    const t = Math.min(1, Math.max(0, (clientX - caja.left) / caja.width));
    setTocado(Math.round(t * (serie.length - 1)));
  }

  const elegido = tocado === null ? null : serie[tocado];
  const posElegido = tocado === null ? null : puntos[tocado];

  return (
    <div className="grafico-peso">
      {/* El svg y el punto van juntos adentro de su propio rectángulo: si el
          punto se posicionara contra el bloque entero, el `top` en porcentaje
          contaría también el padding de arriba y el pie de abajo, y quedaría
          desplazado hacia abajo del lugar donde está la línea. */}
      <div
        className="grafico-peso-lienzo"
        ref={lienzoRef}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          alMover(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0 || e.pointerType === 'touch') alMover(e.clientX);
        }}
        onPointerUp={() => setTocado(null)}
        onPointerCancel={() => setTocado(null)}
        onPointerLeave={() => setTocado(null)}
      >
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
          {posElegido && (
            <line
              x1={posElegido.x}
              y1="0"
              x2={posElegido.x}
              y2={ALTO}
              stroke="var(--pal-claro)"
              strokeWidth="1"
              opacity="0.45"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Los puntos van en HTML y no en el SVG: adentro del viewBox
            estirado saldrían ovalados. */}
        <span
          className="grafico-peso-punto"
          style={{ left: `${(ultimo.x / ANCHO) * 100}%`, top: `${(ultimo.y / ALTO) * 100}%` }}
        />
        {posElegido && (
          <span
            className="grafico-peso-punto tocado"
            style={{
              left: `${(posElegido.x / ANCHO) * 100}%`,
              top: `${(posElegido.y / ALTO) * 100}%`,
            }}
          />
        )}
      </div>

      {elegido ? (
        /* LO QUE SE MUESTRA AL TOCAR ES EL PESO CRUDO, no el suavizado: el
           suavizado es una afirmación sobre la tendencia, y esto es la
           pregunta "cuánto pesaba ese día". */
        <div className="grafico-peso-pie leyendo">
          <span className="cuando">{fechaLinda(elegido.fecha)}</span>
          <span className="hoy">
            {elegido.valor.toFixed(1)}
            <em>{unidad}</em>
          </span>
        </div>
      ) : (
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
      )}

      {/* La ventana. Con todo el historial, tres meses de una bajada de dos
          kilos se ven planos: la escala la manda el punto más lejano. */}
      <div className="grafico-peso-rangos">
        {RANGOS.map((r) => (
          <button
            key={String(r.dias)}
            className={r.dias === rango ? 'activo' : ''}
            onClick={() => {
              setRango(r.dias);
              setTocado(null);
            }}
          >
            {r.etiqueta()}
          </button>
        ))}
      </div>
    </div>
  );
}
