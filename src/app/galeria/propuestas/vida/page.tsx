'use client';

// Propuesta (18/10): la vida dibujada como un destello de cuatro puntas, y tres maneras de
// animarla —titilar, volar al día que faltaste, congelar la racha—. Todo dibujado acá, en
// SVG y CSS: no existe en la app, así que no hay captura de la que partir.
//
// A diferencia de las otras propuestas, las tarjetas no tienen el ancho fijo de un teléfono
// (390): se ven en el teléfono mismo, y ahí ese ancho dejaba scroll de costado.

import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode } from 'react';
import { Banco } from '../Banco';
import { C, FUENTE } from '../Captura';

// Rombo alargado con los lados curvos hacia adentro: cada lado es una curva con los puntos
// de control cerca del centro. Más alto que ancho, como el destello de una estrella fugaz.
const PUNTAS = 'M0,-48 C3,-15 9,-6 27,0 C9,6 3,15 0,48 C-3,15 -9,6 -27,0 C-9,-6 -3,-15 0,-48 Z';
const LLENO = '#7e8ca8';
const HIELO = '#8fc4f0';

function Definiciones() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <radialGradient id="vida-luz" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="#f1eee6" />
          <stop offset="100%" stopColor={C.claro} />
        </radialGradient>
        <linearGradient id="vida-hielo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor={HIELO} />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Vida({ tam = 28, apagada = false, hielo = false, className, style }: { tam?: number; apagada?: boolean; hielo?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="-50 -50 100 100" width={tam} height={tam} className={className} style={{ display: 'block', overflow: 'visible', ...style }} aria-hidden>
      {apagada ? (
        <path d={PUNTAS} fill="none" stroke={C.apagado} strokeWidth={4} strokeLinejoin="round" />
      ) : (
        <path d={PUNTAS} fill={hielo ? 'url(#vida-hielo)' : 'url(#vida-luz)'} />
      )}
    </svg>
  );
}

// ---- piezas comunes ----

