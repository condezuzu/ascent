'use client';

// Propuesta: la bienvenida nueva (15/10, segunda vuelta con el veredicto).
//
// Antes de la cuenta, cuatro pantallas, una cosa real de la app cada una: los pesos,
// el día que entra solo, el amigo en vivo y el ranking. La del ranking es la última y
// la más fuerte: termina en crear la cuenta. No hay "Saltar": un circulito carga un
// segundo y medio y recién ahí deja pasar.
//
// EL FONDO ES EL ESPACIO DE LA APP: el motor con `soloEstrellas` —las estrellas y las
// fugaces de verdad, sin el polvo, que ensucia (veredicto del 15/10)— y el velo de la
// app nativa (0,5). Como el motor es uno por página, cada pantalla va en su propio iframe
// (`?marco=<clave>`), que es la pantalla sola a 390 × 844.
//
// Los globitos de adentro van sobre capturas REALES de la app; lo único dibujado es el
// globito.

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import FondoEspacial from '@/components/FondoEspacial';
import Insignia from '@/components/Insignia';
import Objetos from '@/components/bienvenida/Objetos';
import { numeroDeRango } from '@nucleo/rangos';
import { Banco } from '../Banco';
import { Captura, C, Fila, FUENTE, GloboComic, Marco, Titulito, cajas } from '../Captura';

const CARGA_MS = 1500;
const PANTALLAS = ['pesos', 'llegar', 'amigo', 'ranking'] as const;
type Clave = (typeof PANTALLAS)[number];
const TEXTO: Record<Clave, { titulo: string; bajada: string }> = {
  pesos: { titulo: 'Ya no adivines los pesos', bajada: 'Anota cada serie y su peso, y la próxima vez ya está puesto.' },
  llegar: { titulo: 'El día se anota solo al llegar al gimnasio', bajada: 'Por la ubicación, aunque no abras la app.' },
  amigo: { titulo: 'Entrena con un amigo y mira lo que hace, en vivo', bajada: 'Su ejercicio, su serie y cuánto le queda de descanso.' },
  ranking: { titulo: 'Mira quién llega más lejos', bajada: '' },
};
const NOTA: Record<Clave, string> = {
  pesos: '1 · Texto nuevo. El bloque es el de Inicio: el peso de la última vez ya puesto y los puntos llenándose.',
  llegar: '2 · Queda igual.',
  amigo: '3 · Texto nuevo y más viva: el punto de «en vivo», el descanso que corre y la serie que avanza cuando termina.',
  ranking: '4 · Nueva y la última. Las insignias de cada racha flotando detrás, alguien que pasa a otro, y la luz que baja y se vuelve «Crear cuenta».',
};

const titulo: CSSProperties = { fontSize: 32, lineHeight: 1.15, fontWeight: 500, color: C.tinta, margin: '0 0 12px' };
const bajada: CSSProperties = { fontSize: 17, lineHeight: 1.5, color: C.sub, margin: 0 };
const caja: CSSProperties = { border: `1px solid ${C.linea}`, borderRadius: 14, background: 'rgba(11,13,19,0.72)' };

/** Un reloj en segundos desde que la pantalla apareció. */
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

// ── LO DE ARRIBA DE CADA TEXTO ──

function MiniBloque({ t }: { t: number }) {
  const hechas = Math.floor(t / 1.2) % 4;
  return (
    <div style={{ ...caja, padding: '16px 18px' }}>
      <div style={{ color: C.tinta, fontSize: 17 }}>Press de banca · pecho</div>
      <div style={{ display: 'flex', gap: 6, margin: '14px 0' }}>
        {[2, 3, 4, 5].map((m) => (
          <span key={m} style={{ flex: 1, textAlign: 'center', border: `1px solid ${m === 3 ? C.sub : C.linea}`, borderRadius: 999, padding: '7px 0', fontSize: 13, color: m === 3 ? C.tinta : C.apagado }}>
            ×{m}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: C.tinta, fontSize: 22, fontWeight: 300 }}>
          60 <span style={{ color: C.sub, fontSize: 14 }}>kg</span>
          <span style={{ color: C.apagado, fontSize: 12, marginLeft: 10 }}>la última vez</span>
        </span>
        <span style={{ display: 'flex', gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 14, height: 14, borderRadius: 7, border: `1px solid ${i < hechas ? C.claro : C.sub}`, background: i < hechas ? C.claro : 'transparent', transition: 'background .3s' }} />
          ))}
        </span>
      </div>
      <div style={{ marginTop: 14, border: `1px solid ${C.lineaFuerte}`, borderRadius: 4, padding: '14px 0', textAlign: 'center', color: C.tinta, fontSize: 22 }}>+</div>
    </div>
  );
}

