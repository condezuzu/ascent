'use client';

// BOCETOS DE LAS MEDALLAS POR MARCA. No está construido: es para mirar y
// elegir. Se entra a mano por /galeria/medallas.
//
// EL CAMINO, ELEGIDO EL 24/9: la figura es siempre la misma y lo que cambia es
// DÓNDE BRILLA. El porqué —y por qué fallaron los dos intentos anteriores—
// está arriba de `bocetos.ts`. Los caminos muertos se sacaron en vez de
// dejarlos comentados: uno que sigue ahí se vuelve a discutir cada vez que
// alguien abre el archivo.
//
// ACÁ SOLO ESTÁN PECHO Y ESPALDA, a propósito. Es el único par que este camino
// no resuelve solo —el mismo cuerpo con la luz casi en el mismo lugar— y si no
// se distinguen, el camino entero no sirve. Dibujar las otras tres antes de
// saberlo sería multiplicar por cinco un error que todavía no se descartó.
//
// SE MIRAN AL TAMAÑO DE VERDAD, porque la recta final de esto es 18 px al lado
// de un nombre: la receta de `compartido/insignias.ts` dice que la decisión se
// toma mirando el tamaño real, no el grande.

import { useState } from 'react';
import {
  COLUMNA,
  LINEAS,
  MAGNITUD,
  MATERIALES,
  POLVO,
  PUNTOS,
  UMBRAL,
  ZONAS,
  frase,
  materialDe,
  type Material,
  type Zona,
} from './bocetos';

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
        <p style={{ color: '#8a93a8', fontSize: 14, lineHeight: 1.6, maxWidth: 660 }}>
          La figura es <strong>la misma en todas</strong>, en estrellas apagadas. Lo que cambia es{' '}
          <strong>dónde brilla</strong>. Así la silueta deja de tener que cargar el significado, que
          era el problema: una pierna tiene una forma propia y un tronco no.
        </p>

        {/* ---- el par difícil, primero ---- */}
        <div
          style={{
            border: '1px solid #2a3040',
            borderRadius: 14,
            padding: '16px 18px',
            marginTop: 22,
            maxWidth: 660,
            background: '#0b0d13',
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#c98b6b' }}>
            Primero el par difícil
          </div>
          <p style={{ color: '#8a93a8', fontSize: 13, lineHeight: 1.6, margin: '8px 0 0' }}>
            Pecho y espalda son el mismo cuerpo con la luz casi en el mismo lugar: es lo único que
            este camino no resuelve solo. Van con <strong>dos señales independientes</strong> —la
            columna, que solo se ve de espaldas, y la forma de la luz: una barra contra una V—. Si no
            se separan, el camino no sirve y las otras tres no se dibujan.
          </p>
        </div>

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
        <p style={{ color: '#4a5163', fontSize: 12, lineHeight: 1.6, maxWidth: 660 }}>
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
              <Medalla zona={ZONAS[0]} material={m} tam={48} />
              <div style={{ color: m.clave === mat?.clave ? m.claro : '#4a5163', fontSize: 11, marginTop: 5 }}>
                {m.nombre}
              </div>
              <div style={{ color: '#4a5163', fontSize: 10 }}>{m.desde}%+</div>
            </button>
          ))}
        </div>

        {/* ---- las dos, grandes ---- */}
        <h2 style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#8a93a8', margin: '40px 0 16px' }}>
          Pecho contra espalda
        </h2>
        {!mat ? (
          <p style={{ color: '#4a5163', fontSize: 14 }}>
            Por debajo del {UMBRAL}% no hay medalla. Subí el deslizador.
          </p>
        ) : (
          <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
            {ZONAS.map((z) => (
              <div
                key={z.clave}
                style={{ border: '1px solid #1d2230', borderRadius: 14, padding: 18, textAlign: 'center', width: 230 }}
              >
                <Medalla zona={z} material={mat} tam={168} />
                <div style={{ fontSize: 16, marginTop: 14 }}>{z.zona}</div>
                <div style={{ color: '#4a5163', fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>{z.pie}</div>
              </div>
            ))}
          </div>
        )}

        {/* ---- EL TAMAÑO DE VERDAD ---- */}
        <h2 style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#8a93a8', margin: '44px 0 8px' }}>
          Al tamaño de verdad
        </h2>
        <p style={{ color: '#8a93a8', fontSize: 13, lineHeight: 1.6, maxWidth: 660, marginBottom: 18 }}>
          Aquí se decide. La apuesta del camino es que <strong>la luz sobrevive al achique y la línea
          no</strong>: la figura se vuelve una bruma y lo que queda legible es dónde está la mancha
          brillante —una barra en el medio contra una V ancha—.
        </p>

        {mat &&
          [18, 24, 32, 44].map((t) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <span style={{ color: '#4a5163', fontSize: 11, width: 34, fontVariantNumeric: 'tabular-nums' }}>
                {t}px
              </span>
              {ZONAS.map((z) => (
                <Medalla key={z.clave} zona={z} material={mat} tam={t} />
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
                <Medalla zona={ZONAS[0]} material={MATERIALES[0]} tam={18} />
                <Medalla zona={ZONAS[1]} material={MATERIALES[1]} tam={18} />
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
          <div style={{ color: '#8a93a8', fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 6 }}>
            Press de banca
          </div>
          <div style={{ fontSize: 16, color: '#e8ecf6' }}>{frase(cuantos)}</div>
        </div>
        <p style={{ color: '#4a5163', fontSize: 12, lineHeight: 1.6, maxWidth: 660, marginTop: 12 }}>
          El ejercicio va arriba y aparte: la frase no se toca, pero sin nombrar la marca la medalla
          mentiría por omisión —el material sale de la mejor de las tres, no de un promedio—.
        </p>
      </div>
    </div>
  );
}

/**
 * Una medalla: un cuerpo con cara oscura y lado iluminado, y encima la
 * constelación, con unas pocas estrellas ardiendo.
 *
 * SIN DEGRADADOS, capas planas. Un `id` de gradiente repetido en una lista es
 * un error que el navegador resuelve callado y mal, y estas se dibujan varias
 * veces en la misma fila (ver `compartido/insignias.ts`).
 */
function Medalla({ zona, material, tam }: { zona: Zona; material: Material; tam: number }) {
  const chica = tam < 40;
  // Nada escala linealmente: a 18 px un radio proporcional desaparece, así que
  // las chicas llevan todo con un piso.
  const k = chica ? 1.9 : 1;
  const encendidas = new Set(zona.encendidas);

  // EL CIELO SE APAGA CUANDO LA MEDALLA ES CHICA, y esto no es un ajuste
  // cosmético: es la premisa del camino llevada hasta el final.
  //
  // A 18 px, treinta y un puntos —diecinueve de la figura más doce de polvo—
  // con el piso de radio que necesitan para no desaparecer NO SON UNA FIGURA:
  // son una mancha moteada, y la luz que tiene que leerse queda enterrada
  // adentro. Se vio poniéndolo.
  //
  // La figura es andamio para el ojo cuando hay lugar; a este tamaño no lo hay
  // y no la mira nadie. Así que a 18 px queda el disco, el borde y LA LUZ: una
  // barra o una V sobre un fondo limpio. Es exactamente lo que decía la apuesta
  // —la luz sobrevive al achique y la línea no— y el dibujo tiene que hacerle
  // caso en vez de discutirle.
  const velo = chica ? 0.25 : 1;

  const linea = (clave: string, [a, b]: readonly [number, number], ancho: number, op: number) => (
    <line
      key={clave}
      x1={PUNTOS[a][0]}
      y1={PUNTOS[a][1]}
      x2={PUNTOS[b][0]}
      y2={PUNTOS[b][1]}
      stroke={material.claro}
      strokeWidth={ancho}
      strokeLinecap="round"
      opacity={op}
    />
  );

  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" style={{ flex: 'none', display: 'block' }} aria-hidden>
      {/* LA CARA ES CIELO, no el color del rango. Ver `noche` en bocetos.ts:
          con la cara clara, las estrellas apagadas se perdían y la figura
          humana no se leía — y sin figura, "dónde brilla" no significa nada. */}
      <circle cx="12" cy="12" r="11" fill={material.noche} />
      {/* El lado iluminado, ahora apenas insinuado: lo que separa un objeto de
          un disco plano, sin robarle contraste a las estrellas. */}
      <path d="M12 1 a11 11 0 0 1 0 22 a8.5 11 0 0 0 0 -22 z" fill={material.apagado} opacity={0.55} />

      {/* EL CAMPO. Va primero y muy apagado: es el cielo del que la
          constelación forma parte, no un adorno encima. */}
      {POLVO.map(([x, y, r], i) => (
        <circle key={`p${i}`} cx={x} cy={y} r={r * k} fill={material.claro} opacity={0.4 * velo} />
      ))}

      {/* Las líneas de la figura UNEN, no dibujan: por eso van tan apagadas. */}
      {LINEAS.map((l, i) => linea(`l${i}`, l, chica ? 0.55 : 0.35, 0.5 * velo))}
      {/* La columna, solo de espaldas. Es lo único distinto entre las cinco. */}
      {zona.deEspaldas && COLUMNA.map((l, i) => linea(`c${i}`, l, chica ? 0.8 : 0.55, 0.8 * velo))}

      {/* Las estrellas apagadas, con magnitudes distintas entre sí. */}
      {PUNTOS.map(([x, y], i) => {
        // El esternón solo existe de frente y la columna solo de espaldas: si
        // se dibujaran los dos siempre, las dos figuras tendrían el mismo
        // punto en el medio y se perdería la señal.
        if (i === 18 && zona.deEspaldas) return null;
        if ((i === 16 || i === 19 || i === 20) && !zona.deEspaldas) return null;
        if (encendidas.has(i)) return null;
        return <circle key={`e${i}`} cx={x} cy={y} r={(MAGNITUD[i] ?? 0.5) * k} fill={material.claro} opacity={0.85 * velo} />;
      })}

      {/* LO QUE ARDE. Las líneas primero, que son las que le dan forma a la
          luz: una barra o una V, y eso se lee antes que los puntos. */}
      {zona.brillo.map((l, i) => linea(`b${i}`, l, chica ? 1.5 : 1, 0.9))}
      {zona.encendidas.map((i) => {
        const [x, y] = PUNTOS[i];
        const r = (i === zona.faro ? 1.35 : 1.05) * k;
        return (
          <g key={`f${i}`}>
            {/* El halo: una estrella brillante no es un punto más grande, es un
                punto con luz alrededor. */}
            <circle cx={x} cy={y} r={r * 2.4} fill={material.claro} opacity={0.18} />
            <circle cx={x} cy={y} r={r} fill={material.claro} />
          </g>
        );
      })}

      {/* El borde, que es lo que la despega del fondo cuando es chica. */}
      <circle cx="12" cy="12" r="11" fill="none" stroke={material.claro} strokeWidth="0.6" opacity={0.35} />
    </svg>
  );
}
