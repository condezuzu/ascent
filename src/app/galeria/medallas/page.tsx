'use client';

// LAS MEDALLAS POR MARCA, en el banco de trabajo. Se entra a mano por
// /galeria/medallas.
//
// DIBUJA CON EL MÓDULO DE VERDAD. Mientras fue un boceto tuvo su propia copia
// de la geometría; cuando la medalla se construyó, esa copia pasó a ser un
// segundo original que se iba a separar del primero al primer retoque. Ahora
// pide los mismos trazos que el perfil (`compartido/medallas.ts`) con el mismo
// componente (`@/components/Medalla`), así que lo que se ve acá es lo que hay.
//
// PARA QUÉ SIGUE EXISTIENDO: para mirar las cinco juntas, a cualquier tamaño y
// con cualquier material, sin tener que levantar la marca que las gana. Es el
// mismo argumento del botón de diagnóstico de la subida de rango — lo que solo
// se puede ver una vez cada mucho no se puede ajustar.

import { useState } from 'react';
import Medalla from '@/components/Medalla';
import { MATERIALES } from '@compartido/medallas';
import {
  CORTES,
  UMBRAL,
  ZONAS_DE_GALAXIA,
  ZONAS_MEDALLA,
  cuantosLevantan,
  materialDe,
  type ClaveMaterial,
} from '@nucleo/medallas';
import { T } from '@nucleo/textos';

const TAMANOS = [18, 24, 32, 44];

const DONDE = [
  ['hombros', 'arriba del todo, ancho'],
  ['brazos', 'por los costados, dos cadenas que bajan'],
  ['pecho', 'al centro, una barra horizontal'],
  ['espalda', 'al centro, una V — y la figura de espaldas'],
  ['piernas', 'abajo, dos cadenas que bajan'],
] as const;