function Pasos({ filas }: { filas: [string, string][] }) {
  return (
    <table className="vida-pasos">
      <tbody>
        {filas.map(([que, ms]) => (
          <tr key={que}>
            <td>{que}</td>
            <td>{ms}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Tarjeta({ rotulo, alRepetir, pie, children }: { rotulo: string; alRepetir?: () => void; pie?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ width: '100%', maxWidth: 390, marginBottom: 26 }}>
      <div className="vida-rotulo">{rotulo}</div>
      <div className="vida-tarjeta">
        {alRepetir && (
          <button className="vida-repetir" onClick={alRepetir}>
            repetir
          </button>
        )}
        {children}
      </div>
      {pie}
    </section>
  );
}

const LETRAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const FALTADO = 4;
const HOY = 5;

/** La tira de la semana, como la de Inicio: el viernes faltaste y hoy es sábado. */
function Semana({ cubierto, brillo, refDia }: { cubierto: boolean; brillo?: boolean; refDia?: (n: HTMLDivElement | null) => void }) {
  return (
    <div className="vida-semana">
      {LETRAS.map((l, i) => (
        <div key={l} className="vida-dia">
          <div
            ref={i === FALTADO ? refDia : undefined}
            className="vida-punto"
            style={{
              background: i < FALTADO ? LLENO : 'transparent',
              border: i === HOY ? `1px solid ${C.claro}` : i === FALTADO && cubierto ? `1px solid ${C.claro}` : i > HOY ? '1px solid #171c26' : i === FALTADO ? '1px solid #2a3040' : 'none',
            }}
          >
            {i === FALTADO && cubierto && <Vida tam={13} className="vida-marca" />}
            {i === FALTADO && brillo && <span className="vida-estallido" />}
          </div>
          <span className="vida-letra">{l}</span>
        </div>
      ))}
    </div>
  );
}

type Punto = { x: number; y: number };
const centro = (n: Element, base: DOMRect): Punto => {
  const r = n.getBoundingClientRect();
  return { x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height / 2 };
};
const suave = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * EL VUELO: se desprende (sube un poco y crece) y viaja por un arco hasta `b`. La estela son
 * copias del mismo destello, cada una un poco atrás y más tenue: una estrella fugaz.
 */
function volar(piezas: HTMLElement[], tam: number, a: Punto, b: Punto, despegue: number, vuelo: number, escalaFinal: number) {
  const total = despegue + vuelo;
  const arriba = { x: a.x, y: a.y - 8 };
  const control = { x: (arriba.x + b.x) / 2, y: Math.min(arriba.y, b.y) - 80 };
  const pos = (p: Punto, s: number) => `translate(${p.x - tam / 2}px, ${p.y - tam / 2}px) scale(${s})`;
  const cuadros: Keyframe[] = [
    { offset: 0, transform: pos(a, 1) },
    { offset: despegue / total, transform: pos(arriba, 1.35) },
  ];
  for (let i = 1; i <= 24; i++) {
    const t = suave(i / 24);
    const p = {
      x: (1 - t) * (1 - t) * arriba.x + 2 * (1 - t) * t * control.x + t * t * b.x,
      y: (1 - t) * (1 - t) * arriba.y + 2 * (1 - t) * t * control.y + t * t * b.y,
    };
    cuadros.push({ offset: (despegue + (vuelo * i) / 24) / total, transform: pos(p, 1.35 + (escalaFinal - 1.35) * t) });
  }
  const anims = piezas.map((n, k) => {
    const opacidad = k === 0 ? 1 : 0.5 / k;
    return n.animate(
      cuadros.map((c, i) => ({ ...c, opacity: k === 0 ? 1 : i === cuadros.length - 1 ? 0 : opacidad })),
      { duration: total, delay: k * 45, fill: 'forwards', easing: 'linear' }
    );
  });
  // Lo que sigue arranca cuando llega el destello, no cuando termina la estela (va atrás).
  return anims[0].finished.then(() => {}, () => {});
}

function Volador({ refs, tam }: { refs: MutableRefObject<HTMLDivElement[]>; tam: number }) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((k) => (
        <div
          key={k}
          ref={(n) => {
            if (n) refs.current[k] = n;
          }}
          className="vida-volador"
          style={{ width: tam, height: tam, zIndex: 10 - k }}
        >
          <Vida tam={tam} className={k === 0 ? 'vida-brilla' : undefined} style={k === 0 ? undefined : { transform: `scale(${1 - k * 0.14})` }} />
        </div>
      ))}
    </>
  );
}

function FilaDeVidas({ usada, ocultar, refRanura, tam = 26, titilan = false }: { usada: boolean; ocultar?: boolean; refRanura?: (n: HTMLDivElement | null) => void; tam?: number; titilan?: boolean }) {
  return (
    <div className="vida-fila">
      <span className="vida-etiqueta">Vidas</span>
      {[0, 1, 2].map((i) => (
        <div key={i} ref={i === 2 ? refRanura : undefined} style={{ width: tam, height: tam, position: 'relative' }}>
          {i === 2 && usada ? (
            <Vida tam={tam} apagada className="vida-se-apaga" />
          ) : (
            <Vida tam={tam} className={titilan ? 'vida-titila vida-brilla' : 'vida-brilla'} style={{ animationDelay: `${i * 800}ms`, visibility: i === 2 && ocultar ? 'hidden' : 'visible' }} />
          )}
        </div>
      ))}
      <span className="vida-quedan">{usada ? 'Te quedan 2.' : 'Te quedan 3.'}</span>
    </div>
  );
}

// ---- a. titileo ----

