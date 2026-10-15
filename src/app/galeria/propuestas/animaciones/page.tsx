'use client';

// Propuesta: cinco animaciones, para decir sí o no a cada una (15/10).
//
// Cada una va sobre la captura REAL de la pantalla donde viviría; lo que se mueve son
// los píxeles de la propia captura (recortados en su lugar) o, cuando es algo nuevo
// —el relleno del punto, el destello—, solo eso dibujado. La quinta, subir de rango,
// corre la animación de verdad (`motor/subida`, el mismo archivo que el teléfono) en
// un iframe, la de hoy al lado de la pulida.
//
// Nada en los cambios de pestaña ni en los números: ahí es donde una app se siente lenta.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RANGOS } from '@nucleo/rangos';
import { paletaDe } from '@nucleo/paletas';
import { Banco } from '../Banco';
import { C, Captura, Fila, FUENTE, Marco, Parche, Recorte, Titulito, cajas, type Caja } from '../Captura';

/** Repite una animación: cambia la clave cada `cada` ms (y con el botón). */
function useVuelta(cada: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((x) => x + 1), cada);
    return () => clearInterval(id);
  }, [cada]);
  return [n, () => setN((x) => x + 1)] as const;
}

function Repetir({ alTocar }: { alTocar: () => void }) {
  return (
    <button onClick={alTocar} style={{ position: 'absolute', right: 12, top: 12, zIndex: 5, background: 'rgba(0,0,0,.6)', color: C.sub, border: `1px solid ${C.lineaFuerte}`, borderRadius: 999, padding: '5px 12px', fontSize: 12, fontFamily: FUENTE, cursor: 'pointer' }}>
      repetir
    </button>
  );
}

// 1. El + al terminar una serie: un pulso corto y el punto que se llena.
function Serie() {
  const [n, otra] = useVuelta(2600);
  const mas: Caja = cajas.serie?.mas ?? { x: 117, y: 545, w: 250, h: 75 };
  const punto = { x: 131, y: 520 };
  return (
    <Captura nombre="serie">
      <Recorte key={`m${n}`} nombre="serie" caja={mas} className="pulso-mas" />
      <span key={`p${n}`} className="llena-punto" style={{ position: 'absolute', left: punto.x - 8, top: punto.y - 8, width: 16, height: 16, borderRadius: 8, background: C.claro }} />
      <Repetir alTocar={otra} />
    </Captura>
  );
}

// 2 + 3 (15/10, segunda vuelta). Los días entran escalonados al abrir Inicio y, cuando
// terminan, el que se acaba de registrar pega un saltito y toma un color que se note.
// Fondo: la captura real con el día ya registrado. Las columnas son los píxeles de la
// captura; lo único dibujado es el círculo nuevo del día de hoy.
const PALETA_1 = { principal: '#6E6A82', claro: '#9E9BB0' };
const OPCIONES_DE_COLOR = {
  claro: { relleno: PALETA_1.claro, halo: PALETA_1.principal, nombre: 'el claro del rango, con un halo de su principal' },
  tinta: { relleno: '#e8ecf6', halo: PALETA_1.claro, nombre: 'casi blanco (la tinta), con un halo del claro del rango' },
} as const;