export default function Medallas() {
  const [percentil, setPercentil] = useState(72);
  const [lasTres, setLasTres] = useState(false);
  const material: ClaveMaterial | null = lasTres ? 'galaxia' : materialDe(percentil);

  return (
    <div style={{ minHeight: '100vh', background: '#05060a', color: '#e8ecf6', padding: '28px 20px 80px' }}>
      <div style={{ maxWidth: 940, margin: '0 auto' }}>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#8a93a8' }}>
          Medallas · constelación
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 300, margin: '8px 0 6px' }}>Medallas por marca</h1>
        <p style={{ color: '#8a93a8', fontSize: 14, lineHeight: 1.6, maxWidth: 660 }}>
          La figura es <strong>la misma en todas</strong>, en estrellas apagadas. Lo que cambia es{' '}
          <strong>dónde brilla</strong>. Así la silueta deja de tener que cargar el significado, que
          era el problema: una pierna tiene una forma propia y un tronco no.
        </p>

        {/* ---- dónde cae la luz ---- */}
        <div
          style={{
            border: '1px solid #2a3040', borderRadius: 14, padding: '16px 18px',
            marginTop: 22, maxWidth: 660, background: '#0b0d13',
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#8a93a8' }}>
            Dónde cae la luz
          </div>
          <div
            style={{
              display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px',
              margin: '12px 0 0', fontSize: 13, lineHeight: 1.5,
            }}
          >
            {DONDE.map(([z, donde]) => (
              <div key={z} style={{ display: 'contents' }}>
                <span style={{ color: '#e8ecf6' }}>{T.medallas.zonas[z]}</span>
                <span style={{ color: '#8a93a8' }}>{donde}</span>
              </div>
            ))}
          </div>
          <p style={{ color: '#4a5163', fontSize: 12, lineHeight: 1.6, margin: '14px 0 0' }}>
            Cinco lugares distintos del disco, que es lo que sobrevive al achique: a 18 px no se lee
            la forma, pero sí dónde está la mancha.
          </p>
        </div>

        {/* ---- el percentil y los materiales ---- */}
        <div style={{ marginTop: 28, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#8a93a8' }}>
            Percentil
          </span>
          <input
            type="range"
            min={1}
            max={99}
            value={percentil}
            onChange={(e) => {
              setLasTres(false);
              setPercentil(Number(e.target.value));
            }}
            style={{ width: 260, accentColor: material ? MATERIALES[material].claro : '#4a5163' }}
          />
          <span
            style={{
              fontVariantNumeric: 'tabular-nums',
              color: material ? MATERIALES[material].claro : '#4a5163',
              fontSize: 15,
            }}
          >
            {percentil}%
          </span>
          <span style={{ color: '#4a5163', fontSize: 13 }}>
            {material ? `material: ${T.medallas.materiales[material].toLowerCase()}` : 'sin medalla'}
          </span>
        </div>
        <p style={{ color: '#4a5163', fontSize: 12, lineHeight: 1.6, maxWidth: 660 }}>
          Por debajo del {UMBRAL}% no hay medalla: es para mostrar que sos mejor que la mayoría. Los
          tres cortes —{CORTES.luna}, {CORTES.planeta} y {CORTES.estrella}— son los percentiles que
          publica la propia fuente, no cortes inventados.
        </p>

        <div style={{ display: 'flex', gap: 14, marginTop: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {(['luna', 'planeta', 'estrella'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setLasTres(false);
                setPercentil(Math.min(99, CORTES[m] + 4));
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'center' }}
            >
              <Medalla zona="pecho" material={m} tam={48} />
              <div style={{ color: m === material ? MATERIALES[m].claro : '#4a5163', fontSize: 11, marginTop: 5 }}>
                {T.medallas.materiales[m]}
              </div>
              <div style={{ color: '#4a5163', fontSize: 10 }}>{CORTES[m]}%+</div>
            </button>
          ))}
          {/* La galaxia no es un escalón más de la misma escalera: no tiene
              "desde", tiene una condición. Por eso va separada. */}
          <div style={{ width: 1, alignSelf: 'stretch', background: '#1d2230', margin: '0 8px' }} />
          <button
            onClick={() => {
              setLasTres(!lasTres);
              if (!lasTres) setPercentil(96);
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'center' }}
          >
            <Medalla zona="pecho" material="galaxia" tam={48} />
            <div style={{ color: lasTres ? MATERIALES.galaxia.claro : '#4a5163', fontSize: 11, marginTop: 5 }}>
              {T.medallas.materiales.galaxia}
            </div>
            <div style={{ color: '#4a5163', fontSize: 10 }}>las tres</div>
          </button>
        </div>

        <div
          style={{
            border: '1px solid #2a3040', borderRadius: 14, padding: '16px 18px',
            marginTop: 20, maxWidth: 660, background: '#0b0d13',
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#c98b6b' }}>
            La galaxia no es un percentil
          </div>
          <p style={{ color: '#8a93a8', fontSize: 13, lineHeight: 1.6, margin: '8px 0 0' }}>
            <strong>El 99 no existe en la fuente</strong>: publica cinco puntos —5, 20, 50, 80 y 95—
            y 95 es el último. Y no falta un dato:{' '}
            <code style={{ color: '#c4c2ba' }}>ubicar()</code> corta en 95 a propósito, porque «la
            tabla no tiene con qué separar al 96 del 99,9». Con esta fuente, el 1% no se puede saber.
          </p>
          <p style={{ color: '#8a93a8', fontSize: 13, lineHeight: 1.6, margin: '10px 0 0' }}>
            Así que se gana por otro eje, que sí es un hecho nuestro:{' '}
            <strong>estrella en las tres</strong> —
            {ZONAS_DE_GALAXIA.map((z) => T.medallas.zonas[z].toLowerCase()).join(', ')}—. Es más raro
            que cualquier 95 suelto porque es los tres a la vez, y la metáfora sale sola: una galaxia
            es un montón de estrellas.
          </p>
        </div>

        {/* ---- las cinco ---- */}
        <h2 style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#8a93a8', margin: '40px 0 16px' }}>
          Las cinco zonas
        </h2>
        {!material ? (
          <p style={{ color: '#4a5163', fontSize: 14 }}>
            Por debajo del {UMBRAL}% no hay medalla. Subí el deslizador.
          </p>
        ) : (
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {ZONAS_MEDALLA.map((z) => (
              <div
                key={z}
                style={{ border: '1px solid #1d2230', borderRadius: 14, padding: 16, textAlign: 'center', width: 172 }}
              >
                <Medalla zona={z} material={material} tam={140} />
                <div style={{ fontSize: 16, marginTop: 12 }}>{T.medallas.zonas[z]}</div>
              </div>
            ))}
          </div>
        )}

        {/* ---- EL TAMAÑO DE VERDAD ---- */}
        <h2 style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#8a93a8', margin: '44px 0 8px' }}>
          Al tamaño de verdad
        </h2>
        <p style={{ color: '#8a93a8', fontSize: 13, lineHeight: 1.6, maxWidth: 660, marginBottom: 18 }}>
          Aquí se decide: 18 px es donde viven, al lado del nombre. La apuesta del camino es que{' '}
          <strong>la luz sobrevive al achique y la línea no</strong>, así que el cielo se va apagando
          a medida que la medalla se achica y abajo queda solo la luz. En rampa y no en un corte —con
          un corte, dos tamaños de la misma medalla parecían de dos familias—.
        </p>

        {material &&
          TAMANOS.map((t) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <span style={{ color: '#4a5163', fontSize: 11, width: 34, fontVariantNumeric: 'tabular-nums' }}>
                {t}px
              </span>
              {ZONAS_MEDALLA.map((z) => (
                <Medalla key={z} zona={z} material={material} tam={t} />
              ))}
            </div>
          ))}

        {/* ---- al lado del nombre ---- */}
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
              <span style={{ fontSize: 17 }}>condezuzu</span>
              {/* TRES Y NO CINCO: con el umbral puesto, estar arriba de la
                  mitad en las cinco es raro. Así se ve lo que se va a ver. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                <Medalla zona="hombros" material="luna" tam={18} />
                <Medalla zona="pecho" material="planeta" tam={18} />
                <Medalla zona="piernas" material="estrella" tam={18} />
              </div>
              <div style={{ color: '#4a5163', fontSize: 12, marginTop: 4 }}>racha de 34 días</div>
            </div>
          </div>
        </div>

        {/* ---- al tocar ---- */}
        <h2 style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#8a93a8', margin: '44px 0 8px' }}>
          Al tocar una
        </h2>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ border: '1px solid #2a3040', borderRadius: 12, padding: 16, background: '#0b0d13', maxWidth: 340 }}>
            <div style={{ color: '#8a93a8', fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 5 }}>
              Press de banca
            </div>
            <div style={{ fontSize: 14, color: '#e8ecf6' }}>{T.medallas.frase(cuantosLevantan(percentil))}</div>
          </div>
          <div style={{ border: '1px solid #2a3040', borderRadius: 12, padding: 16, background: '#0b0d13', maxWidth: 340 }}>
            {/* La galaxia NO lleva el rótulo del ejercicio arriba: la línea ya
                nombra los tres y el rótulo repetiría uno. */}
            <div style={{ fontSize: 14, color: '#e8ecf6' }}>{T.medallas.galaxia}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
