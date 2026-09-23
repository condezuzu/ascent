'use client';

// BOCETOS DE LAS MEDALLAS POR MARCA. No está construido: es para mirar y
// elegir. Se entra a mano por /galeria/medallas.
//
// LOS TRES CAMINOS ESTÁN DIBUJADOS CON LOS MISMOS DATOS (`bocetos.ts`), así
// que lo que se compara es el CAMINO y no cinco dibujos distintos.
//
// Y SE MIRAN A LOS TRES TAMAÑOS, porque la recta final de esto es 18 px al
// lado de un nombre: la receta de `compartido/insignias.ts` dice que la
// decisión se toma mirando el tamaño real, no el grande. Un dibujo que a 96
// se ve precioso y a 18 es una mancha no sirve, y eso no se ve hasta ponerlo.

import { useState } from 'react';
import { BOCETOS, MATERIALES, materialDe, type Boceto, type Material } from './bocetos';

type Camino = 'constelacion' | 'transito' | 'grabado';

const CAMINOS: { clave: Camino; nombre: string; que: string }[] = [
  {
    clave: 'constelacion',
    nombre: 'A · Constelación',
    que: 'Puntos unidos por líneas finas sobre la cara oscura. Es el precedente histórico: poner figuras humanas en el cielo es lo más viejo que se hizo con un cielo.',
  },
  {
    clave: 'transito',
    nombre: 'B · Tránsito',
    que: 'La figura como sombra maciza cruzando un disco encendido. La silueta aparece por lo que falta, igual que un planeta pasando delante de su estrella.',
  },
  {
    clave: 'grabado',
    nombre: 'C · Grabado',
    que: 'La figura como una línea de luz sobre la superficie del cuerpo, con el disco entero apagado. La más silenciosa de las tres.',
  },
];