function DiaQueSalta({ color }: { color: keyof typeof OPCIONES_DE_COLOR }) {
  const [n, otra] = useVuelta(4200);
  const d = cajas.inicio ?? {};
  const letras = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const hoy = 3;
  const centros = letras.map((l) => {
    const b = d[l];
    return b ? b.x + b.w / 2 : 0;
  });
  const arriba = (d.L?.y ?? 328) - 42;
  const alto = 62;
  const cy = (d.L?.y ?? 328) - 20.5;
  const op = OPCIONES_DE_COLOR[color];
  // La entrada termina con el último día: 120 ms de espera + 6 × 45 + 320.
  const finDeLaEntrada = 120 + 6 * 45 + 320;
  return (
    <Captura nombre="dia-registrado">
      <Parche nombre="dia-registrado" caja={{ x: 18, y: arriba, w: 354, h: alto }} />
      {centros.map((cx, i) => (
        <div key={`${n}-${i}`} className={i === hoy ? 'entra-dia salta-dia' : 'entra-dia'} style={{ position: 'absolute', left: Math.round(cx - 26), top: arriba, width: 52, height: alto, animationDelay: i === hoy ? `${120 + i * 45}ms, ${finDeLaEntrada + 80}ms` : `${120 + i * 45}ms` }}>
          <Recorte nombre="dia-registrado" caja={{ x: Math.round(cx - 26), y: arriba, w: 52, h: alto }} estilo={{ left: 0, top: 0 }} />
          {i === hoy && (
            <span
              className="toma-color"
              style={{
                position: 'absolute',
                left: 26 - 13,
                top: cy - arriba - 13,
                width: 26,
                height: 26,
                borderRadius: 13,
                background: op.relleno,
                boxShadow: `0 0 12px ${op.halo}`,
                animationDelay: `${finDeLaEntrada + 80}ms`,
              }}
            />
          )}
        </div>
      ))}
      <Repetir alTocar={otra} />
    </Captura>
  );
}

function Muestrario() {
  const rangos = [1, 2, 3, 5, 6, 7];
  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', margin: '-16px 0 34px', alignItems: 'center' }}>
      <span style={{ color: 'var(--sub)', fontSize: 12, width: 160 }}>Con «el claro del rango», el día de hoy en cada rango:</span>
      {rangos.map((r) => {
        const p = paletaDe(r);
        return (
          <span key={r} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'var(--sub)', fontSize: 11 }}>
            <span style={{ width: 26, height: 26, borderRadius: 13, background: p.claro, boxShadow: `0 0 12px ${p.principal}` }} />
            {RANGOS.find((x) => x.n === r)?.nombre}
          </span>
        );
      })}
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'var(--sub)', fontSize: 11 }}>
        <span style={{ width: 26, height: 26, borderRadius: 13, background: '#7e8ca8' }} />
        el de hoy
      </span>
    </div>
  );
}

// 4. Las medallas: un destello que pasa muy de vez en cuando, una por vez.
function Medallas() {
  const [n, otra] = useVuelta(2400);
  const medallas = [
    { x: 197.5, y: 195, r: 10 },
    { x: 224.5, y: 195, r: 10 },
    { x: 251.5, y: 195, r: 10 },
    { x: 223, y: 253, r: 10 },
  ];
  const m = medallas[n % medallas.length];
  return (
    <Captura nombre="medallas">
      <span key={n} style={{ position: 'absolute', left: m.x - m.r, top: m.y - m.r, width: m.r * 2, height: m.r * 2, borderRadius: '50%', overflow: 'hidden' }}>
        <span className="destello" style={{ position: 'absolute', top: -6, bottom: -6, width: 9, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.75), transparent)', transform: 'skewX(-20deg)' }} />
      </span>
      <Repetir alTocar={otra} />
    </Captura>
  );
}

// 5. Subir de rango: la de hoy y la pulida, con la animación de partículas de verdad.
const ANTES = 3;
const DESPUES = 4;

