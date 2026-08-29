'use client';

// Galería de desarrollo: para revisar el motor de cuerpos celestes y la
// animación de subida sin necesidad de cuenta ni datos. No está enlazada
// desde la app; se entra a mano por /galeria.

import { useState } from 'react';
import FondoEspacial from '@/components/FondoEspacial';
import SubidaRango from '@/components/SubidaRango';
import Insignia from '@/components/Insignia';
import { PLANETAS, RANGOS } from '@/lib/rangos';
import { veloDeRango } from '@/lib/atmosfera';
import { eventos } from '@/plataforma/eventos';
import { PULSO } from '@/lib/pulso';

export default function Galeria() {
  const [rango, setRango] = useState(4);
  const [planeta, setPlaneta] = useState<string>('Júpiter');
  const [subida, setSubida] = useState<{ a: number; b: number } | null>(null);
  // El presagio y el velo por rango se miran acá, que es para lo que existe
  // esta pantalla: son las dos cosas del motor que en la app aparecen solas
  // —tres días antes de subir, y a lo largo de meses— y de otro modo no habría
  // forma de verlas sin esperar semanas.
  const [presagio, setPresagio] = useState(false);
  const [conVelo, setConVelo] = useState(false);

  return (
    <>
      <FondoEspacial
        key={`${rango}-${planeta}-${presagio}-${conVelo}`}
        rango={rango}
        planeta={planeta}
        presagio={presagio}
        esquina="abajo-derecha"
        // Se pasa el número a mano en vez de `atmosfera`: la atmósfera además
        // RECUERDA el último rango visto para animar la transición, y mirar
        // ocho rangos seguidos en la galería dejaría esa memoria apuntando a
        // cualquier lado. Acá solo interesa cuánto velo le toca a cada uno.
        velo={conVelo ? veloDeRango(rango) : 0.35}
      />
      <div className="pantalla">
        <div className="titulo-pantalla">Galería del motor</div>

        <div className="seccion">
          <h3>Rango</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {RANGOS.map((r) => (
              <button
                key={r.n}
                className="boton-fantasma"
                style={{
                  width: 'auto',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderColor: rango === r.n ? 'rgba(160,180,220,.5)' : undefined,
                  color: rango === r.n ? 'var(--tinta)' : undefined,
                }}
                onClick={() => setRango(r.n)}
              >
                <Insignia rango={r.n} tam={18} />
                {r.nombre}
              </button>
            ))}
          </div>
        </div>

        {rango === 4 && (
          <div className="seccion">
            <h3>Planeta del día</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PLANETAS.map((p) => (
                <button
                  key={p}
                  className="boton-fantasma"
                  style={{
                    width: 'auto',
                    padding: '7px 11px',
                    fontSize: 13,
                    borderColor: planeta === p ? 'rgba(160,180,220,.5)' : undefined,
                    color: planeta === p ? 'var(--tinta)' : undefined,
                  }}
                  onClick={() => setPlaneta(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="seccion">
          <h3>Atmósfera</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button
              className="boton-fantasma"
              style={{
                width: 'auto',
                padding: '8px 12px',
                fontSize: 13,
                borderColor: presagio ? 'rgba(160,180,220,.5)' : undefined,
                color: presagio ? 'var(--tinta)' : undefined,
              }}
              onClick={() => setPresagio((v) => !v)}
            >
              Presagio {presagio ? '✓' : ''}
            </button>
            <button
              className="boton-fantasma"
              style={{
                width: 'auto',
                padding: '8px 12px',
                fontSize: 13,
                borderColor: conVelo ? 'rgba(160,180,220,.5)' : undefined,
                color: conVelo ? 'var(--tinta)' : undefined,
              }}
              onClick={() => setConVelo((v) => !v)}
            >
              Velo del rango {conVelo ? '✓' : ''}
            </button>
            {/* El impacto de registrar el día. Dura medio segundo y en la app
                pasa una vez por día: mirarlo acá es la única forma de
                calibrarlo sin registrar días de mentira. */}
            <button
              className="boton-fantasma"
              style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }}
              onClick={() => eventos.emitir(PULSO)}
            >
              Pulso del día
            </button>
          </div>
        </div>

        <div className="seccion">
          <h3>Subidas de rango</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {RANGOS.slice(0, 7).map((r) => (
              <button
                key={r.n}
                className="boton-fantasma"
                style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }}
                onClick={() => setSubida({ a: r.n, b: r.n + 1 })}
              >
                {r.n} → {r.n + 1}
                {r.n === 4 ? ' (ignición)' : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      {subida && (
        <SubidaRango
          rangoAntes={subida.a}
          rangoDespues={subida.b}
          alCerrar={() => setSubida(null)}
        />
      )}
    </>
  );
}
