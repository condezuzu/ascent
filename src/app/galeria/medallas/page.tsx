'use client';

// BOCETOS DE LAS MEDALLAS POR MARCA. No está construido: es para mirar y
// elegir. Se entra a mano por /galeria/medallas.
//
// EL CAMINO YA ESTÁ ELEGIDO (23/9): constelación. Se probaron tránsito y
// grabado, se miraron y se descartaron; el código de los dos se sacó en vez de
// dejarlo comentado, porque un camino muerto que sigue ahí se vuelve a
// discutir cada vez que alguien abre el archivo.
//
// SE MIRAN A LOS TRES TAMAÑOS, porque la recta final de esto es 18 px al lado
// de un nombre: la receta de `compartido/insignias.ts` dice que la decisión se
// toma mirando el tamaño real, no el grande. Un dibujo que a 96 se ve precioso
// y a 18 es una mancha no sirve, y eso no se ve hasta ponerlo.

import { useState } from 'react';
import { BOCETOS, MATERIALES, TRES, UMBRAL, frase, materialDe, type Boceto, type Material } from './bocetos';

export default function Medallas() {
  const [percentil, setPercentil] = useState(72);
  const mat = materialDe(percentil);
  // Lo que diría la frase con este percentil: si superás al 72%, "solo el 28%
  // levanta este peso".
  const cuantos = Math.max(1, 100 - percentil);

  return (
    <div style={{ minHeight: '100vh', background: '#05060a', color: '#e8ecf6', padding: '28px 20px 80px' }}>
      <div style={{ maxWidth: 940, margin: '0 auto' }}>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#8a93a8' }}>
          Bocetos · constelación
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 300, margin: '8px 0 6px' }}>Medallas por marca</h1>
        <p style={{ color: '#8a93a8', fontSize: 14, lineHeight: 1.6, maxWidth: 640 }}>
          Nada de esto está construido. Se dibuja el <strong>contorno</strong> de una figura y no un
          esquema de articulaciones, que era la falla anterior. Con eso alcanzó para brazo y pierna.{' '}
          <strong>No alcanzó para las tres del torso</strong>: están abajo con lo que sale en su lugar,
          y después la salida que propongo. El porqué de cada decisión está arriba de{' '}
          <code style={{ color: '#c4c2ba' }}>bocetos.ts</code>.
        </p>

        {/* ---- el umbral y los tres materiales ---- */}
        <div style={{ marginTop: 28, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#8a93a8' }}>
            Percentil
          </span>
          <input
            type="range"
            min={1}
            max={99}
            value={percentil}
            onChange={(e) => setPercentil(Number(e.target.value))}
            style={{ width: 260, accentColor: mat?.claro ?? '#4a5163' }}
          />
          <span style={{ fontVariantNumeric: 'tabular-nums', color: mat?.claro ?? '#4a5163', fontSize: 15 }}>
            {percentil}%
          </span>
          <span style={{ color: '#4a5163', fontSize: 13 }}>
            {mat ? `material: ${mat.nombre.toLowerCase()}` : 'sin medalla'}
          </span>
        </div>
        <p style={{ color: '#4a5163', fontSize: 12, lineHeight: 1.6, maxWidth: 640 }}>
          Bajá el deslizador por debajo del {UMBRAL}% y desaparecen: una medalla es para mostrar que
          sos mejor que la mayoría. Los tres cortes —{UMBRAL}, 80 y 95— son los percentiles que
          publica la propia fuente, no cortes inventados.
        </p>

        <div style={{ display: 'flex', gap: 14, marginTop: 16, flexWrap: 'wrap' }}>
          {MATERIALES.map((m) => (
            <button
              key={m.clave}
              onClick={() => setPercentil(Math.min(99, m.desde + 4))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'center' }}
            >
              <Medalla boceto={BOCETOS[0]} material={m} tam={48} />
              <div style={{ color: m.clave === mat?.clave ? m.claro : '#4a5163', fontSize: 11, marginTop: 5 }}>
                {m.nombre}
              </div>
              <div style={{ color: '#4a5163', fontSize: 10 }}>{m.desde}%+</div>
            </button>
          ))}
        </div>

        {/* ---- las cinco, grandes ---- */}
        <h2 style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#8a93a8', margin: '40px 0 16px' }}>
          Las cinco zonas
        </h2>
        {!mat ? (
          <p style={{ color: '#4a5163', fontSize: 14 }}>
            Por debajo del {UMBRAL}% no hay medalla. Subí el deslizador.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 18 }}>
            {BOCETOS.map((b) => (
              <div
                key={b.clave}
                style={{ border: '1px solid #1d2230', borderRadius: 14, padding: 16, textAlign: 'center' }}
              >
                <Medalla boceto={b} material={mat} tam={104} />
                <div style={{ fontSize: 15, marginTop: 12 }}>{b.zona}</div>
                <div style={{ color: '#4a5163', fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>{b.pie}</div>
                {/* SE DICE CUÁL NO PASA Y QUÉ SALE EN SU LUGAR. Mandar cinco
                    bocetos como si los cinco funcionaran sería hacerle perder
                    el tiempo al que mira: tres no funcionan. */}
                {b.advertencia && (
                  <div
                    style={{
                      color: '#c98b6b', fontSize: 11, marginTop: 8, lineHeight: 1.5,
                      borderTop: '1px solid #1d2230', paddingTop: 8,
                    }}
                  >
                    {b.advertencia}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ---- la salida: tres en vez de cinco ---- */}
        <h2 style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#8a93a8', margin: '44px 0 8px' }}>
          La salida: tres en vez de cinco
        </h2>
        <p style={{ color: '#8a93a8', fontSize: 13, lineHeight: 1.6, maxWidth: 640, marginBottom: 18 }}>
          Pecho, espalda y hombros son <strong>el mismo torso</strong>: de frente y de espalda el
          contorno es idéntico, y el hombro es una esquina de ese contorno. Lo que los separa en un
          cuerpo real es el relieve, y el relieve necesita sombra. Así que van juntos en una sola
          medalla, que se lleva press de banca, remo y press militar. Estas tres las nombra
          cualquiera sin leyenda.
        </p>
        {mat && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 18 }}>
            {TRES.map((b) => (
              <div
                key={b.clave}
                style={{ border: '1px solid #2a3040', borderRadius: 14, padding: 16, textAlign: 'center' }}
              >
                <Medalla boceto={b} material={mat} tam={104} />
                <div style={{ fontSize: 15, marginTop: 12 }}>{b.zona}</div>
                <div style={{ color: '#4a5163', fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>{b.pie}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18 }}>
          <span style={{ color: '#4a5163', fontSize: 11, width: 34, fontVariantNumeric: 'tabular-nums' }}>18px</span>
          {mat && TRES.map((b) => <Medalla key={b.clave} boceto={b} material={mat} tam={18} />)}
          <span style={{ color: '#4a5163', fontSize: 11, marginLeft: 10 }}>
            tres siluetas distintas se separan mejor que cinco parecidas
          </span>
        </div>
        {/* ---- EL TAMAÑO DE VERDAD ---- */}
        <h2 style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#8a93a8', margin: '44px 0 8px' }}>
          Al tamaño de verdad
        </h2>
        <p style={{ color: '#8a93a8', fontSize: 13, lineHeight: 1.6, maxWidth: 640, marginBottom: 18 }}>
          Aquí se decide. Con el umbral puesto casi nadie va a llevar las cinco a la vez, que era el
          argumento: menos medallas juntas, más fácil distinguirlas.
        </p>

        {mat &&
          [18, 24, 32].map((t) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ color: '#4a5163', fontSize: 11, width: 34, fontVariantNumeric: 'tabular-nums' }}>
                {t}px
              </span>
              {BOCETOS.map((b) => (
                <Medalla key={b.clave} boceto={b} material={mat} tam={t} />
              ))}
            </div>
          ))}

        {/* ---- en su lugar ---- */}
        <h2 style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#8a93a8', margin: '44px 0 16px' }}>
          Al lado del nombre
        </h2>
        <div style={{ border: '1px solid #1d2230', borderRadius: 14, padding: 18, maxWidth: 420 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44, height: 44, borderRadius: 999, background: '#1d2230',
                display: 'grid', placeItems: 'center', color: '#8a93a8', fontSize: 16,
              }}
            >
              A
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 17 }}>condezuzu</span>
                {/* DOS Y NO CINCO: con el umbral puesto, tener las cinco por
                    encima de la mitad es raro. Así se ve lo que se va a ver. */}
                <Medalla boceto={BOCETOS[0]} material={MATERIALES[0]} tam={18} />
                <Medalla boceto={BOCETOS[2]} material={MATERIALES[1]} tam={18} />
              </div>
              <div style={{ color: '#4a5163', fontSize: 12, marginTop: 2 }}>racha de 34 días</div>
            </div>
          </div>
        </div>

        {/* ---- la frase ---- */}
        <h2 style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#8a93a8', margin: '44px 0 8px' }}>
          Al tocar una
        </h2>
        <div
          style={{
            border: '1px solid #2a3040',
            borderRadius: 12,
            padding: 16,
            background: '#0b0d13',
            maxWidth: 340,
          }}
        >
          <div style={{ fontSize: 16, color: '#e8ecf6' }}>{frase(cuantos)}</div>
        </div>
        <p style={{ color: '#4a5163', fontSize: 12, lineHeight: 1.6, maxWidth: 640, marginTop: 12 }}>
          Una sola línea. Es impersonal a propósito: así sirve igual en tu perfil y en el de un
          amigo, sin cambiar una letra.
        </p>
      </div>
    </div>
  );
}

/**
 * Una medalla: un cuerpo con cara oscura y lado iluminado, y la constelación
 * del gesto encima.
 *
 * SIN DEGRADADOS, dos capas planas. Un `id` de gradiente repetido en una
 * lista es un error que el navegador resuelve callado y mal, y estas se
 * dibujan varias veces en la misma fila (ver `compartido/insignias.ts`).
 */
function Medalla({ boceto, material, tam }: { boceto: Boceto; material: Material; tam: number }) {
  const { puntos, lineas, estrellas, faro } = boceto;
  const chica = tam < 40;
  // El punto no escala linealmente: a 18 px un radio proporcional desaparece,
  // así que abajo se le da un piso.
  const r = chica ? 1.5 : 1.15;

  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" style={{ flex: 'none', display: 'block' }} aria-hidden>
      <circle cx="12" cy="12" r="11" fill={material.apagado} />
      {/* El lado iluminado: lo que separa un objeto de una figura plana. */}
      <path d="M12 1 a11 11 0 0 1 0 22 a8.5 11 0 0 0 0 -22 z" fill={material.principal} />

      {lineas.map(([a, b], i) => (
        <line
          key={i}
          x1={puntos[a][0]}
          y1={puntos[a][1]}
          x2={puntos[b][0]}
          y2={puntos[b][1]}
          stroke={material.claro}
          strokeWidth={chica ? 1.1 : 0.75}
          strokeLinecap="round"
          opacity={0.8}
        />
      ))}
      {/* SOLO LOS VÉRTICES QUE SON ESTRELLAS llevan punto. En el cielo pasa
          lo mismo: una constelación tiene cuatro o cinco estrellas brillantes
          y el resto es la línea que las une. Un punto en cada esquina de un
          contorno de doce lados da una masa de puntos, no una figura. */}
      {estrellas.map((i) => (
        <circle
          key={i}
          cx={puntos[i][0]}
          cy={puntos[i][1]}
          r={i === faro ? r * 1.7 : r}
          fill={material.claro}
        />
      ))}

      {/* El borde, que es lo que la despega del fondo cuando es chica. */}
      <circle cx="12" cy="12" r="11" fill="none" stroke={material.claro} strokeWidth="0.6" opacity={0.35} />
    </svg>
  );
}