function Titileo() {
  const [n, setN] = useState(0);
  return (
    <>
      <Tarjeta rotulo="a · Titileo, de cerca" alRepetir={() => setN((x) => x + 1)}>
        <div key={n} className="vida-escena" style={{ display: 'flex', justifyContent: 'center', gap: 34, padding: '56px 0' }}>
          {[0, 1, 2].map((i) => (
            <Vida key={i} tam={52} apagada={i === 2} className={i < 2 ? 'vida-titila vida-brilla' : undefined} style={{ animationDelay: `${i * 800}ms` }} />
          ))}
        </div>
      </Tarjeta>
      <Tarjeta
        rotulo="a · Titileo, a tamaño real (26 px), en Inicio"
        pie={
          <Pasos
            filas={[
              ['Un ciclo de cada vida (sube y baja)', '2400 ms'],
              ['Desfase entre una vida y la siguiente', '800 ms'],
              ['Tamaño', '1 → 1,08'],
              ['Brillo', '82 % → 100 %, con el halo más ancho'],
              ['La usada', 'solo el contorno, quieta'],
            ]}
          />
        }
      >
        <div key={n} className="vida-escena">
          <div className="vida-numero-chico">24</div>
          <FilaDeVidas usada titilan />
        </div>
      </Tarjeta>
    </>
  );
}

// ---- b. usar vida: vuela al día faltado ----

const T_DESPEGUE = 240;
const T_VUELO = 720;
const T_LLEGADA = 380;

function UsarVida() {
  const escena = useRef<HTMLDivElement>(null);
  const ranura = useRef<HTMLDivElement | null>(null);
  const dia = useRef<HTMLDivElement | null>(null);
  const voladores = useRef<HTMLDivElement[]>([]);
  const [fase, setFase] = useState<'antes' | 'vuela' | 'llego' | 'despues'>('antes');
  // Se vuelve a prender al montar: en desarrollo React monta, desmonta y monta otra vez.
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  async function usar() {
    if (fase !== 'antes' || !escena.current || !ranura.current || !dia.current) return;
    const base = escena.current.getBoundingClientRect();
    const a = centro(ranura.current, base);
    const b = centro(dia.current, base);
    setFase('vuela');
    await volar(voladores.current, 26, a, b, T_DESPEGUE, T_VUELO, 0.55);
    if (!vivo.current) return;
    voladores.current.forEach((v) => v.getAnimations().forEach((x) => x.cancel()));
    setFase('llego');
    setTimeout(() => vivo.current && setFase('despues'), T_LLEGADA);
  }

  function repetir() {
    voladores.current.forEach((v) => v.getAnimations().forEach((x) => x.cancel()));
    setFase('antes');
    setTimeout(() => document.getElementById('vida-usar')?.click(), 450);
  }

  return (
    <>
      <Tarjeta
        rotulo="b · Usar vida"
        alRepetir={repetir}
        pie={
          <Pasos
            filas={[
              ['1. Se desprende de la fila: sube 8 px y crece a 1,35', `${T_DESPEGUE} ms`],
              ['   y su lugar en la fila queda en contorno', '240 ms'],
              ['2. Vuela en arco hasta el viernes, con estela (4 copias, 45 ms entre cada una)', `${T_VUELO} ms`],
              ['3. Llega: un anillo de luz sale del día', `${T_LLEGADA} ms`],
              ['4. El día queda con el destello chico adentro y el borde claro', '240 ms'],
              ['Total', `${T_DESPEGUE + T_VUELO + T_LLEGADA} ms`],
            ]}
          />
        }
      >
        <div ref={escena} className="vida-escena" style={{ position: 'relative' }}>
          <div className="vida-numero-chico">24</div>
          <FilaDeVidas usada={fase !== 'antes'} ocultar={fase !== 'antes'} refRanura={(n) => (ranura.current = n)} />
          <Semana cubierto={fase === 'llego' || fase === 'despues'} brillo={fase === 'llego'} refDia={(n) => (dia.current = n)} />
          <div style={{ display: 'flex', gap: 10, marginTop: 26 }}>
            <button id="vida-usar" className="vida-boton" onClick={() => void usar()} disabled={fase !== 'antes'}>
              Usar vida
            </button>
          </div>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', visibility: fase === 'vuela' ? 'visible' : 'hidden' }}>
            <Volador refs={voladores} tam={26} />
          </div>
        </div>
      </Tarjeta>
      <div className="vida-par">
        <Tarjeta rotulo="Antes">
          <div className="vida-escena vida-quieta">
            <FilaDeVidas usada={false} tam={20} />
            <Semana cubierto={false} />
          </div>
        </Tarjeta>
        <Tarjeta rotulo="Después">
          <div className="vida-escena vida-quieta">
            <FilaDeVidas usada tam={20} />
            <Semana cubierto />
          </div>
        </Tarjeta>
      </div>
    </>
  );
}

