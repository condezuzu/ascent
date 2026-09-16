'use client';

// BANCO DE PRUEBAS DE LA PANTALLA DE ENTRADA. No está enlazada desde la app y
// no crea ninguna cuenta: se entra a mano por /galeria/bienvenida, igual que
// /galeria para el motor.
//
// MONTA LA PANTALLA DE VERDAD (`components/bienvenida/Bienvenida.tsx`) con los
// controles al costado: lo que se mira acá es exactamente lo que ve alguien
// que abre la app por primera vez, y no una copia que se va a ir separando.
//
// Para qué: la entrada se ve UNA vez en la vida de un usuario, así que sin
// esto no hay forma de mirarla dos veces seguidas, ni de ver la cuarta
// pantalla sola, ni de congelarla en un segundo, ni de saber qué pasa en un
// equipo donde el motor no carga.

import { useCallback, useState } from 'react';
import Bienvenida from '@/components/bienvenida/Bienvenida';
import {
  DURACION_S,
  PASOS_DE_LA_ENTRADA,
  particulasPara,
  pixelesPara,
  type NivelDeEquipo,
} from '@/lib/bienvenida';
import { N } from '@/lib/subida';

export default function BancoDeBienvenida() {
  const [paso, setPaso] = useState(0);
  const [corrida, setCorrida] = useState(0);
  const [velocidad, setVelocidad] = useState(1);
  const [sinMotor, setSinMotor] = useState(false);
  const [quieta, setQuieta] = useState(false);
  const [congelada, setCongelada] = useState<number | null>(null);
  const [nivel, setNivel] = useState<NivelDeEquipo>('alto');
  // Los controles se pliegan: la pantalla tiene que verse entera, con su pie.
  const [abiertos, setAbiertos] = useState(true);
  // Qué eligió al final, para saber que los botones hacen algo.
  const [eleccion, setEleccion] = useState<string | null>(null);

  const reiniciar = useCallback((a = 0) => {
    setEleccion(null);
    setPaso(a);
    setCorrida((n) => n + 1);
  }, []);

  return (
    <div className={`banco ${abiertos ? 'banco-con-controles' : ''}`}>
      <Bienvenida
        key={`${corrida}-${velocidad}-${sinMotor}-${quieta}-${nivel}`}
        paso={paso}
        alPaso={setPaso}
        velocidad={velocidad}
        sinMotor={sinMotor}
        quieta={quieta}
        congelada={congelada}
        nivel={nivel}
        alSalir={(destino) => setEleccion(destino)}
      />

      <button className="banco-plegar" onClick={() => setAbiertos((v) => !v)}>
        {abiertos ? 'Ocultar controles' : 'Controles'}
      </button>

      <div className={`banco-controles ${abiertos ? '' : 'plegado'}`}>
        <div className="banco-fila">
          <b>Pantalla</b>
          {PASOS_DE_LA_ENTRADA.map((p, i) => (
            <button key={p} className={i === paso ? 'activo' : ''} onClick={() => reiniciar(i)}>
              {i + 1}
            </button>
          ))}
          <button onClick={() => reiniciar(paso)}>Repetir</button>
          <button onClick={() => reiniciar(3)}>Solo la animación</button>
        </div>

        <div className="banco-fila">
          <b>Velocidad</b>
          {[0.25, 0.5, 1, 2].map((v) => (
            <button key={v} className={v === velocidad ? 'activo' : ''} onClick={() => setVelocidad(v)}>
              {v}×
            </button>
          ))}
          <button className={sinMotor ? 'activo' : ''} onClick={() => setSinMotor((v) => !v)}>
            Sin motor
          </button>
          <button className={quieta ? 'activo' : ''} onClick={() => setQuieta((v) => !v)}>
            Reducir movimiento
          </button>
        </div>

        <div className="banco-fila">
          <b>Congelar</b>
          <button className={congelada === null ? 'activo' : ''} onClick={() => setCongelada(null)}>
            Correr
          </button>
          <input
            type="range"
            min={0}
            max={Math.round(DURACION_S * 100)}
            step={5}
            value={congelada === null ? 0 : Math.round(congelada * 100)}
            onChange={(e) => setCongelada(Number(e.target.value) / 100)}
            aria-label="Segundo de la animación"
            style={{ flex: 1, minWidth: 120 }}
          />
          <span className="banco-nota">{congelada === null ? '—' : `${congelada.toFixed(2)} s`}</span>
        </div>

        <div className="banco-fila">
          <b>Equipo</b>
          {(['alto', 'medio', 'bajo'] as const).map((x) => (
            <button key={x} className={x === nivel ? 'activo' : ''} onClick={() => setNivel(x)}>
              {x} · {particulasPara(x, N)} · {pixelesPara(x, 2)}×
            </button>
          ))}
        </div>
        <p className="banco-nota">
          {eleccion
            ? `Eligió "${eleccion}". En la app, eso abre el formulario en ese modo.`
            : 'La pantalla es la de verdad: la misma que ve alguien que abre la app por primera vez.'}
        </p>
      </div>
    </div>
  );
}
