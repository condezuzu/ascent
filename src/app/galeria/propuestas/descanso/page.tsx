'use client';

// Propuesta: la pantalla del descanso.
//
// Es la que más se mira en el gimnasio y hoy es un número, una rayita y una
// fila de botones. No dice qué estabas haciendo, no usa el color del rango, y
// cuando termina se queda clavada en 0:00.
//
// SE MIRA DESDE EL TELÉFONO, A TAMAÑO REAL (12/10): cada variante se abre a
// pantalla completa, con las medidas de la app. En un monitor los tamaños
// engañan. En pantalla ancha quedan todas en fila, achicadas, para comparar.
//
// LA DE "HOY" ES UNA RECONSTRUCCIÓN: la pantalla de verdad vive en la app del
// teléfono (`movil/src/Descanso.tsx`) y acá se rehízo con sus mismas medidas y
// colores. Sirve para comparar la composición; no es una captura del iPhone.

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { paletaDe } from '@nucleo/paletas';
import { Banco } from '../Banco';

const C = { fondo: '#05060a', listo: '#1a1f2b', tinta: '#e8ecf6', sub: '#8a93a8', apagado: '#4a5163', linea: '#1d2230', principal: '#7e8ca8' };
const PRESETS = ['1:00', '1:30', '2:00', '3:00', '4:00'];
const DURACION = 180;
const CELESTE = '#6fc3e8';

type Variante = { clave: string; rotulo: string; nota: string; color?: string; hoy?: boolean; termino?: boolean };
// Los colores salen de la paleta de cada rango, la misma que tiñe el resto de la app.
const VARIANTES: Variante[] = [
  { clave: 'hoy', rotulo: 'Hoy', nota: 'El número y una rayita. No dice qué ejercicio ni qué serie.', hoy: true },
  { clave: 'bajo', rotulo: 'Propuesta · rango bajo', nota: 'El arco con el color de un Asteroide (racha de 6 a 15).', color: paletaDe(2).principal },
  { clave: 'medio', rotulo: 'Propuesta · rango medio', nota: 'Con el de un Planeta (racha de 31 a 50).', color: paletaDe(4).principal },
  { clave: 'alto', rotulo: 'Propuesta · rango alto', nota: 'Con el de una Galaxia (racha de 76 a 105).', color: paletaDe(6).principal },
  { clave: 'celeste', rotulo: 'Propuesta · celeste fijo', nota: 'El mismo celeste para todos, sea cual sea el rango.', color: CELESTE },
  { clave: 'termino', rotulo: 'Propuesta · al terminar', nota: 'El fondo cambia y el número cuenta cuánto te pasaste.', color: paletaDe(4).principal, termino: true },
];

const mmss = (s: number) => `${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, '0')}`;
const enlace: CSSProperties = { color: C.sub, fontSize: 15, textAlign: 'center', padding: '13px 0' };

function Presets({ chicos = false }: { chicos?: boolean }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: chicos ? 2 : 10 }}>
      {PRESETS.map((p) => (
        <span
          key={p}
          style={{ border: `1px solid ${p === '3:00' ? C.sub : C.linea}`, borderRadius: 999, padding: chicos ? '6px 11px' : '8px 14px', fontSize: chicos ? 12 : 13, color: p === '3:00' ? C.tinta : C.apagado }}
        >
          {p}
        </span>
      ))}
    </div>
  );
}

/** LA DE HOY, con las medidas de `movil/src/Descanso.tsx`. */
function Hoy({ falta }: { falta: number }) {
  return (
    <>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.tinta, fontSize: 104, fontWeight: 200, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{mmss(falta)}</div>
        <div style={{ width: '72%', height: 4, borderRadius: 2, background: C.linea, marginTop: 18, overflow: 'hidden' }}>
          <div style={{ width: `${(falta / DURACION) * 100}%`, height: '100%', background: C.principal }} />
        </div>
      </div>
      <Presets />
      <div style={enlace}>Serie hecha</div>
      <div style={enlace}>Saltar</div>
    </>
  );
}

/** El arco que se vacía alrededor del número. */
function Arco({ proporcion, color, children }: { proporcion: number; color: string; children: ReactNode }) {
  const R = 128;
  const lado = 2 * R + 16;
  const largo = 2 * Math.PI * R;
  return (
    <div style={{ position: 'relative', width: lado, height: lado, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={lado} height={lado} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={lado / 2} cy={lado / 2} r={R} fill="none" stroke={C.linea} strokeWidth="2" />
        <circle
          cx={lado / 2}
          cy={lado / 2}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={largo}
          strokeDashoffset={largo * (1 - Math.max(0, Math.min(1, proporcion)))}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div style={{ textAlign: 'center' }}>{children}</div>
    </div>
  );
}

/** El compañero, abajo y en chico: quién, qué hace, y su cuenta. */
function ElOtro({ falta }: { falta: number }) {
  const listo = falta <= 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: `1px solid ${C.linea}`, paddingTop: 14, marginTop: 8 }}>
      <div style={{ width: 34, height: 34, borderRadius: 17, border: `1px solid ${C.linea}`, color: C.sub, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>J</div>
      {/* La cuenta va en el renglón del nombre: al costado le sacaba ancho al detalle y se cortaba. */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ color: C.tinta, fontSize: 15 }}>juan_p</span>
          <span style={{ border: `1px solid ${listo ? C.sub : C.linea}`, borderRadius: 999, padding: '4px 11px', fontSize: 13, color: listo ? C.tinta : C.sub, fontVariantNumeric: 'tabular-nums' }}>
            {listo ? 'listo' : `descansa ${mmss(falta)}`}
          </span>
        </div>
        <div style={{ color: C.sub, fontSize: 14, marginTop: 3 }}>Sentadilla · serie 2 de 4</div>
      </div>
    </div>
  );
}

