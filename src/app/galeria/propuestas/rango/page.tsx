'use client';

// Propuesta: el rango sale de una sola fuente.
//
// EL BUG QUE MUESTRA (4/10): con racha 43, Stats dice "Planeta" y el fondo
// dibuja el Sol. El nombre lo calcula el cliente con su tabla; el fondo usa el
// número que guarda la base, que en producción (esquema 53) todavía sale de la
// tabla vieja. Acá se mueve la racha y se ven las dos cuentas una al lado de la
// otra, y al lado la propuesta: una sola.

import { useEffect, useState, type ReactNode } from 'react';
import FondoEspacial from '@/components/FondoEspacial';
import Insignia from '@/components/Insignia';
import type { Paleta } from '@nucleo/paletas';
import { Banco, Comparar, Lado } from '../Banco';
import { comoHoy, rangoVisto, tramos, type Esquema } from './unRango';

const TOPE = 130;
// Un día de cada tramo donde las dos cuentas se separan, y el 0 y el 106 donde no.
const ATAJOS = [0, 6, 16, 30, 43, 50, 60, 72, 106];

function Muestras({ paleta }: { paleta: Paleta }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {[paleta.apagado, paleta.principal, paleta.claro].map((c, i) => (
        <i key={i} style={{ width: 20, height: 20, background: c, border: '1px solid var(--linea)' }} />
      ))}
    </span>
  );
}

function Dato({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 46, borderTop: '1px solid var(--linea)' }}>
      <span style={{ flex: 1, color: 'var(--sub)', fontSize: 13 }}>{rotulo}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15 }}>{children}</span>
    </div>
  );
}

function Opcion({ activa, alTocar, children }: { activa: boolean; alTocar: () => void; children: ReactNode }) {
  return (
    <button
      className="boton-fantasma"
      style={{
        padding: '8px 2px 4px',
        fontSize: 14,
        color: activa ? 'var(--tinta)' : undefined,
        borderColor: activa ? 'var(--pal-claro)' : 'transparent',
      }}
      onClick={alTocar}
    >
      {children}
    </button>
  );
}

