'use client';

import { useRef, useState } from 'react';
import { conComa, puntoMasCercano, trazarPeso, type Unidad } from '@nucleo/peso';
import { fechaLinda } from '@nucleo/fechas';
import { T } from '@nucleo/textos';
import type { PesoAnotado } from '@/components/GraficoPeso';

/**
 * LA PROPUESTA cambia UNA cosa de `src/components/GraficoPeso.tsx`: cuando la
 * ventana elegida no tiene dos anotaciones, el gráfico no desaparece. Quedan
 * los botones —que son la única forma de volver— y una línea que dice por qué
 * no hay dibujo. Todo lo demás es el componente de hoy, copiado tal cual.
 */

const ANCHO = 300;
const ALTO = 84;
const VENTANA = 7;

const RANGOS: { dias: number | null; etiqueta: () => string }[] = [
  { dias: 30, etiqueta: () => T.stats.pesoMes },
  { dias: 90, etiqueta: () => T.stats.pesoTresMeses },
  { dias: null, etiqueta: () => T.stats.pesoTodo },
];

export default function GraficoPesoPropuesto({ pesos, unidad }: { pesos: PesoAnotado[]; unidad: Unidad }) {
  const [rango, setRango] = useState<number | null>(null);
  const [tocado, setTocado] = useState<number | null>(null);
  const lienzoRef = useRef<HTMLDivElement>(null);

  const trazo = trazarPeso(pesos, unidad, rango, ANCHO, ALTO, VENTANA);

  const ventanas = (
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
  );

  if (!trazo) {
    // Sin dos anotaciones en TODO el historial no hay ventana que elegir: ese
    // caso ya lo dice quien llama (`T.stats.pesoUnoMas`).
    if (rango === null) return null;
    return (
      <div className="grafico-peso">
        {/* El mismo alto que el dibujo: los botones no saltan de lugar al tocar. */}
        <div className="grafico-peso-lienzo" style={{ display: 'flex', alignItems: 'center' }}>
          <p className="nota-privada" style={{ margin: 0 }}>
            En este período no hay dos anotaciones: con menos no se ve una tendencia.
          </p>
        </div>
        {ventanas}
      </div>
    );
  }

  const { serie, puntos, linea, area, hoy, cambio, dias } = trazo;
  const ultimo = puntos[puntos.length - 1];

  function alMover(clientX: number) {
    const caja = lienzoRef.current?.getBoundingClientRect();
    if (!caja || caja.width === 0) return;
    setTocado(puntoMasCercano((clientX - caja.left) / caja.width, serie.length));
  }

  const elegido = tocado === null ? null : serie[tocado];
  const posElegido = tocado === null ? null : puntos[tocado];

  return (
    <div className="grafico-peso">
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
            <linearGradient id="peso-relleno-propuesto" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--pal-claro)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--pal-claro)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#peso-relleno-propuesto)" />
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

        <span
          className="grafico-peso-punto"
          style={{ left: `${(ultimo.x / ANCHO) * 100}%`, top: `${(ultimo.y / ALTO) * 100}%` }}
        />
        {posElegido && (
          <span
            className="grafico-peso-punto tocado"
            style={{ left: `${(posElegido.x / ANCHO) * 100}%`, top: `${(posElegido.y / ALTO) * 100}%` }}
          />
        )}
      </div>

      {elegido ? (
        <div className="grafico-peso-pie leyendo">
          <span className="cuando">{fechaLinda(elegido.fecha)}</span>
          <span className="hoy">
            {conComa(elegido.valor.toFixed(1))}
            <em>{unidad}</em>
          </span>
        </div>
      ) : (
        <div className="grafico-peso-pie">
          <span className="hoy">
            {conComa(hoy.toFixed(1))}
            <em>{unidad}</em>
          </span>
          <span className="cambio">
            {T.stats.pesoCambio(dias, `${cambio >= 0 ? '+' : '−'}${conComa(Math.abs(cambio).toFixed(1))}`, unidad)}
          </span>
        </div>
      )}

      {ventanas}
    </div>
  );
}