function Subida({ pulida }: { pulida: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [vuelta, setVuelta] = useState(0);
  const [formado, setFormado] = useState(false);
  const control = useRef<{ saltar: () => void; destruir: () => void } | null>(null);
  useEffect(() => {
    if (!canvas.current) return;
    setFormado(false);
    let cancelado = false;
    import('@/motor/subida').then(({ animarSubida }) => {
      if (cancelado || !canvas.current) return;
      control.current = animarSubida(canvas.current, ANTES, DESPUES, () => setFormado(true), null);
    });
    return () => {
      cancelado = true;
      control.current?.destruir();
    };
  }, [vuelta]);
  // En la galería se repite sola.
  useEffect(() => {
    if (!formado) return;
    const id = setTimeout(() => setVuelta((v) => v + 1), 5500);
    return () => clearTimeout(id);
  }, [formado]);
  const nombre = RANGOS.find((r) => r.n === DESPUES)?.nombre ?? '';
  return (
    <div className="subida" style={{ fontFamily: FUENTE }} onClick={() => (formado ? setVuelta((v) => v + 1) : control.current?.saltar())}>
      {pulida && <div aria-hidden className={formado ? 'vineta afloja' : 'vineta cierra'} key={`v${vuelta}`} />}
      <canvas key={vuelta} ref={canvas} className={pulida && formado ? 'respira' : ''} />
      {pulida && formado && <div aria-hidden className="anillo" />}
      {formado &&
        (pulida ? (
          <div className="nombre-pulido">
            <div className="chico">Nuevo rango</div>
            <div className="grande">{nombre}</div>
            <div className="dias">Día {RANGOS[DESPUES - 1]?.desde}</div>
            <div className="seguir">Toca para seguir</div>
          </div>
        ) : (
          <div className="subida-nombre">
            <div className="chico">Nuevo rango</div>
            <div className="grande">{nombre}</div>
            <div className="dias">Día {RANGOS[DESPUES - 1]?.desde}</div>
            <div className="seguir">Toca para seguir</div>
          </div>
        ))}
      <style>{`
        .vineta { position: absolute; inset: 0; z-index: 1; pointer-events: none; background: radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,.55) 100%); }
        .vineta.cierra { animation: vineta-cierra 1.6s ease both; }
        .vineta.afloja { animation: vineta-afloja 1.4s ease both; }
        @keyframes vineta-cierra { from { opacity: 0; } to { opacity: 1; } }
        @keyframes vineta-afloja { from { opacity: 1; } to { opacity: .25; } }
        .respira { animation: respira .9s cubic-bezier(.3,.6,.3,1) both; }
        @keyframes respira { 0% { transform: scale(1); } 40% { transform: scale(1.025); } 100% { transform: scale(1); } }
        .anillo { position: absolute; left: 50%; top: 50%; width: 240px; height: 240px; margin: -120px 0 0 -120px; border-radius: 50%; z-index: 1; pointer-events: none;
          background: radial-gradient(circle, transparent 58%, rgba(232,236,246,.28) 64%, transparent 72%); animation: anillo 1.2s cubic-bezier(.2,.7,.2,1) both; }
        @keyframes anillo { from { opacity: 1; transform: scale(.55); } to { opacity: 0; transform: scale(1.7); } }
        .nombre-pulido { position: relative; z-index: 2; text-align: center; }
        .nombre-pulido .chico { font-size: 12px; letter-spacing: .4em; text-transform: uppercase; color: var(--sub); margin-bottom: 10px; animation: sube .7s ease .15s both; }
        .nombre-pulido .grande { font-size: 34px; font-weight: 300; animation: nombre-entra 1.1s cubic-bezier(.2,.7,.2,1) .35s both; }
        .nombre-pulido .dias { margin-top: 4px; font-size: 13px; color: var(--apagado); font-variant-numeric: tabular-nums; animation: sube .8s ease 1.2s both; }
        .nombre-pulido .seguir { margin-top: 26px; font-size: 12px; letter-spacing: .2em; text-transform: uppercase; color: var(--apagado); animation: sube 1s ease 2.4s both; }
        @keyframes nombre-entra { from { opacity: 0; letter-spacing: .34em; filter: blur(6px); } to { opacity: 1; letter-spacing: .12em; filter: blur(0); } }
        @keyframes sube { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}

function Tarjeta({ n, titulo, nota, children }: { n: number; titulo: string; nota: ReactNode; children: ReactNode }) {
  return (
    <Marco rotulo={`${n} · ${titulo}`} nota={nota}>
      {children}
    </Marco>
  );
}

export default function PropuestaAnimaciones() {
  // `undefined` = todavía no se leyó la dirección (si no, los iframes se anidan).
  const [marco, setMarco] = useState<string | null | undefined>(undefined);
  useEffect(() => setMarco(new URLSearchParams(window.location.search).get('marco')), []);
  if (marco === undefined) return null;
  if (marco === 'subida-hoy' || marco === 'subida-pulida') return <Subida pulida={marco === 'subida-pulida'} />;

  return (
    <Banco
      titulo="Animaciones: sí o no, una por una"
      queEs="Cada una sobre la captura real de su pantalla (la app nativa corriendo en el navegador). Se repiten solas para poder mirarlas; en la app pasan una vez. Lo que se mueve son los píxeles de la captura o, si es algo nuevo, solo eso dibujado."
    >
      <style>{`
        .pulso-mas { animation: pulso-mas .32s cubic-bezier(.3,.6,.3,1) .4s both; }
        @keyframes pulso-mas { 0% { transform: scale(1); } 35% { transform: scale(.965); filter: brightness(1.35); } 100% { transform: scale(1); filter: none; } }
        .llena-punto { animation: llena-punto .26s cubic-bezier(.2,.8,.3,1) .5s both; }
        @keyframes llena-punto { from { transform: scale(0); } to { transform: scale(1); } }
        .late-planeta { animation: late .7s cubic-bezier(.3,.6,.3,1) .5s both; }
        @keyframes late { 0% { transform: scale(1); } 35% { transform: scale(1.08); filter: brightness(1.18); } 100% { transform: scale(1); filter: none; } }
        .entra-dia { animation: entra-dia .32s cubic-bezier(.2,.7,.2,1) both; }
        @keyframes entra-dia { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .destello { animation: destello .75s ease-in-out .3s both; }
        .salta-dia { animation-name: entra-dia, salta-dia; animation-duration: .32s, .42s; animation-timing-function: cubic-bezier(.2,.7,.2,1), cubic-bezier(.3,.6,.3,1); animation-fill-mode: both, none; }
        @keyframes salta-dia { 0% { transform: none; } 40% { transform: translateY(-7px) scale(1.12); } 100% { transform: none; } }
        .toma-color { animation: toma-color .42s ease both; }
        @keyframes toma-color { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: none; } }
        @keyframes destello { from { left: -14px; } to { left: 26px; } }
      `}</style>
      <Titulito>Nueva: 2 y 3 juntas, para decidir el color</Titulito>
      <Fila>
        <Tarjeta n={3} titulo="Días al abrir + el registrado · opción A" nota={<>Entran de a uno (45 ms entre cada uno) y, al terminar, el día de hoy pega un saltito (7 px, 0,42 s) y toma el color nuevo. <b>A:</b> {OPCIONES_DE_COLOR.claro.nombre}. En polvo queda lila; abajo, cómo queda en cada rango.</>}>
          <DiaQueSalta color="claro" />
        </Tarjeta>
        <Tarjeta n={3} titulo="Días al abrir + el registrado · opción B" nota={<>Lo mismo con <b>B:</b> {OPCIONES_DE_COLOR.tinta.nombre}. Se nota más en cualquier rango, pero deja de decir de qué rango sos.</>}>
          <DiaQueSalta color="tinta" />
        </Tarjeta>
      </Fila>
      <Muestrario />

      <Titulito>Aprobadas: ya están en la app, sin publicar</Titulito>
      <Fila>
        <Tarjeta n={1} titulo="El + al terminar una serie · sí" nota="Al tocar: el + se hunde un poco y se ilumina (0,3 s) y el punto de la serie se llena desde el centro (0,26 s). Nada más.">
          <Serie />
        </Tarjeta>
        <Tarjeta n={4} titulo="Las medallas · sí" nota="Un destello que cruza una medalla por vez. Acá pasa cada 2,4 s para verlo; en la app, uno cada 8 a 12 s, y solo con la pantalla quieta.">
          <Medallas />
        </Tarjeta>
      </Fila>
      <Fila>
        <Tarjeta n={5} titulo="Subir de rango · la pulida, sí" nota="Las mismas partículas. Lo nuevo: el fondo se cierra un poco mientras se deshace el viejo y se abre al formarse el nuevo; un anillo de luz sale una vez del objeto; el objeto respira (2,5 %); el nombre entra apretando el espaciado y enfocándose, y «Toca para seguir» espera dos segundos.">
          <iframe title="subida pulida" src="/galeria/propuestas/animaciones?marco=subida-pulida" style={{ width: 390, height: 844, border: 0, display: 'block' }} />
        </Tarjeta>
      </Fila>
    </Banco>
  );
}
