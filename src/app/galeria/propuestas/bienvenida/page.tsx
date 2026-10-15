'use client';

// Propuesta: la bienvenida nueva (15/10).
//
// La de hoy son cuatro pantallas sobre los rangos ("Empiezas desde el polvo", que
// se lee como que la app te dice que no sos nada) y un recorrido de seis pasos
// después del nombre. La app cambió mucho desde entonces.
//
// LA PROPUESTA: el cielo de los rangos queda de fondo, pero deja de ser el tema.
// Tres pantallas antes de la cuenta, una idea cada una, con lo que la app hace
// de verdad. Y después del nombre, NINGÚN recorrido: avisos de una línea en el
// momento en que hacen falta, sobre la pantalla de la que hablan. Es lo que
// quedó anotado cuando tres personas se trabaron al elegir ejercicio: "en el
// momento, con el mínimo texto, nada de guía obligatoria".
//
// SE MIRA DESDE LA COMPUTADORA (15/10): los marcos van a tamaño real, uno al lado del
// otro, y `?ver=` abre una sola en un marco de teléfono centrado.
// Lo que se dibuja adentro son reconstrucciones con las medidas de la app, no
// capturas del iPhone.

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import Cielo from '@/components/bienvenida/Cielo';
import Objetos from '@/components/bienvenida/Objetos';
import { Banco } from '../Banco';

const C = { fondo: '#05060a', tinta: '#e8ecf6', sub: '#8a93a8', apagado: '#4a5163', linea: '#1d2230', lineaFuerte: '#2a3040', claro: '#c4c2ba', hoja: '#0b0d13' };

type Pantalla = { clave: string; rotulo: string; nota: string };
const ENTRADA: Pantalla[] = [
  { clave: 'pesos', rotulo: '1 · Tus series y tus pesos', nota: 'Lo primero que se hace en la app. El peso de la última vez ya aparece.' },
  { clave: 'llegar', rotulo: '2 · El día entra solo', nota: 'La ubicación, dicha por lo que te ahorra y no por el permiso.' },
  { clave: 'amigo', rotulo: '3 · Con un amigo, en vivo', nota: 'Detrás, los objetos de otras rachas flotando, como hoy.' },
];
const MOMENTO: Pantalla[] = [
  { clave: 'empezar', rotulo: 'A · La primera vez en Inicio', nota: 'Un aviso sobre el botón de empezar. Se va al tocarlo.' },
  { clave: 'elegir', rotulo: 'B · La primera vez que eliges ejercicio', nota: 'Donde se trabaron tres personas: una línea sobre la lista.' },
  { clave: 'serie', rotulo: 'C · La primera serie', nota: 'Este ya existe hoy y queda igual.' },
];

const textoTitulo: CSSProperties = { fontSize: 32, lineHeight: 1.15, fontWeight: 500, color: C.tinta, margin: '0 0 12px' };
const textoBajada: CSSProperties = { fontSize: 17, lineHeight: 1.5, color: C.sub, margin: 0 };

// ── LO QUE SE VE ARRIBA DE CADA TEXTO: un pedazo de la app, no un dibujo ──

