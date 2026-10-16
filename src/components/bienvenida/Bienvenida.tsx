'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import FondoEspacial from '@/components/FondoEspacial';
import Insignia from '@/components/Insignia';
import Objetos from '@/components/bienvenida/Objetos';
import { numeroDeRango } from '@nucleo/rangos';
import { DIAS_SEMANA } from '@nucleo/fechas';
import { T } from '@nucleo/textos';

/**
 * LA ENTRADA (15/10, aprobada en la galería): cuatro pantallas, una cosa real de la
 * app cada una —los pesos, el día que entra solo, el amigo en vivo y el ranking—,
 * sobre el espacio de la app (el motor con `soloEstrellas`: estrellas y fugaces,
 * sin el polvo). No hay "Saltar": el circulito carga un segundo y medio y recién
 * ahí deja pasar. La última termina en "Crear cuenta" / "Ya tengo cuenta". Los
 * rangos se ven y no se explican (§7).
 *
 * La misma pantalla que la nativa (`movil/src/Bienvenida.tsx`). Solo la ve un
 * aparato que nunca la vio y nunca tuvo sesión: ver `compartido/entradaVista.ts`.
 */
export const PANTALLAS_DE_LA_ENTRADA = ['pesos', 'llegar', 'amigo', 'ranking'] as const;
type Clave = (typeof PANTALLAS_DE_LA_ENTRADA)[number];
const CARGA_MS = 1500;

const titulo: CSSProperties = { fontSize: 32, lineHeight: 1.15, fontWeight: 500, color: 'var(--tinta)', margin: '0 0 12px' };
const bajada: CSSProperties = { fontSize: 17, lineHeight: 1.5, color: 'var(--sub)', margin: 0 };
const caja: CSSProperties = {
  border: '1px solid var(--linea)',
  borderRadius: 14,
  background: 'color-mix(in srgb, var(--fondo) 72%, transparent)',
};

/** Segundos desde que apareció la pantalla. */
function useReloj(clave: string) {
  const [t, setT] = useState(0);
  useEffect(() => {
    setT(0);
    const t0 = performance.now();
    const id = setInterval(() => setT((performance.now() - t0) / 1000), 100);
    return () => clearInterval(id);
  }, [clave]);
  return t;
}

// ── LO DE ARRIBA DE CADA TEXTO: un pedazo de la app con datos de muestra ──

function MiniBloque({ t }: { t: number }) {
  const hechas = Math.floor(t / 1.2) % 4;
  return (
    <div style={{ ...caja, padding: '16px 18px' }}>
      <div style={{ fontSize: 17 }}>{T.bienvenida.muestraEjercicio}</div>
      <div style={{ display: 'flex', gap: 6, margin: '14px 0' }}>
        {[2, 3, 4, 5].map((m) => (
          <span key={m} style={{ flex: 1, textAlign: 'center', border: `1px solid ${m === 3 ? 'var(--sub)' : 'var(--linea)'}`, borderRadius: 999, padding: '7px 0', fontSize: 13, color: m === 3 ? 'var(--tinta)' : 'var(--apagado)' }}>
            ×{m}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 22, fontWeight: 300 }}>
          60 <span style={{ color: 'var(--sub)', fontSize: 14 }}>kg</span>
          <span style={{ color: 'var(--apagado)', fontSize: 12, marginLeft: 10 }}>{T.bienvenida.muestraLaUltimaVez}</span>
        </span>
        <span style={{ display: 'flex', gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 14, height: 14, borderRadius: 7, border: `1px solid ${i < hechas ? 'var(--acento)' : 'var(--sub)'}`, background: i < hechas ? 'var(--acento)' : 'transparent', transition: 'background .3s' }} />
          ))}
        </span>
      </div>
      <div style={{ marginTop: 14, border: '1px solid var(--linea)', borderRadius: 4, padding: '14px 0', textAlign: 'center', fontSize: 22 }}>+</div>
    </div>
  );
}