/** LA PROPUESTA, con el otro abajo. `falta` en cero o menos = ya terminó, y cuenta cuánto te pasaste. */
function Propuesta({ falta, color }: { falta: number; color: string }) {
  const termino = falta <= 0;
  return (
    <>
      {/* Arriba, chico: qué estabas haciendo. Lo mismo que ya dice la tarjeta de la pantalla bloqueada. */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.24em', color: termino ? color : C.sub }}>{termino ? 'LISTO' : 'DESCANSO'}</div>
        <div style={{ color: C.tinta, fontSize: 19, marginTop: 8 }}>Press de banca</div>
        <div style={{ color: C.sub, fontSize: 14, marginTop: 3 }}>serie 3 de 4</div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Arco proporcion={termino ? 0 : falta / DURACION} color={color}>
          <div style={{ color: C.tinta, fontSize: termino ? 72 : 84, fontWeight: 200, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {termino ? `+${mmss(falta)}` : mmss(falta)}
          </div>
          {termino && <div style={{ color: C.sub, fontSize: 13, marginTop: 10 }}>de más</div>}
        </Arco>
      </div>

      <div style={{ background: termino ? color : 'transparent', border: `1px solid ${termino ? color : C.sub}`, borderRadius: 4, padding: '16px 0', textAlign: 'center', color: termino ? C.fondo : C.tinta, fontSize: 16, fontWeight: termino ? 600 : 400 }}>
        Serie hecha
      </div>
      {!termino && (
        <div style={{ marginTop: 12 }}>
          <Presets chicos />
        </div>
      )}
      <div style={{ ...enlace, fontSize: 14, padding: '9px 0 4px' }}>{termino ? 'Seguir sin contar' : 'Saltar'}</div>
      <ElOtro falta={falta + 38} />
    </>
  );
}

/** Lo que va adentro de la pantalla, sea a tamaño real o en el marco achicado. */
function Pantalla({ v, falta }: { v: Variante; falta: number }) {
  const f = v.termino ? Math.min(falta, 0) - 12 : Math.max(falta, 1);
  return v.hoy ? <Hoy falta={Math.max(0, falta)} /> : <Propuesta falta={v.termino ? f : f} color={v.color ?? C.principal} />;
}

export default function PropuestaDescanso() {
  // Un reloj de verdad, para ver el arco moverse: arranca en 1:47 y vuelve a empezar.
  // `?quieto=107` lo congela (para las capturas). `?ver=<clave>` abre una sola, a pantalla completa.
  const [falta, setFalta] = useState(107);
  const [ver, setVer] = useState<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setVer(q.get('ver'));
    if (q.get('quieto') !== null) {
      setFalta(Number(q.get('quieto')) || 0);
      return;
    }
    const t = setInterval(() => setFalta((f) => (f <= 1 ? 107 : f - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const sola = VARIANTES.find((v) => v.clave === ver);
  if (sola) {
    // A PANTALLA COMPLETA Y A TAMAÑO REAL: tapa todo lo demás, como el modal de la app.
    return (
      <div
        data-telefono={sola.rotulo}
        style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: sola.termino ? C.listo : C.fondo, display: 'flex', flexDirection: 'column', padding: 'max(56px, env(safe-area-inset-top)) 24px max(30px, env(safe-area-inset-bottom))' }}
      >
        <Link href="/galeria/propuestas/descanso" style={{ position: 'absolute', top: 'max(14px, env(safe-area-inset-top))', left: 16, color: C.sub, fontSize: 13 }}>
          ← {sola.rotulo}
        </Link>
        <div style={{ position: 'absolute', top: 'max(44px, env(safe-area-inset-top))', right: 22, color: C.sub, fontSize: 20 }}>✕</div>
        <Pantalla v={sola} falta={falta} />
      </div>
    );
  }

  return (
    <Banco
      titulo="La pantalla del descanso"
      queEs="Toca una para verla a pantalla completa, al tamaño que va a tener en la app. Elegida: la que lleva al compañero abajo. Falta decidir el color del arco. La de hoy es una reconstrucción con las medidas de la app del teléfono, no una captura del iPhone."
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'flex-start', width: 'min(1320px, 92vw)' }}>
        {VARIANTES.map((v) => (
          <section key={v.clave} style={{ width: 195 }}>
            <Link href={`/galeria/propuestas/descanso?ver=${v.clave}`} style={{ display: 'block', color: 'inherit' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--sub)', marginBottom: 8 }}>{v.rotulo}</div>
              {/* El marco es la pantalla real (390 de ancho) achicada a la mitad: las proporciones son las de verdad. */}
              <div style={{ width: 195, height: 400, overflow: 'hidden', borderRadius: 16, border: `1px solid ${C.linea}` }}>
                <div
                  data-telefono={v.rotulo}
                  style={{ width: 390, height: 800, transform: 'scale(0.5)', transformOrigin: 'top left', background: v.termino ? C.listo : C.fondo, display: 'flex', flexDirection: 'column', padding: '56px 24px 30px', position: 'relative' }}
                >
                  <Pantalla v={v} falta={falta} />
                </div>
              </div>
            </Link>
            <p className="nota-privada" style={{ marginTop: 8, lineHeight: 1.5 }}>{v.nota}</p>
          </section>
        ))}
      </div>
    </Banco>
  );
}