function MiniSemana({ t }: { t: number }) {
  const llego = Math.floor(t / 2.4) % 2 === 1;
  return (
    <div style={{ ...caja, padding: '16px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, color: llego ? C.tinta : C.sub, fontSize: 14, transition: 'color .4s' }}>
        <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden>
          <path d="M8 19s6-6.2 6-11A6 6 0 0 0 2 8c0 4.8 6 11 6 11z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="2.2" fill="currentColor" />
        </svg>
        {llego ? 'Llegaste al gimnasio · día anotado' : 'De camino al gimnasio'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => (
          <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 30, height: 30, borderRadius: 15, border: `1px solid ${i === 3 ? C.claro : C.lineaFuerte}`, background: i < 3 || (i === 3 && llego) ? C.claro : 'transparent', transition: 'background .5s' }} />
            <span style={{ color: C.apagado, fontSize: 12 }}>{d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Entrenando contigo, vivo: el descanso corre, y al terminar la serie avanza. */
function MiniAmigo({ t }: { t: number }) {
  // Lucía: 12 s de descanso, después 6 s haciendo la serie, y vuelta.
  const ciclo = t % 18;
  const vuelta = Math.floor(t / 18);
  const serieLucia = 2 + (vuelta % 3);
  const descansa = ciclo < 12;
  const falta = Math.ceil(12 - ciclo) + 60;
  const mateoDescansa = (t + 7) % 14 < 6;
  const vivo = (on: boolean) => (
    <span style={{ position: 'relative', width: 7, height: 7, flex: 'none' }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: 4, background: on ? '#8fd6a4' : C.apagado }} />
      {on && <span className="latido-vivo" style={{ position: 'absolute', inset: -4, borderRadius: 8, border: '1px solid #8fd6a4' }} />}
    </span>
  );
  const fila = (inicial: string, nombre: string, que: string, derecha: ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0' }}>
      <span style={{ width: 36, height: 36, borderRadius: 18, border: `1px solid ${C.lineaFuerte}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.tinta, fontSize: 14 }}>{inicial}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: C.tinta, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
          {nombre} {vivo(true)}
        </div>
        <div key={que} className="aparece" style={{ color: C.sub, fontSize: 13, marginTop: 2 }}>{que}</div>
      </div>
      {derecha}
    </div>
  );
  return (
    <div style={{ ...caja, padding: '6px 18px' }}>
      <div style={{ color: C.apagado, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', padding: '10px 0 2px' }}>Entrenando contigo</div>
      {fila(
        'L',
        'lucia',
        `Sentadilla · serie ${serieLucia} de 4`,
        descansa ? (
          <span style={{ textAlign: 'right' }}>
            <span style={{ display: 'block', color: C.tinta, fontSize: 17, fontVariantNumeric: 'tabular-nums' }}>
              {Math.floor(falta / 60)}:{String(falta % 60).padStart(2, '0')}
            </span>
            <span style={{ color: C.sub, fontSize: 11 }}>descanso</span>
          </span>
        ) : (
          <span className="aparece" style={{ color: C.claro, fontSize: 13 }}>
            haciendo la serie
          </span>
        )
      )}
      <div style={{ height: 1, background: C.linea }} />
      {fila('M', 'mateo', 'Remo con barra · serie 1 de 3', <span style={{ color: C.sub, fontSize: 13 }}>{mateoDescansa ? 'descansa' : 'ahora'}</span>)}
    </div>
  );
}

const GENTE = [
  { n: 'lucia', racha: 63 },
  { n: 'mateo', racha: 38 },
  { n: 'sofi', racha: 37 },
  { n: 'nico', racha: 21 },
  { n: 'vale', racha: 9 },
];

/**
 * EL RANKING: las insignias de cada racha flotando detrás (como el campo estelar de
 * Ranking), la lista, y sofi que pasa a mateo. Después la lista sube, una luz baja
 * desde las insignias y se abre en «Crear cuenta».
 */
function PantallaRanking({ t, alCrear }: { t: number; alCrear?: () => void }) {
  const paso = t < 0.4 ? 0 : t < 2.6 ? 1 : t < 4.6 ? 2 : t < 5.6 ? 3 : 4;
  const sofiPasa = paso >= 2;
  const filas = GENTE.map((g) => (g.n === 'sofi' && sofiPasa ? { ...g, racha: 39 } : g)).sort((a, b) => b.racha - a.racha);
  const lugar = (n: string) => filas.findIndex((f) => f.n === n);
  const ALTO_FILA = 52;
  return (
    <>
      {/* Las insignias grandes, detrás: cada uno es lo que su racha formó. */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: paso >= 3 ? 0.35 : 0.9, transition: 'opacity 1.2s ease' }}>
        {GENTE.map((g, i) => {
          const pos = [
            { x: 78, y: 7 },
            { x: 16, y: 8 },
            { x: 84, y: 66 },
            { x: 18, y: 72 },
            { x: 58, y: 79 },
          ][i];
          const tam = 16 + (g.racha / 63) * 22;
          return (
            <span key={g.n} className="flota-insignia" style={{ position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%,-50%)', animationDelay: `${i * -1.3}s`, filter: `drop-shadow(0 0 ${8 + tam / 6}px rgba(196,194,186,.35))` }}>
              <Insignia rango={numeroDeRango(g.racha)} tam={tam} />
            </span>
          );
        })}
      </div>
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 28px', gap: 30, transform: paso >= 3 ? 'translateY(-36px)' : 'none', transition: 'transform 1s cubic-bezier(.2,.7,.2,1)' }}>
        <div style={{ ...caja, background: 'rgba(11,13,19,0.9)', padding: '6px 18px', position: 'relative', height: ALTO_FILA * GENTE.length + 12, opacity: paso >= 1 ? 1 : 0, transition: 'opacity .7s ease' }}>
          {GENTE.map((g) => {
            const f = filas.find((x) => x.n === g.n)!;
            const i = lugar(g.n);
            return (
              <div key={g.n} style={{ position: 'absolute', left: 18, right: 18, top: 6 + i * ALTO_FILA, height: ALTO_FILA, display: 'flex', alignItems: 'center', gap: 12, transition: 'top .8s cubic-bezier(.2,.7,.2,1)', borderTop: i ? `1px solid ${C.linea}` : 'none' }}>
                <span style={{ width: 16, color: C.sub, fontSize: 14 }}>{i + 1}</span>
                <span style={{ width: 32, height: 32, borderRadius: 16, border: `1px solid ${C.lineaFuerte}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.tinta, fontSize: 13 }}>{g.n[0].toUpperCase()}</span>
                <span style={{ flex: 1, color: C.tinta, fontSize: 15 }}>{g.n}</span>
                <Insignia rango={numeroDeRango(f.racha)} tam={20} />
                <span style={{ width: 28, textAlign: 'right', color: g.n === 'sofi' && sofiPasa ? C.tinta : C.claro, fontSize: 17, fontVariantNumeric: 'tabular-nums' }}>{f.racha}</span>
              </div>
            );
          })}
        </div>
        <div>
          <h1 style={titulo}>{TEXTO.ranking.titulo}</h1>
        </div>
      </div>
      {/* La luz que baja desde las insignias y se vuelve el botón. */}
      <div aria-hidden className={paso >= 3 ? 'luz-baja' : ''} style={{ position: 'absolute', left: '50%', top: '64%', width: 2, height: 0, marginLeft: -1, opacity: 0, background: `linear-gradient(to bottom, transparent, ${C.claro})` }} />
      <div style={{ position: 'relative', padding: '0 28px 34px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 112 }}>
        <button
          onClick={alCrear}
          style={{
            width: paso >= 4 ? '100%' : 12,
            height: paso >= 4 ? 52 : 12,
            borderRadius: paso >= 4 ? 2 : 6,
            border: 'none',
            background: C.tinta,
            color: C.fondo,
            fontSize: 16,
            fontWeight: 600,
            fontFamily: FUENTE,
            opacity: paso >= 3 ? 1 : 0,
            boxShadow: paso >= 3 ? `0 0 ${paso >= 4 ? 30 : 18}px rgba(232,236,246,.35)` : 'none',
            transition: 'width .7s cubic-bezier(.2,.7,.2,1), height .5s cubic-bezier(.2,.7,.2,1), border-radius .5s, opacity .4s, box-shadow 1.2s',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
        >
          <span style={{ opacity: paso >= 4 ? 1 : 0, transition: 'opacity .4s ease .45s' }}>Crear cuenta</span>
        </button>
        <div style={{ color: C.sub, fontSize: 15, padding: '14px 0 0', opacity: paso >= 4 ? 1 : 0, transition: 'opacity .5s ease .8s' }}>Ya tengo cuenta</div>
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
      onClick={() => listo && alPasar()}
      aria-label="Siguiente"
      disabled={!listo}
      style={{ position: 'relative', width: 58, height: 58, borderRadius: 29, border: 'none', background: 'transparent', padding: 0, cursor: listo ? 'pointer' : 'default' }}
    >
      <svg width="58" height="58" viewBox="0 0 58 58" style={{ position: 'absolute', inset: 0 }}>
        <circle cx="29" cy="29" r={R} fill="none" stroke={C.lineaFuerte} strokeWidth="1.5" />
        <circle
          key={clave}
          className="carga-circulito"
          cx="29"
          cy="29"
          r={R}
          fill={listo ? 'rgba(232,236,246,.08)' : 'none'}
          stroke={C.tinta}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray={L}
          style={{ ['--largo' as string]: `${L}px`, animationDuration: `${CARGA_MS}ms`, transform: 'rotate(-90deg)', transformOrigin: '29px 29px', transition: 'fill .3s' }}
        />
      </svg>
      <svg width="58" height="58" viewBox="0 0 58 58" style={{ position: 'absolute', inset: 0, opacity: listo ? 1 : 0.25, transition: 'opacity .3s' }}>
        <path d="M25 21l8 8-8 8" fill="none" stroke={C.tinta} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** Una pantalla entera, la que se ve en el teléfono. `?marco=<clave>` la muestra sola. */
function Pantalla({ inicial }: { inicial: Clave }) {
  const [clave, setClave] = useState<Clave>(inicial);
  const [vuelta, setVuelta] = useState(0);
  const t = useReloj(`${clave}-${vuelta}`);
  const indice = PANTALLAS.indexOf(clave);
  const ultima = clave === 'ranking';
  // En la galería, la última se repite sola para poder mirarla de nuevo.
  useEffect(() => {
    if (!ultima) return;
    const id = setTimeout(() => setVuelta((v) => v + 1), 11000);
    return () => clearTimeout(id);
  }, [ultima, vuelta]);
  const texto = TEXTO[clave];
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', fontFamily: FUENTE, overflow: 'hidden' }}>
      <FondoEspacial rango={1} soloEstrellas velo={0.5} />
      {clave === 'amigo' && <Objetos escala={0.6} />}
      {ultima ? (
        <PantallaRanking key={vuelta} t={t} alCrear={() => setClave(inicial)} />
      ) : (
        <>
          <div key={clave} className="entra-pantalla" style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 28px', gap: 34 }}>
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
              {PANTALLAS.map((p, i) => (
                <span key={p} style={{ width: 6, height: 6, borderRadius: 3, background: i === indice ? C.tinta : C.apagado }} />
              ))}
            </div>
            <Circulito clave={clave} alPasar={() => setClave(PANTALLAS[indice + 1])} />
          </div>
        </>
      )}
      <style>{`
        .carga-circulito { animation-name: carga; animation-timing-function: linear; animation-fill-mode: both; }
        @keyframes carga { from { stroke-dashoffset: var(--largo); } to { stroke-dashoffset: 0; } }
        .entra-pantalla { animation: entra .5s cubic-bezier(.2,.7,.2,1) both; }
        @keyframes entra { from { opacity: 0; transform: translateX(18px); } to { opacity: 1; transform: none; } }
        .aparece { animation: aparece .45s ease both; }
        @keyframes aparece { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
        .latido-vivo { animation: latido 1.8s ease-out infinite; }
        @keyframes latido { from { opacity: .7; transform: scale(.6); } to { opacity: 0; transform: scale(1.5); } }
        .flota-insignia { animation: flota 7s ease-in-out infinite; will-change: transform; }
        @keyframes flota { 0%,100% { transform: translate(-50%,-50%) translate3d(0,0,0); } 50% { transform: translate(-50%,-50%) translate3d(0,-8px,0); } }
        .luz-baja { animation: baja 1s cubic-bezier(.5,0,.3,1) forwards; }
        @keyframes baja { 0% { opacity: 0; height: 0; } 30% { opacity: .9; } 100% { opacity: 0; height: 21%; } }
      `}</style>
    </div>
  );
}

// ── LOS GLOBITOS DE ADENTRO ──

// GLOBOS DE CÓMIC (15/10, segunda vuelta): cada uno debajo del elemento del que habla,
// con la colita saliendo de él. Las posiciones salen de `cajas.json` (dónde quedó cada
// cosa en la captura); los números de respaldo son los de esas mismas capturas.
type GloboReal = { captura: string; rotulo: string; texto: string; arriba: number; colaX: number; alinear: 'centro' | 'izquierda' | 'derecha'; margen?: number; compacto?: boolean; nota: string };
const caj = (c: string, k: string) => cajas[c]?.[k] ?? null;
const masSerie = caj('serie', 'mas') ?? { x: 117, y: 545, w: 250, h: 75 };
const fotoAlbum = caj('album-fotos', 'foto') ?? { x: 24, y: 137, w: 111, h: 111 };
const GLOBOS: GloboReal[] = [
  { captura: 'elegir', rotulo: '1 · Donde eliges el ejercicio', texto: 'Busca el ejercicio o elígelo de la lista.', arriba: 273, colaX: 90, alinear: 'izquierda', margen: 22, nota: 'Igual que antes, ahora saliendo del buscador.' },
  { captura: 'serie', rotulo: '2 · El + que suma la serie', texto: 'Toca + al terminar cada serie.', arriba: masSerie.y + masSerie.h + 7, colaX: masSerie.x + masSerie.w / 2, alinear: 'centro', compacto: true, nota: 'Sale del +, por debajo: ya no tapa el ejercicio. Se va con el primer +.' },
  { captura: 'descanso', rotulo: '3 · El descanso', texto: 'Tu descanso. Tócalo para cambiarlo.', arriba: 112, colaX: 341, alinear: 'derecha', nota: 'Sale del reloj del descanso, arriba a la derecha. La primera vez que aparece.' },
  { captura: 'ranking-vacio', rotulo: '4 · Agregar amigos', texto: 'Agrega amigos para seguir su progreso.', arriba: 155, colaX: 90, alinear: 'izquierda', nota: 'Sale del buscador de gente, que es donde se agregan. La primera vez que se abre Ranking.' },
  { captura: 'album-fotos', rotulo: '5 · Álbum', texto: 'Aquí se ven las fotos de tu progreso.', arriba: fotoAlbum.y + fotoAlbum.h + 14, colaX: 195, alinear: 'centro', nota: 'En el medio y apuntando a las fotos. La primera vez que se abre el Álbum con alguna foto.' },
  { captura: 'rutina-editando', rotulo: '6 · Donde se edita la rutina', texto: 'Crea tu rutina', arriba: 194, colaX: 240, alinear: 'centro', margen: 20, nota: 'Sale del nombre del entrenamiento («Entrenamiento 1» por defecto). La primera vez que se toca «Editar».' },
];

export default function PropuestaBienvenida() {
  // `undefined` = todavía no se leyó la dirección. Sin esperar, cada iframe dibujaba
  // la página entera con sus iframes adentro, y así sin fin.
  const [marco, setMarco] = useState<string | null | undefined>(undefined);
  const [ver, setVer] = useState<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setMarco(q.get('marco'));
    setVer(q.get('ver'));
  }, []);

  if (marco === undefined) return null;
  if (marco && (PANTALLAS as readonly string[]).includes(marco)) return <Pantalla inicial={marco as Clave} />;

  if (ver && (PANTALLAS as readonly string[]).includes(ver)) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <Link href="/galeria/propuestas/bienvenida" style={{ color: C.sub, fontSize: 13 }}>
          ← La bienvenida · se pasa con el circulito, como en el teléfono
        </Link>
        <iframe title={ver} src={`/galeria/propuestas/bienvenida?marco=${ver}`} style={{ width: 390, height: 844, maxHeight: 'calc(100vh - 60px)', border: `1px solid ${C.lineaFuerte}`, borderRadius: 28 }} />
      </div>
    );
  }

  return (
    <Banco
      titulo="La bienvenida nueva"
      queEs="A tamaño real (390 × 844, un iPhone). Las cuatro de antes de la cuenta están vivas: el circulito carga y deja pasar, y tocar el rótulo abre una sola en grande. Son reconstrucciones con las medidas de la app sobre el cielo del motor; los globitos, en cambio, van sobre capturas reales."
    >
      <div style={{ maxWidth: 760, color: 'var(--sub)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
        <p style={{ margin: '0 0 10px' }}>
          <b style={{ color: 'var(--tinta)' }}>Cambios de esta vuelta:</b> los textos que pediste (en tú, como el resto de la app: «Anota», «Entrena», «Mira»), una cuarta pantalla del ranking que termina en crear la cuenta, sin «Saltar» —un circulito que carga 1,5 s—, y de fondo el espacio de la app —el motor con sus estrellas y sus fugaces, sin el polvo—, en vez del cielo plano. Los objetos de atrás, más chicos y en su propia capa para que se muevan sin saltos. La animación de los ocho objetos ya no va: el final es el ranking.
        </p>
      </div>

      <Titulito>Antes de la cuenta</Titulito>
      <Fila>
        {PANTALLAS.map((p) => (
          <Marco key={p} rotulo={<Link href={`/galeria/propuestas/bienvenida?ver=${p}`}>{`Pantalla ${PANTALLAS.indexOf(p) + 1} · ver sola →`}</Link>} nota={NOTA[p]}>
            <iframe title={p} src={`/galeria/propuestas/bienvenida?marco=${p}`} style={{ width: 390, height: 844, border: 0, display: 'block' }} />
          </Marco>
        ))}
      </Fila>

      <Titulito>Los globitos de adentro: estos seis y ninguno más</Titulito>
      <p className="nota-privada" style={{ margin: '-4px 0 16px', lineHeight: 1.5, maxWidth: 760 }}>
        Fondo: capturas de la app nativa corriendo en el navegador, con una cuenta recién creada (el mismo código que el teléfono, no el iPhone). Lo único dibujado es el globo: el de la app, del ancho de su texto, con una colita que sale de lo que explica. Cada uno sale una vez y se va con un toque.
      </p>
      <Fila>
        {GLOBOS.map((g) => (
          <Marco key={g.captura} rotulo={g.rotulo} nota={g.nota}>
            <Captura nombre={g.captura}>
              <GloboComic texto={g.texto} arriba={g.arriba} colaX={g.colaX} alinear={g.alinear} margen={g.margen} compacto={g.compacto} />
            </Captura>
          </Marco>
        ))}
      </Fila>
      <div style={{ maxWidth: 760, color: 'var(--sub)', fontSize: 14, lineHeight: 1.6 }}>
        <p style={{ margin: '0 0 10px' }}>
          <b style={{ color: 'var(--tinta)' }}>7 · Ajustes:</b> ninguno.
        </p>
        <p style={{ margin: 0 }}>
          <b style={{ color: 'var(--tinta)' }}>Lo que hoy existe y se va:</b> el recorrido de seis pasos después del nombre, el globito del perfil («Se elige en el Álbum.») y el de quién está entrenando en Ranking («Aquí ves quién está entrenando ahora.»). Queda una duda: el aviso «ya puedes subir» del bloque no es de la primera vez —sale cada vez que te toca subir de peso—; no lo cuento entre los globitos, pero si lo querés afuera también, se saca.
        </p>
      </div>
    </Banco>
  );
}