export default function Medallas() {
  const [camino, setCamino] = useState<Camino>('constelacion');
  const [percentil, setPercentil] = useState(50);
  const mat = materialDe(percentil);

  return (
    <div style={{ minHeight: '100vh', background: '#05060a', color: '#e8ecf6', padding: '28px 20px 80px' }}>
      <div style={{ maxWidth: 940, margin: '0 auto' }}>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#8a93a8' }}>
          Bocetos
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 300, margin: '8px 0 6px' }}>Medallas por marca</h1>
        <p style={{ color: '#8a93a8', fontSize: 14, lineHeight: 1.6, maxWidth: 620 }}>
          Nada de esto está construido. El porqué de cada decisión está arriba de{' '}
          <code style={{ color: '#c4c2ba' }}>bocetos.ts</code>.
        </p>

        {/* ---- los tres caminos ---- */}
        <div style={{ display: 'flex', gap: 8, margin: '26px 0 14px', flexWrap: 'wrap' }}>
          {CAMINOS.map((c) => (
            <button
              key={c.clave}
              onClick={() => setCamino(c.clave)}
              style={{
                padding: '9px 16px',
                borderRadius: 10,
                border: '1px solid ' + (camino === c.clave ? '#e8ecf6' : '#2a3040'),
                background: camino === c.clave ? '#e8ecf6' : 'transparent',
                color: camino === c.clave ? '#05060a' : '#c4c2ba',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {c.nombre}
            </button>
          ))}
        </div>
        <p style={{ color: '#8a93a8', fontSize: 13, lineHeight: 1.6, maxWidth: 620, minHeight: 60 }}>
          {CAMINOS.find((c) => c.clave === camino)?.que}
        </p>

        {/* ---- el material, que es lo que dice el nivel ---- */}
        <div style={{ marginTop: 18, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#8a93a8' }}>
            Percentil
          </span>
          <input
            type="range"
            min={1}
            max={99}
            value={percentil}
            onChange={(e) => setPercentil(Number(e.target.value))}
            style={{ width: 240, accentColor: mat.claro }}
          />
          <span style={{ fontVariantNumeric: 'tabular-nums', color: mat.claro, fontSize: 15 }}>
            {percentil}%
          </span>
          <span style={{ color: '#4a5163', fontSize: 13 }}>
            material: {mat.nombre.toLowerCase()}
          </span>
        </div>
        <p style={{ color: '#4a5163', fontSize: 12, lineHeight: 1.6, maxWidth: 620 }}>
          El nivel no agrega cintas ni estrellas: cambia de qué está hecho el cuerpo, por la misma
          escalera que ya sube la app. Los nombres de los materiales existen acá para poder hablar
          de ellos; en la app no se escriben nunca (§7).
        </p>

        {/* ---- la tira de materiales ---- */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          {MATERIALES.map((m) => (
            <button
              key={m.clave}
              onClick={() => setPercentil(Math.min(99, m.desde + (m.desde === 0 ? 10 : 5)))}
              title={`desde el ${m.desde}%`}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'center' }}
            >
              <Medalla boceto={BOCETOS[0]} material={m} camino={camino} tam={46} />
              <div style={{ color: m.clave === mat.clave ? m.claro : '#4a5163', fontSize: 10, marginTop: 4 }}>
                {m.desde}%
              </div>
            </button>
          ))}
        </div>

        {/* ---- las cinco, grandes ---- */}
        <h2 style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#8a93a8', margin: '40px 0 16px' }}>
          Las cinco zonas
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 18 }}>
          {BOCETOS.map((b) => (
            <div
              key={b.clave}
              style={{ border: '1px solid #1d2230', borderRadius: 14, padding: 16, textAlign: 'center' }}
            >
              <Medalla boceto={b} material={mat} camino={camino} tam={96} />
              <div style={{ fontSize: 15, marginTop: 12 }}>{b.zona}</div>
              <div style={{ color: '#4a5163', fontSize: 12, marginTop: 2 }}>{b.pie}</div>
            </div>
          ))}
        </div>

        {/* ---- EL TAMAÑO DE VERDAD, que es donde esto se decide ---- */}
        <h2 style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#8a93a8', margin: '44px 0 8px' }}>
          Al tamaño de verdad
        </h2>
        <p style={{ color: '#8a93a8', fontSize: 13, lineHeight: 1.6, maxWidth: 620, marginBottom: 18 }}>
          Acá se decide. Una medalla que a 96 px se ve preciosa y a 18 es una mancha no sirve, y eso
          no se ve hasta ponerlo al lado de un nombre.
        </p>

        {[18, 24, 32].map((t) => (
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ color: '#4a5163', fontSize: 11, width: 34, fontVariantNumeric: 'tabular-nums' }}>
              {t}px
            </span>
            {BOCETOS.map((b) => (
              <Medalla key={b.clave} boceto={b} material={mat} camino={camino} tam={t} />
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
                {BOCETOS.map((b, i) => (
                  <Medalla
                    key={b.clave}
                    boceto={b}
                    // Cada una con SU material: en un perfil real cada zona
                    // está en un nivel distinto, y eso es lo que hay que poder
                    // leer de un vistazo sin contar nada.
                    material={MATERIALES[[2, 1, 3, 0, 1][i]]}
                    camino={camino}
                    tam={18}
                  />
                ))}
              </div>
              <div style={{ color: '#4a5163', fontSize: 12, marginTop: 2 }}>racha de 34 días</div>
            </div>
          </div>
          <p style={{ color: '#8a93a8', fontSize: 12, lineHeight: 1.6, marginTop: 14, marginBottom: 0 }}>
            Al tocar una: <span style={{ color: '#c4c2ba' }}>Solo el 30% levanta este peso.</span>
          </p>
        </div>

        {/* ---- lo que falta decidir ---- */}
        <h2 style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#8a93a8', margin: '44px 0 12px' }}>
          Lo que hay que decidir
        </h2>
        <ul style={{ color: '#8a93a8', fontSize: 14, lineHeight: 1.8, paddingLeft: 20, maxWidth: 620 }}>
          <li>Cuál de los tres caminos.</li>
          <li>Si core entra o no. Yo digo que no, y el motivo está en `bocetos.ts`.</li>
          <li>
            De dónde sale el percentil. Hoy la única tabla del repo es Strength Level, que es gente
            que anota sus levantamientos en un sitio de fuerza — más fuerte que “gente que va al
            gimnasio de forma normal”.
          </li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Una medalla.
 *
 * LAS TRES FORMAS COMPARTEN EL CUERPO: un disco con cara oscura y lado
 * iluminado, igual que las insignias de rango. Lo único que cambia es cómo
 * aparece la figura encima. Así lo que se compara es el camino y no el dibujo.
 */
function Medalla({
  boceto,
  material,
  camino,
  tam,
}: {
  boceto: Boceto;
  material: Material;
  camino: Camino;
  tam: number;
}) {
  const { puntos, lineas, faro, silueta } = boceto;
  // El punto crece con el tamaño pero no linealmente: a 18 px un radio
  // proporcional desaparece, así que abajo se le da un piso.
  const r = Math.max(0.9, 1.15 * (tam >= 40 ? 1 : 1.25));
  const transito = camino === 'transito';

  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" style={{ flex: 'none', display: 'block' }} aria-hidden>
      {/* EL CUERPO. Dos capas planas y ningún degradado: un `id` de gradiente
          repetido en una lista es un error que el navegador resuelve callado
          y mal (ver la receta en `compartido/insignias.ts`).

          EN TRÁNSITO EL DISCO VA ENCENDIDO ENTERO, y no es un capricho: la
          sombra necesita luz contra la cual recortarse. El primer boceto
          dibujaba la silueta del color de la cara oscura sobre un disco que
          ya tenía esa cara — o sea, negro sobre negro: las cinco medallas
          salían como discos lisos. Se vio poniéndolas, que es para lo que
          existe esta pantalla. */}
      <circle cx="12" cy="12" r="11" fill={transito ? material.claro : material.apagado} />
      {!transito && (
        /* El lado iluminado: lo que separa un objeto de una figura plana. */
        <path d="M12 1 a11 11 0 0 1 0 22 a8.5 11 0 0 0 0 -22 z" fill={material.principal} />
      )}

      {camino === 'constelacion' && (
        <g>
          {lineas.map(([a, b], i) => (
            <line
              key={i}
              x1={puntos[a][0]}
              y1={puntos[a][1]}
              x2={puntos[b][0]}
              y2={puntos[b][1]}
              stroke={material.claro}
              strokeWidth={tam >= 40 ? 0.7 : 1}
              strokeLinecap="round"
              opacity={0.75}
            />
          ))}
          {puntos.map((p, i) => (
            <circle
              key={i}
              cx={p[0]}
              cy={p[1]}
              r={i === faro ? r * 1.7 : r}
              fill={material.claro}
            />
          ))}
        </g>
      )}

      {transito && (
        // La sombra es la cara OSCURA del propio material, no negro puro: así
        // la figura se lee como parte del objeto y no como un agujero
        // recortado con tijera.
        <path d={silueta} fill={material.apagado} />
      )}

      {camino === 'grabado' && (
        <g>
          {lineas.map(([a, b], i) => (
            <line
              key={i}
              x1={puntos[a][0]}
              y1={puntos[a][1]}
              x2={puntos[b][0]}
              y2={puntos[b][1]}
              stroke={material.claro}
              strokeWidth={tam >= 40 ? 1.4 : 1.7}
              strokeLinecap="round"
              opacity={0.9}
            />
          ))}
        </g>
      )}

      {/* El borde, que es lo que la despega del fondo cuando es chica. */}
      <circle
        cx="12"
        cy="12"
        r="11"
        fill="none"
        stroke={transito ? material.apagado : material.claro}
        strokeWidth="0.6"
        opacity={0.35}
      />
    </svg>
  );
}