// ---- c. racha congelada ----

const T_C_DESPEGUE = 240;
const T_C_VUELO = 620;
const T_HIELA = 700;
const T_CRISTALES = 360;
const T_DESTELLO = 520;
const T_DERRITE = 1100;

const CRISTALES: { x: number; y: number; r: number; s: number }[] = [
  { x: 6, y: 18, r: -25, s: 0.9 },
  { x: 92, y: 12, r: 20, s: 1 },
  { x: 100, y: 58, r: 70, s: 0.7 },
  { x: 2, y: 66, r: -70, s: 0.75 },
  { x: 30, y: -2, r: 5, s: 0.6 },
  { x: 70, y: 96, r: 160, s: 0.65 },
  { x: 24, y: 94, r: 200, s: 0.55 },
  { x: 78, y: -4, r: -10, s: 0.55 },
];

function Congelada() {
  const escena = useRef<HTMLDivElement>(null);
  const ranura = useRef<HTMLDivElement | null>(null);
  const numero = useRef<HTMLDivElement>(null);
  const voladores = useRef<HTMLDivElement[]>([]);
  const [fase, setFase] = useState<'antes' | 'vuela' | 'hiela' | 'congelada' | 'derrite' | 'sigue'>('antes');
  // Se vuelve a prender al montar: en desarrollo React monta, desmonta y monta otra vez.
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);
  const despues = (ms: number, f: typeof fase) => setTimeout(() => vivo.current && setFase(f), ms);

  async function usar() {
    if (fase !== 'antes' || !escena.current || !ranura.current || !numero.current) return;
    const base = escena.current.getBoundingClientRect();
    setFase('vuela');
    await volar(voladores.current, 26, centro(ranura.current, base), centro(numero.current, base), T_C_DESPEGUE, T_C_VUELO, 1.8);
    if (!vivo.current) return;
    voladores.current.forEach((v) => v.getAnimations().forEach((x) => x.cancel()));
    setFase('hiela');
    despues(T_HIELA + 7 * 50 + T_CRISTALES + T_DESTELLO, 'congelada');
  }

  function derretir() {
    if (fase !== 'congelada') return;
    setFase('derrite');
    despues(T_DERRITE, 'sigue');
  }

  function repetir() {
    voladores.current.forEach((v) => v.getAnimations().forEach((x) => x.cancel()));
    setFase('antes');
    setTimeout(() => document.getElementById('vida-congelar')?.click(), 450);
  }

  const helada = fase === 'hiela' || fase === 'congelada' || fase === 'derrite';
  return (
    <Tarjeta
      rotulo="c · Racha congelada"
      alRepetir={repetir}
      pie={
        <>
          <Pasos
            filas={[
              ['1. La vida se desprende', `${T_C_DESPEGUE} ms`],
              ['2. Vuela hasta el número de la racha', `${T_C_VUELO} ms`],
              ['3. El hielo se extiende desde el centro del número', `${T_HIELA} ms`],
              ['4. Cristales alrededor: 8, de a uno cada 50 ms, desde los 420 ms del hielo', `${T_CRISTALES} ms cada uno`],
              ['5. Un brillo cruza el número helado', `${T_DESTELLO} ms`],
              ['Total hasta quedar congelada', `${T_C_DESPEGUE + T_C_VUELO + T_HIELA + 7 * 50 + T_CRISTALES + T_DESTELLO} ms`],
              ['Al día siguiente, «Derretir»: gotas, el hielo baja y se va', `${T_DERRITE} ms`],
            ]}
          />
          <p className="vida-nota">
            Duolingo, de memoria y sin verificar: cuando un «congelador de racha» cubre un día que faltaste, la llama de la racha se ve azul hielo y ese día
            queda marcado en el calendario. Aquí no hay llama: se congela el número, con hielo y cristales propios.
          </p>
        </>
      }
    >
      <div ref={escena} className="vida-escena" style={{ position: 'relative', textAlign: 'center' }}>
        <div ref={numero} className={`vida-racha ${fase === 'derrite' ? 'vida-derrite' : ''}`}>
          <span className="vida-numero" style={{ color: helada ? '#dcecfb' : C.tinta, transition: `color ${T_HIELA}ms ease` }}>
            24
          </span>
          {helada && (
            <span className="vida-numero vida-capa-hielo" aria-hidden>
              24
            </span>
          )}
          {helada && fase !== 'derrite' && (
            <span className="vida-numero vida-destello" style={{ animationDelay: `${T_HIELA + 7 * 50 + T_CRISTALES}ms` }} aria-hidden>
              24
            </span>
          )}
          {helada &&
            CRISTALES.map((c, i) => (
              <span
                key={i}
                className={fase === 'derrite' ? 'vida-cristal vida-cristal-se-va' : 'vida-cristal'}
                style={{ left: `${c.x}%`, top: `${c.y}%`, ['--giro' as string]: `${c.r}deg`, ['--tam' as string]: c.s, animationDelay: fase === 'derrite' ? `${i * 40}ms` : `${T_HIELA * 0.6 + i * 50}ms` }}
              >
                <Vida tam={16} hielo />
              </span>
            ))}
          {fase === 'derrite' &&
            [18, 38, 55, 72, 86].map((x, i) => (
              <span key={x} className="vida-gota" style={{ left: `${x}%`, animationDelay: `${i * 90}ms` }} />
            ))}
        </div>
        <div className="vida-dias">días</div>
        <div className="vida-estado" style={{ opacity: fase === 'congelada' ? 1 : 0 }}>
          Racha congelada
        </div>
        <FilaDeVidas usada={fase !== 'antes'} ocultar={fase !== 'antes'} refRanura={(n) => (ranura.current = n)} />
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button id="vida-congelar" className="vida-boton" onClick={() => void usar()} disabled={fase !== 'antes'}>
            Usar vida
          </button>
          <button className="vida-boton vida-boton-borde" onClick={derretir} disabled={fase !== 'congelada'}>
            Al día siguiente: derretir
          </button>
        </div>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', visibility: fase === 'vuela' ? 'visible' : 'hidden' }}>
          <Volador refs={voladores} tam={26} />
        </div>
      </div>
    </Tarjeta>
  );
}