function MiniSemana({ t }: { t: number }) {
  const llego = Math.floor(t / 2.4) % 2 === 1;
  const letras = [1, 2, 3, 4, 5, 6, 0].map((d) => DIAS_SEMANA[d]);
  return (
    <div style={{ ...caja, padding: '16px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, color: llego ? 'var(--tinta)' : 'var(--sub)', fontSize: 14, transition: 'color .4s' }}>
        <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden>
          <path d="M8 19s6-6.2 6-11A6 6 0 0 0 2 8c0 4.8 6 11 6 11z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="2.2" fill="currentColor" />
        </svg>
        {llego ? T.bienvenida.muestraLlegaste : T.bienvenida.muestraDeCamino}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {letras.map((d, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 30, height: 30, borderRadius: 15, border: `1px solid ${i === 3 ? 'var(--acento)' : 'var(--linea)'}`, background: i < 3 || (i === 3 && llego) ? 'var(--acento)' : 'transparent', transition: 'background .5s' }} />
            <span style={{ color: 'var(--apagado)', fontSize: 12 }}>{d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniAmigo({ t }: { t: number }) {
  const ciclo = t % 18;
  const serie = 2 + (Math.floor(t / 18) % 3);
  const descansa = ciclo < 12;
  const falta = Math.ceil(12 - ciclo) + 60;
  const mateoDescansa = (t + 7) % 14 < 6;
  const vivo = (
    <span style={{ position: 'relative', width: 7, height: 7, flex: 'none', display: 'inline-block' }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: 4, background: 'var(--vivo)' }} />
      <span className="entrada-latido" style={{ position: 'absolute', inset: -4, borderRadius: 8, border: '1px solid var(--vivo)' }} />
    </span>
  );
  const fila = (inicial: string, nombre: string, que: string, derecha: ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0' }}>
      <span style={{ width: 36, height: 36, borderRadius: 18, border: '1px solid var(--linea)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{inicial}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
          {nombre} {vivo}
        </div>
        <div key={que} className="entrada-aparece" style={{ color: 'var(--sub)', fontSize: 13, marginTop: 2 }}>
          {que}
        </div>
      </div>
      {derecha}
    </div>
  );
  return (
    <div style={{ ...caja, padding: '6px 18px' }}>
      <div style={{ color: 'var(--apagado)', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', padding: '10px 0 2px' }}>{T.bienvenida.muestraEntrenandoContigo}</div>
      {fila(
        'L',
        'lucia',
        T.bienvenida.muestraSerie(T.bienvenida.muestraSentadilla, serie, 4),
        descansa ? (
          <span style={{ textAlign: 'right' }}>
            <span style={{ display: 'block', fontSize: 17, fontVariantNumeric: 'tabular-nums' }}>
              {Math.floor(falta / 60)}:{String(falta % 60).padStart(2, '0')}
            </span>
            <span style={{ color: 'var(--sub)', fontSize: 11 }}>{T.bienvenida.muestraDescanso}</span>
          </span>
        ) : (
          <span className="entrada-aparece" style={{ color: 'var(--acento)', fontSize: 13 }}>
            {T.bienvenida.muestraHaciendoLaSerie}
          </span>
        )
      )}
      <div style={{ height: 1, background: 'var(--linea)' }} />
      {fila('M', 'mateo', T.bienvenida.muestraSerie(T.bienvenida.muestraRemo, 1, 3), <span style={{ color: 'var(--sub)', fontSize: 13 }}>{mateoDescansa ? T.bienvenida.muestraDescansa : T.bienvenida.muestraAhora}</span>)}
    </div>
  );
}

// ── LA ÚLTIMA: EL RANKING, QUE TERMINA EN LA CUENTA ──

const GENTE = [
  { n: 'lucia', racha: 63 },
  { n: 'mateo', racha: 38 },
  { n: 'sofi', racha: 37 },
  { n: 'nico', racha: 21 },
  { n: 'vale', racha: 9 },
];
const LUGARES = [
  { x: 78, y: 7 },
  { x: 16, y: 8 },
  { x: 84, y: 66 },
  { x: 18, y: 72 },
  { x: 58, y: 79 },
];

function Ranking({ t, alSalir }: { t: number; alSalir: (destino: 'crear' | 'entrar') => void }) {
  const paso = t < 0.4 ? 0 : t < 2.6 ? 1 : t < 4.6 ? 2 : t < 5.6 ? 3 : 4;
  const sofiPasa = paso >= 2;
  const filas = GENTE.map((g) => (g.n === 'sofi' && sofiPasa ? { ...g, racha: 39 } : g)).sort((a, b) => b.racha - a.racha);
  const lugar = (n: string) => filas.findIndex((f) => f.n === n);
  const ALTO_FILA = 52;
  return (
    <>
      <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: paso >= 3 ? 0.35 : 0.9, transition: 'opacity 1.2s ease' }}>
        {GENTE.map((g, i) => {
          const tam = 16 + (g.racha / 63) * 22;
          return (
            <span key={g.n} className="entrada-flota" style={{ position: 'absolute', left: `${LUGARES[i].x}%`, top: `${LUGARES[i].y}%`, animationDelay: `${i * -1.3}s`, filter: `drop-shadow(0 0 ${8 + tam / 6}px color-mix(in srgb, var(--acento) 35%, transparent))` }}>
              <Insignia rango={numeroDeRango(g.racha)} tam={tam} />
            </span>
          );
        })}
      </div>
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 28px', gap: 30, transform: paso >= 3 ? 'translateY(-36px)' : 'none', transition: 'transform 1s cubic-bezier(.2,.7,.2,1)' }}>
        <div style={{ ...caja, background: 'color-mix(in srgb, var(--fondo) 90%, transparent)', padding: '6px 18px', position: 'relative', height: ALTO_FILA * GENTE.length + 12, opacity: paso >= 1 ? 1 : 0, transition: 'opacity .7s ease' }}>
          {GENTE.map((g) => {
            const f = filas.find((x) => x.n === g.n)!;
            const i = lugar(g.n);
            return (
              <div key={g.n} style={{ position: 'absolute', left: 18, right: 18, top: 6 + i * ALTO_FILA, height: ALTO_FILA, display: 'flex', alignItems: 'center', gap: 12, transition: 'top .8s cubic-bezier(.2,.7,.2,1)', borderTop: i ? '1px solid var(--linea)' : 'none' }}>
                <span style={{ width: 16, color: 'var(--sub)', fontSize: 14 }}>{i + 1}</span>
                <span style={{ width: 32, height: 32, borderRadius: 16, border: '1px solid var(--linea)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{g.n[0].toUpperCase()}</span>
                <span style={{ flex: 1, fontSize: 15 }}>{g.n}</span>
                <Insignia rango={numeroDeRango(f.racha)} tam={20} />
                <span style={{ width: 28, textAlign: 'right', color: g.n === 'sofi' && sofiPasa ? 'var(--tinta)' : 'var(--acento)', fontSize: 17, fontVariantNumeric: 'tabular-nums' }}>{f.racha}</span>
              </div>
            );
          })}
        </div>
        <h1 style={titulo}>{T.bienvenida.rankingTitulo}</h1>
      </div>
      <div aria-hidden className={paso >= 3 ? 'entrada-luz' : ''} style={{ position: 'absolute', left: '50%', top: '64%', width: 2, height: 0, marginLeft: -1, opacity: 0, background: 'linear-gradient(to bottom, transparent, var(--acento))' }} />
      <div style={{ position: 'relative', padding: '0 28px 34px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 112 }}>
        <button
          data-testid="bienvenida-crear"
          disabled={paso < 4}
          onClick={() => alSalir('crear')}
          style={{
            width: paso >= 4 ? '100%' : 12,
            height: paso >= 4 ? 52 : 12,
            borderRadius: paso >= 4 ? 2 : 6,
            border: 'none',
            background: 'var(--tinta)',
            color: 'var(--fondo)',
            fontSize: 16,
            fontWeight: 600,
            opacity: paso >= 3 ? 1 : 0,
            boxShadow: paso >= 3 ? `0 0 ${paso >= 4 ? 30 : 18}px color-mix(in srgb, var(--tinta) 35%, transparent)` : 'none',
            transition: 'width .7s cubic-bezier(.2,.7,.2,1), height .5s cubic-bezier(.2,.7,.2,1), border-radius .5s, opacity .4s, box-shadow 1.2s',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            cursor: paso >= 4 ? 'pointer' : 'default',
          }}
        >
          <span style={{ opacity: paso >= 4 ? 1 : 0, transition: 'opacity .4s ease .45s' }}>{T.bienvenida.crear}</span>
        </button>
        <button
          data-testid="bienvenida-entrar"
          disabled={paso < 4}
          onClick={() => alSalir('entrar')}
          className="boton-texto"
          style={{ color: 'var(--sub)', fontSize: 15, padding: '14px 0 0', width: 'auto', opacity: paso >= 4 ? 1 : 0, transition: 'opacity .5s ease .8s' }}
        >
          {T.bienvenida.entrar}
        </button>
      </div>
    </>
  );
}

/** El circulito: carga un segundo y medio y recién ahí deja pasar. */
function Circulito({ clave, alPasar }: { clave: string; alPasar: () => void }) {
  const [listo, setListo] = useState(false);
  useEffect(() => {
    setListo(false);
    const id = setTimeout(() => setListo(true), CARGA_MS);
    return () => clearTimeout(id);
  }, [clave]);
  const R = 25;
  const L = 2 * Math.PI * R;
  return (
    <button
      data-testid="bienvenida-siguiente"
      onClick={() => listo && alPasar()}
      aria-label={T.bienvenida.siguiente}
      disabled={!listo}
      style={{ position: 'relative', width: 58, height: 58, borderRadius: 29, border: 'none', background: 'transparent', padding: 0, cursor: listo ? 'pointer' : 'default' }}
    >
      <svg width="58" height="58" viewBox="0 0 58 58" style={{ position: 'absolute', inset: 0 }} aria-hidden>
        <circle cx="29" cy="29" r={R} fill={listo ? 'color-mix(in srgb, var(--tinta) 8%, transparent)' : 'none'} stroke="var(--linea)" strokeWidth="1.5" />
        <circle
          key={clave}
          className="entrada-carga"
          cx="29"
          cy="29"
          r={R}
          fill="none"
          stroke="var(--tinta)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray={L}
          style={{ ['--largo' as string]: `${L}px`, animationDuration: `${CARGA_MS}ms`, transform: 'rotate(-90deg)', transformOrigin: '29px 29px' }}
        />
      </svg>
      <svg width="58" height="58" viewBox="0 0 58 58" style={{ position: 'absolute', inset: 0, opacity: listo ? 1 : 0.25, transition: 'opacity .3s' }} aria-hidden>
        <path d="M25 21l8 8-8 8" fill="none" stroke="var(--tinta)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export default function Bienvenida({ alSalir, inicial = 'pesos' }: { alSalir: (destino: 'crear' | 'entrar') => void; inicial?: Clave }) {
  const [clave, setClave] = useState<Clave>(inicial);
  const t = useReloj(clave);
  const indice = PANTALLAS_DE_LA_ENTRADA.indexOf(clave);
  const texto = {
    pesos: { titulo: T.bienvenida.pesosTitulo, bajada: T.bienvenida.pesosBajada },
    llegar: { titulo: T.bienvenida.llegarTitulo, bajada: T.bienvenida.llegarBajada },
    amigo: { titulo: T.bienvenida.amigoTitulo, bajada: T.bienvenida.amigoBajada },
    ranking: { titulo: '', bajada: '' },
  }[clave];
  return (
    <div className="entrada bienv" data-testid="bienvenida">
      <FondoEspacial rango={1} soloEstrellas velo={0.5} />
      {clave === 'amigo' && <Objetos escala={0.6} />}
      {clave === 'ranking' ? (
        <Ranking t={t} alSalir={alSalir} />
      ) : (
        <>
          <div key={clave} className="entrada-pantalla" style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 28px', gap: 34, maxWidth: 520, width: '100%', margin: '0 auto' }}>
            {clave === 'pesos' && <MiniBloque t={t} />}
            {clave === 'llegar' && <MiniSemana t={t} />}
            {clave === 'amigo' && <MiniAmigo t={t} />}
            <div>
              <h1 style={titulo}>{texto.titulo}</h1>
              <p style={bajada}>{texto.bajada}</p>
            </div>
          </div>
          <div style={{ position: 'relative', padding: '0 28px 34px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, minHeight: 112 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {PANTALLAS_DE_LA_ENTRADA.map((p, i) => (
                <span key={p} style={{ width: 6, height: 6, borderRadius: 3, background: i === indice ? 'var(--tinta)' : 'var(--apagado)' }} />
              ))}
            </div>
            <Circulito clave={clave} alPasar={() => setClave(PANTALLAS_DE_LA_ENTRADA[indice + 1])} />
          </div>
        </>
      )}
    </div>
  );
}
