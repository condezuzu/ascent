'use client';

// Galería de desarrollo: para revisar el motor de cuerpos celestes y la
// animación de subida sin necesidad de cuenta ni datos. No está enlazada
// desde la app; se entra a mano por /galeria.

import { useState } from 'react';
import FondoEspacial from '@/components/FondoEspacial';
import SubidaRango from '@/components/SubidaRango';
import Insignia from '@/components/Insignia';
import { PLANETAS, RANGOS } from '@/lib/rangos';

export default function Galeria() {
  const [rango, setRango] = useState(4);
  const [planeta, setPlaneta] = useState<string>('Júpiter');
  const [subida, setSubida] = useState<{ a: number; b: number } | null>(null);

  return (
    <>
      <FondoEspacial
        key={`${rango}-${planeta}`}
        rango={rango}
        planeta={planeta}
        esquina="abajo-derecha"
        velo={0.35}
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