// ---- la página ----

const PESTANAS = [
  { id: 'titileo', nombre: 'a · Titileo' },
  { id: 'usar', nombre: 'b · Usar vida' },
  { id: 'congelada', nombre: 'c · Racha congelada' },
] as const;

export default function PropuestaVida() {
  const [pestana, setPestana] = useState<(typeof PESTANAS)[number]['id']>('titileo');
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('p');
    if (p === 'usar' || p === 'congelada' || p === 'titileo') setPestana(p);
  }, []);

  return (
    <Banco
      titulo="La vida: un destello, y tres maneras de usarla"
      queEs="Dibujada en SVG: un rombo alargado con los lados curvos hacia adentro, como el destello de una estrella fugaz. Cada pestaña es una propuesta y se repite con «repetir»; abajo de cada una, cuánto dura cada paso."
    >
      <Definiciones />
      <style>{ESTILOS}</style>
      <Tarjeta rotulo="1 · La vida">
        <div className="vida-escena" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 'clamp(14px, 5vw, 30px)', padding: '40px 0 30px' }}>
          {[96, 52, 26, 16].map((t) => (
            <div key={t} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <Vida tam={t} className="vida-brilla" />
              <span className="vida-letra">{t} px</span>
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Vida tam={26} apagada />
            <span className="vida-letra">usada</span>
          </div>
        </div>
      </Tarjeta>

      <div className="vida-pestanas" role="tablist">
        {PESTANAS.map((p) => (
          <button key={p.id} role="tab" aria-selected={pestana === p.id} className={pestana === p.id ? 'vida-pestana vida-pestana-activa' : 'vida-pestana'} onClick={() => setPestana(p.id)}>
            {p.nombre}
          </button>
        ))}
      </div>
      {pestana === 'titileo' && <Titileo />}
      {pestana === 'usar' && <UsarVida />}
      {pestana === 'congelada' && <Congelada />}
    </Banco>
  );
}

const ESTILOS = `
  .vida-rotulo { font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: var(--sub); margin-bottom: 8px; }
  .vida-tarjeta { position: relative; border: 1px solid ${C.linea}; border-radius: 22px; background: ${C.fondo}; overflow: hidden; }
  .vida-repetir { position: absolute; right: 12px; top: 12px; z-index: 20; background: rgba(0,0,0,.6); color: ${C.sub}; border: 1px solid ${C.lineaFuerte}; border-radius: 999px; padding: 5px 12px; font-size: 12px; font-family: ${FUENTE}; cursor: pointer; }
  .vida-escena { padding: 30px 22px 26px; font-family: ${FUENTE}; }
  .vida-quieta { padding: 22px 16px 18px; }
  .vida-par { display: flex; gap: 12px; width: 100%; max-width: 390px; }
  .vida-par > section { flex: 1 1 0; min-width: 0; }
  .vida-par .vida-semana { margin-top: 18px; }
  .vida-par .vida-punto { width: 18px; height: 18px; border-radius: 9px; }
  .vida-par .vida-fila { gap: 6px; }
  .vida-par .vida-etiqueta, .vida-par .vida-quedan { display: none; }
  .vida-pestanas { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 18px; max-width: 390px; }
  .vida-pestana { flex: 1 1 auto; border: 1px solid ${C.lineaFuerte}; background: transparent; color: ${C.sub}; border-radius: 999px; padding: 9px 12px; font-size: 13px; font-family: ${FUENTE}; cursor: pointer; }
  .vida-pestana-activa { color: ${C.tinta}; border-color: ${C.claro}; }
  .vida-pasos { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; color: var(--sub); font-family: ${FUENTE}; }
  .vida-pasos td { padding: 5px 0; border-bottom: 1px solid ${C.linea}; vertical-align: top; white-space: pre-wrap; }
  .vida-pasos td:last-child { text-align: right; padding-left: 12px; white-space: nowrap; color: ${C.tinta}; font-variant-numeric: tabular-nums; }
  .vida-nota { font-size: 12px; line-height: 1.5; color: var(--sub); margin: 10px 0 0; }
  .vida-numero-chico { font-size: 64px; font-weight: 200; color: ${C.tinta}; line-height: 1; margin-bottom: 18px; }
  .vida-fila { display: flex; align-items: center; gap: 10px; }
  .vida-etiqueta { font-size: 10px; letter-spacing: .24em; text-transform: uppercase; color: ${C.sub}; margin-right: 6px; }
  .vida-quedan { font-size: 13px; color: ${C.sub}; margin-left: 4px; }
  .vida-semana { display: flex; justify-content: space-between; margin-top: 30px; }
  .vida-dia { display: flex; flex-direction: column; align-items: center; gap: 7px; }
  .vida-punto { position: relative; width: 26px; height: 26px; border-radius: 13px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
  .vida-letra { font-size: 11px; color: #4a5163; white-space: nowrap; }
  .vida-boton { flex: 1 1 0; background: ${C.claro}; color: ${C.fondo}; border: 0; border-radius: 2px; padding: 14px 10px; font-size: 15px; font-weight: 600; font-family: ${FUENTE}; cursor: pointer; }
  .vida-boton:disabled { opacity: .35; cursor: default; }
  .vida-boton-borde { background: transparent; color: ${C.tinta}; border: 1px solid ${C.lineaFuerte}; font-weight: 400; font-size: 13px; }
  .vida-volador { position: absolute; left: 0; top: 0; will-change: transform; }

  .vida-brilla { filter: drop-shadow(0 0 4px rgba(232,236,246,.45)); }
  .vida-titila { animation: vida-titila 2400ms ease-in-out infinite; transform-origin: center; }
  @keyframes vida-titila {
    0%, 100% { transform: scale(1); opacity: .82; filter: drop-shadow(0 0 3px rgba(232,236,246,.3)); }
    50% { transform: scale(1.08); opacity: 1; filter: drop-shadow(0 0 9px rgba(232,236,246,.8)); }
  }
  .vida-se-apaga { animation: vida-se-apaga 240ms ease both; }
  @keyframes vida-se-apaga { from { opacity: 0; } to { opacity: 1; } }
  .vida-marca { animation: vida-marca 240ms cubic-bezier(.2,.8,.3,1) both; filter: drop-shadow(0 0 3px rgba(232,236,246,.6)); }
  @keyframes vida-marca { from { transform: scale(1.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .vida-estallido { position: absolute; inset: -1px; border-radius: 50%; border: 2px solid ${C.claro}; animation: vida-estallido ${T_LLEGADA}ms ease-out both; }
  @keyframes vida-estallido { from { transform: scale(.6); opacity: 1; } to { transform: scale(2.2); opacity: 0; } }

  .vida-racha { position: relative; display: inline-block; line-height: 1; margin-top: 10px; }
  .vida-numero { display: block; font-size: 112px; font-weight: 200; line-height: 1; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
  .vida-capa-hielo { position: absolute; inset: 0; background: linear-gradient(165deg, #ffffff 0%, #d9eeff 30%, ${HIELO} 62%, #eef8ff 100%); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 0 10px rgba(143,196,240,.45)); animation: vida-hiela ${T_HIELA}ms cubic-bezier(.3,.6,.3,1) both; }
  @keyframes vida-hiela { from { clip-path: circle(0% at 50% 50%); } to { clip-path: circle(75% at 50% 50%); } }
  .vida-destello { position: absolute; inset: 0; background: linear-gradient(110deg, transparent 38%, rgba(255,255,255,.95) 50%, transparent 62%); background-size: 260% 100%; background-position: 130% 0; -webkit-background-clip: text; background-clip: text; color: transparent; animation: vida-destello ${T_DESTELLO}ms ease-in-out both; }
  @keyframes vida-destello { from { background-position: 130% 0; } to { background-position: -30% 0; } }
  .vida-cristal { position: absolute; width: 16px; height: 16px; margin: -8px 0 0 -8px; transform: rotate(var(--giro)) scale(var(--tam)); animation: vida-cristal ${T_CRISTALES}ms cubic-bezier(.2,.9,.3,1.3) both; filter: drop-shadow(0 0 4px rgba(143,196,240,.7)); }
  @keyframes vida-cristal { from { transform: rotate(var(--giro)) scale(0); opacity: 0; } to { transform: rotate(var(--giro)) scale(var(--tam)); opacity: 1; } }
  .vida-cristal-se-va { animation: vida-cristal-se-va 420ms ease-in both; }
  @keyframes vida-cristal-se-va { from { opacity: 1; transform: rotate(var(--giro)) scale(var(--tam)); } to { opacity: 0; transform: rotate(var(--giro)) scale(var(--tam)) translateY(14px); } }
  .vida-derrite .vida-capa-hielo { animation: vida-derrite ${T_DERRITE}ms ease-in both; }
  @keyframes vida-derrite { from { clip-path: inset(0 0 0 0); opacity: 1; transform: none; } 70% { opacity: .7; } to { clip-path: inset(100% 0 0 0); opacity: 0; transform: translateY(10px); } }
  .vida-gota { position: absolute; top: 88%; width: 6px; height: 9px; margin-left: -3px; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; background: linear-gradient(#ffffff, ${HIELO}); animation: vida-gota 700ms ease-in both; }
  @keyframes vida-gota { from { transform: translateY(0) scale(.6); opacity: 0; } 20% { opacity: 1; transform: translateY(2px) scale(1); } to { transform: translateY(46px) scale(.8); opacity: 0; } }
  .vida-dias { font-size: 13px; letter-spacing: .2em; text-transform: uppercase; color: ${C.sub}; margin: 8px 0 4px; }
  .vida-estado { font-size: 13px; color: ${HIELO}; height: 18px; margin-bottom: 18px; transition: opacity 300ms ease; }
  .vida-escena .vida-fila { justify-content: flex-start; }

  @media (prefers-reduced-motion: reduce) { .vida-titila { animation: none; } }
`;