/** El bloque de Inicio, en chico: las píldoras, el peso y los puntos llenándose. */
function MiniBloque({ hechas }: { hechas: number }) {
  return (
    <div style={{ border: `1px solid ${C.linea}`, borderRadius: 14, padding: '16px 18px', background: 'rgba(11,13,19,0.72)' }}>
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

/** La tira de la semana, con el día de hoy llenándose cuando "llegás". */
function MiniSemana({ llego }: { llego: boolean }) {
  const dias = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  return (
    <div style={{ border: `1px solid ${C.linea}`, borderRadius: 14, padding: '16px 14px', background: 'rgba(11,13,19,0.72)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, color: llego ? C.tinta : C.sub, fontSize: 14, transition: 'color .4s' }}>
        <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden>
          <path d="M8 19s6-6.2 6-11A6 6 0 0 0 2 8c0 4.8 6 11 6 11z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="2.2" fill="currentColor" />
        </svg>
        {llego ? 'Llegaste al gimnasio · día anotado' : 'De camino al gimnasio'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {dias.map((d, i) => {
          const hecho = i < 3 || (i === 3 && llego);
          return (
            <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 30, height: 30, borderRadius: 15, border: `1px solid ${i === 3 ? C.claro : C.lineaFuerte}`, background: hecho ? C.claro : 'transparent', transition: 'background .5s' }} />
              <span style={{ color: C.apagado, fontSize: 12 }}>{d}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** "Entrenando contigo": el ejercicio, la serie y el descanso del otro. */
function MiniAmigo({ falta }: { falta: number }) {
  const fila = (inicial: string, nombre: string, que: string, derecha: ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
      <span style={{ width: 34, height: 34, borderRadius: 17, border: `1px solid ${C.lineaFuerte}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.tinta, fontSize: 14 }}>{inicial}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: C.tinta, fontSize: 15 }}>{nombre}</div>
        <div style={{ color: C.sub, fontSize: 13, marginTop: 2 }}>{que}</div>
      </div>
      {derecha}
    </div>
  );
  return (
    <div style={{ border: `1px solid ${C.linea}`, borderRadius: 14, padding: '6px 18px', background: 'rgba(11,13,19,0.72)' }}>
      {fila(
        'L',
        'lucia',
        'Sentadilla · serie 2 de 4',
        <span style={{ textAlign: 'right' }}>
          <span style={{ display: 'block', color: C.tinta, fontSize: 17, fontVariantNumeric: 'tabular-nums' }}>
            {Math.floor(falta / 60)}:{String(falta % 60).padStart(2, '0')}
          </span>
          <span style={{ color: C.sub, fontSize: 11 }}>descanso</span>
        </span>
      )}
      <div style={{ height: 1, background: C.linea }} />
      {fila('M', 'mateo', 'Remo con barra · serie 1 de 3', <span style={{ color: C.sub, fontSize: 13 }}>ahora</span>)}
    </div>
  );
}

// ── LAS PANTALLAS ──

function Entrada({ clave, t, chico = false }: { clave: string; t: number; chico?: boolean }) {
  const indice = ENTRADA.findIndex((p) => p.clave === clave);
  const texto = {
    pesos: { titulo: 'Anota cada serie con un toque', bajada: 'El peso de la última vez ya aparece puesto.' },
    llegar: { titulo: 'El día se anota solo al llegar al gimnasio', bajada: 'Por la ubicación, aunque no abras la app.' },
    amigo: { titulo: 'Entrena con un amigo y mira lo que hace en vivo', bajada: 'Su ejercicio, su serie y cuánto le queda de descanso.' },
  }[clave]!;
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: C.fondo, overflow: 'hidden' }}>
      {/* El cielo de los rangos, de fondo: queda, pero ya no se lo explica. */}
      <Cielo paso={Math.min(indice, 2)} quieto={chico} />
      {/* Los objetos de otras rachas flotando, como hoy en la tercera: los rangos se ven, no se explican. */}
      {clave === 'amigo' && <Objetos quieto={chico} />}
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 28px', gap: 34 }}>
        {clave === 'pesos' && <MiniBloque hechas={Math.floor(t / 1.2) % 4} />}
        {clave === 'llegar' && <MiniSemana llego={Math.floor(t / 2.4) % 2 === 1} />}
        {clave === 'amigo' && <MiniAmigo falta={72 - (Math.floor(t) % 72)} />}
        <div>
          <h1 style={textoTitulo}>{texto.titulo}</h1>
          <p style={textoBajada}>{texto.bajada}</p>
        </div>
      </div>
      <div style={{ position: 'relative', padding: '0 28px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        {/* Los puntitos de en qué pantalla vas: tres, nada más. */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {ENTRADA.map((p, i) => (
            <span key={p.clave} style={{ width: 6, height: 6, borderRadius: 3, background: i === indice ? C.tinta : C.apagado }} />
          ))}
        </div>
        <div style={{ width: '100%', padding: 15, borderRadius: 2, background: C.tinta, color: C.fondo, textAlign: 'center', fontSize: 16, fontWeight: 600 }}>
          Siguiente
        </div>
        <div style={{ color: C.sub, fontSize: 15, padding: '12px 0 0' }}>Saltar</div>
      </div>
    </div>
  );
}

/** El aviso de una línea, como los globitos de la app: flota y se cierra con un toque. */
function Globito({ children, arriba }: { children: ReactNode; arriba: number }) {
  return (
    <div style={{ position: 'absolute', left: 24, right: 24, top: arriba, border: `1px solid ${C.lineaFuerte}`, borderRadius: 12, background: C.hoja, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 10px 30px rgba(0,0,0,.45)' }}>
      <span style={{ flex: 1, color: C.tinta, fontSize: 15 }}>{children}</span>
      <span style={{ color: C.sub, fontSize: 16 }}>✕</span>
    </div>
  );
}

function Momento({ clave }: { clave: string }) {
  const caja: CSSProperties = { position: 'relative', height: '100%', background: C.fondo, padding: '64px 24px 24px', overflow: 'hidden' };
  if (clave === 'empezar') {
    return (
      <div style={caja}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.tinta, fontSize: 16, fontWeight: 600 }}>
            <span style={{ width: 28, height: 28, borderRadius: 14, border: `1px solid ${C.lineaFuerte}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 400 }}>A</span>
            ana
          </span>
          <span style={{ border: `1px solid ${C.claro}`, borderRadius: 999, padding: '9px 16px', color: C.tinta, fontSize: 14 }}>Iniciar entrenamiento</span>
        </div>
        <div style={{ color: C.claro, fontSize: 92, fontWeight: 300, marginTop: 40 }}>0</div>
        <Globito arriba={118}>Empieza aquí: eliges el ejercicio y anotas cada serie.</Globito>
      </div>
    );
  }
  if (clave === 'elegir') {
    const zonas = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Core', 'Cardio'];
    return (
      <div style={caja}>
        <div style={{ color: C.tinta, fontSize: 19, marginBottom: 16 }}>¿Qué vas a hacer?</div>
        <div style={{ border: `1px solid ${C.lineaFuerte}`, borderRadius: 10, padding: '12px 14px', color: C.apagado, fontSize: 15 }}>Buscar ejercicio</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 92 }}>
          {zonas.map((z) => (
            <span key={z} style={{ border: `1px solid ${C.lineaFuerte}`, borderRadius: 999, padding: '9px 15px', color: C.tinta, fontSize: 14 }}>{z}</span>
          ))}
        </div>
        <Globito arriba={180}>Toca un músculo o escribe el nombre.</Globito>
      </div>
    );
  }
  return (
    <div style={caja}>
      <div style={{ marginTop: 120 }}>
        <MiniBloque hechas={0} />
      </div>
      <Globito arriba={70}>Toca + al terminar cada serie.</Globito>
    </div>
  );
}

// ── LA PÁGINA ──

function Marco({ href, rotulo, nota, children }: { href: string; rotulo: string; nota: string; children: ReactNode }) {
  return (
    <section style={{ width: 390 }}>
      <Link href={href} style={{ display: 'block', color: 'inherit' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--sub)', marginBottom: 8, minHeight: 26 }}>{rotulo}</div>
        {/* La pantalla real: 390 × 844, como un iPhone. */}
        <div style={{ width: 390, height: 844, overflow: 'hidden', borderRadius: 28, border: `1px solid ${C.linea}` }}>{children}</div>
      </Link>
      <p className="nota-privada" style={{ marginTop: 8, lineHeight: 1.5 }}>{nota}</p>
    </section>
  );
}

export default function PropuestaBienvenida() {
  // Un reloj para que lo de arriba de cada pantalla se mueva. `?ver=<clave>` abre una sola.
  const [t, setT] = useState(0);
  const [ver, setVer] = useState<string | null>(null);
  useEffect(() => {
    setVer(new URLSearchParams(window.location.search).get('ver'));
    const reloj = setInterval(() => setT((x) => x + 0.2), 200);
    return () => clearInterval(reloj);
  }, []);

  const sola = [...ENTRADA, ...MOMENTO].find((p) => p.clave === ver);
  if (sola) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <Link href="/galeria/propuestas/bienvenida" style={{ color: C.sub, fontSize: 13 }}>
          ← {sola.rotulo}
        </Link>
        <div data-telefono={sola.rotulo} style={{ width: 390, height: 844, maxHeight: 'calc(100vh - 60px)', overflow: 'hidden', borderRadius: 28, border: `1px solid ${C.lineaFuerte}`, background: C.fondo }}>
          {ENTRADA.includes(sola) ? <Entrada clave={sola.clave} t={t} /> : <Momento clave={sola.clave} />}
        </div>
      </div>
    );
  }

  return (
    <Banco
      titulo="La bienvenida nueva"
      queEs="A tamaño real (390 × 844, un iPhone). Toca una para verla sola. Son reconstrucciones con las medidas de la app, no capturas del iPhone. La de hoy, entera y de verdad, está en /galeria/bienvenida."
    >
      <div style={{ maxWidth: 720, color: 'var(--sub)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
        <p style={{ margin: '0 0 10px' }}>
          <b style={{ color: 'var(--tinta)' }}>Hoy:</b> cuatro pantallas sobre los rangos («Empiezas desde el polvo», la lista de ejercicios, la gente, y los ocho objetos con el agujero negro) y, después del nombre, un recorrido de seis pasos por las pestañas.{' '}
          <Link href="/galeria/bienvenida">Verla →</Link>
        </p>
        <p style={{ margin: 0 }}>
          <b style={{ color: 'var(--tinta)' }}>Propuesta:</b> tres pantallas antes de la cuenta, una idea cada una, sobre el mismo cielo. Después, la animación de los ocho objetos de hoy, SIN texto, y al final los dos botones (crear cuenta o entrar): los rangos se ven y no se explican. Después del nombre, ningún recorrido: tres avisos de una línea, cada uno la primera vez que hace falta. La de compararte con tus amigos quedó afuera: Ranking se encuentra solo, y cuatro pantallas ya serían una de más.
        </p>
      </div>

      <div style={{ fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--sub)', margin: '6px 0 12px' }}>Antes de la cuenta</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, marginBottom: 34, width: 'min(1300px, 94vw)' }}>
        {ENTRADA.map((p) => (
          <Marco key={p.clave} href={`/galeria/propuestas/bienvenida?ver=${p.clave}`} rotulo={p.rotulo} nota={p.nota}>
            <Entrada clave={p.clave} t={t} chico />
          </Marco>
        ))}
      </div>

      <p className="nota-privada" style={{ margin: '-20px 0 30px', lineHeight: 1.5, maxWidth: 620 }}>
        4 · El cierre: la animación de los ocho objetos que ya existe, sin el «Tu viaje empieza ahora mismo», y al final «Crear cuenta» y «Ya tengo cuenta». Se ve en <Link href="/galeria/bienvenida">/galeria/bienvenida</Link>, paso 4.
      </p>

      <div style={{ fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--sub)', margin: '6px 0 12px' }}>Después del nombre, en el momento</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, width: 'min(1300px, 94vw)' }}>
        {MOMENTO.map((p) => (
          <Marco key={p.clave} href={`/galeria/propuestas/bienvenida?ver=${p.clave}`} rotulo={p.rotulo} nota={p.nota}>
            <Momento clave={p.clave} />
          </Marco>
        ))}
      </div>
    </Banco>
  );
}