export default function PropuestaRango() {
  const [racha, setRacha] = useState(43);
  const [esquema, setEsquema] = useState<Esquema>(53);
  const [fondo, setFondo] = useState<'hoy' | 'propuesta'>('hoy');

  // Para sacar la foto de un caso sin tocar nada: ?racha=72&esquema=53&fondo=hoy
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const r = Number(p.get('racha'));
    if (p.get('racha') !== null && Number.isFinite(r)) setRacha(Math.min(TOPE, Math.max(0, Math.round(r))));
    if (p.get('esquema') === '54') setEsquema(54);
    if (p.get('fondo') === 'propuesta') setFondo('propuesta');
  }, []);

  const hoy = comoHoy(racha, esquema);
  const una = rangoVisto(racha);
  const dibujado = fondo === 'hoy' ? { rango: hoy.dibuja, planeta: hoy.planeta } : { rango: una.n, planeta: una.planeta };

  return (
    <>
      <FondoEspacial
        key={`${dibujado.rango}-${dibujado.planeta}`}
        rango={dibujado.rango}
        planeta={dibujado.planeta}
        esquina="abajo-derecha"
        velo={0.35}
      />
      <Banco
        titulo="El rango, de una sola fuente"
        queEs="Hoy el nombre del rango lo calcula el cliente con la racha, y el fondo, la insignia y los colores salen del número que guarda la base. Cuando las dos reglas no son la misma, la app se contradice sola."
      >
        <div className="seccion" style={{ marginLeft: 'var(--saliente)' }}>
          <h3>Racha: {racha}</h3>
          <input
            type="range"
            min={0}
            max={TOPE}
            value={racha}
            onChange={(e) => setRacha(Number(e.target.value))}
            aria-label="Racha"
            style={{ width: '100%', maxWidth: 520, accentColor: 'var(--pal-claro)' }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 6 }}>
            {ATAJOS.map((d) => (
              <Opcion key={d} activa={racha === d} alTocar={() => setRacha(d)}>
                {d}
              </Opcion>
            ))}
          </div>
        </div>

        <div className="seccion" style={{ marginLeft: 'var(--saliente)' }}>
          <h3>La base de producción</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
            <Opcion activa={esquema === 53} alTocar={() => setEsquema(53)}>
              esquema 53 (hoy)
            </Opcion>
            <Opcion activa={esquema === 54} alTocar={() => setEsquema(54)}>
              esquema 54 (migrada)
            </Opcion>
          </div>
        </div>

        <div className="seccion" style={{ marginLeft: 'var(--saliente)' }}>
          <h3>El fondo y los colores de esta página</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
            <Opcion activa={fondo === 'hoy'} alTocar={() => setFondo('hoy')}>
              como hoy
            </Opcion>
            <Opcion activa={fondo === 'propuesta'} alTocar={() => setFondo('propuesta')}>
              con la propuesta
            </Opcion>
          </div>
        </div>

        <Comparar>
          <Lado
            rotulo="Hoy · dos cuentas"
            nota="El nombre sale de la racha con la tabla del cliente (Stats → Rangos). El fondo, la insignia y los colores salen de rango_actual, que escribe la base con la suya."
          >
            <Dato rotulo="Stats dice">{hoy.dice}</Dato>
            <Dato rotulo="El fondo dibuja">
              {hoy.nombreDeLoQueDibuja ? (
                <>
                  <Insignia rango={hoy.dibuja} tam={20} />
                  {hoy.nombreDeLoQueDibuja}
                </>
              ) : (
                <span style={{ color: 'var(--peligro)' }}>nada: el rango {hoy.dibuja} ya no existe</span>
              )}
            </Dato>
            <Dato rotulo="La app se tiñe de">
              <Muestras paleta={hoy.paleta} />
            </Dato>
            <Dato rotulo="Planeta del día">{hoy.planeta ? `${hoy.planeta}${hoy.dibuja === 4 ? '' : ' (no se usa)'}` : '—'}</Dato>
            <p style={{ margin: '14px 0 0', fontSize: 14, color: hoy.coinciden ? 'var(--sub)' : 'var(--peligro)' }}>
              {hoy.coinciden ? 'Coinciden.' : 'No coinciden: dice una cosa y dibuja otra.'}
            </p>
          </Lado>

          <Lado
            rotulo="Propuesta · una sola"
            nota="Todo sale de la racha con una sola función. rango_actual no se lee para dibujar, así que da igual en qué esquema esté la base."
          >
            <Dato rotulo="Stats dice">{una.nombre}</Dato>
            <Dato rotulo="El fondo dibuja">
              <Insignia rango={una.n} tam={20} />
              {una.nombre}
            </Dato>
            <Dato rotulo="La app se tiñe de">
              <Muestras paleta={una.paleta} />
            </Dato>
            <Dato rotulo="Planeta del día">{una.planeta ?? '—'}</Dato>
            <p style={{ margin: '14px 0 0', fontSize: 14, color: 'var(--sub)' }}>Coinciden siempre: es el mismo dato.</p>
          </Lado>
        </Comparar>

        <div className="seccion" style={{ margin: '34px 0 0 var(--saliente)' }}>
          <h3>Día por día, con la base en el esquema {esquema}</h3>
          <div style={{ maxWidth: 620, fontSize: 14 }}>
            {tramos(esquema, TOPE).map((t) => {
              const aca = racha >= t.desde && racha <= t.hasta;
              return (
                <div
                  key={t.desde}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '9px 0 9px 10px',
                    borderTop: '1px solid var(--linea)',
                    borderLeft: `2px solid ${aca ? 'var(--pal-claro)' : 'transparent'}`,
                  }}
                >
                  <span style={{ width: 70, fontFamily: 'var(--f-mono), monospace', color: 'var(--sub)' }}>
                    {t.desde === t.hasta ? t.desde : `${t.desde}–${t.hasta === TOPE ? '…' : t.hasta}`}
                  </span>
                  <span style={{ flex: 1, color: t.coinciden ? 'var(--apagado)' : 'var(--tinta)' }}>
                    {t.coinciden ? (
                      t.dice
                    ) : (
                      <>
                        dice {t.dice} y dibuja{' '}
                        <span style={{ color: 'var(--peligro)' }}>{t.dibuja ?? 'nada (cielo vacío, colores de Polvo)'}</span>
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Banco>
    </>
  );
}
