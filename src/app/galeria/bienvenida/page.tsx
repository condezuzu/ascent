'use client';

// BANCO DE PRUEBAS DE LA PANTALLA DE ENTRADA. No está enlazada desde la app y
// no crea ninguna cuenta: se entra a mano por /galeria/bienvenida, igual que
// /galeria para el motor.
//
// Para qué: la entrada se ve UNA vez en la vida de un usuario, así que sin
// esto no hay forma de mirarla dos veces seguidas, ni de ver la cuarta
// pantalla sola, ni de comparar textos, ni de saber qué pasa en un equipo
// donde el motor no carga. Los tres controles de abajo son exactamente esas
// preguntas.
//
// LOS TEXTOS DE ACÁ SON BORRADORES y por eso viven en este archivo y no en
// `nucleo/textos.ts`: son tres juegos para elegir. El elegido se muda a
// `textos.ts` cuando se arme la pantalla de verdad.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cuadroEn,
  cuadroQuietoEn,
  DURACION_S,
  DURACION_QUIETA_S,
  PASOS_DE_LA_ENTRADA,
  RANGOS_DE_LA_ENTRADA,
  type CuadroDeLaEntrada,
} from '@/lib/bienvenida';
import { paletaDe } from '@/lib/paletas';

type Juego = {
  nombre: string;
  idea: string;
  pantallas: { titulo: string; bajada: string }[];
  crear: string;
  entrar: string;
};

// Tres juegos de texto. Ninguno promete resultados físicos ni cambios de vida:
// todos dicen algo que la app hace. Cambia el ÁNGULO, no el contenido.
const JUEGOS: Juego[] = [
  {
    nombre: 'A · Lo que hace',
    idea: 'Describe la app sin adornos. El más seguro: nada que defender.',
    pantallas: [
      { titulo: 'Ascent', bajada: 'Una racha que solo sube si vas.' },
      {
        titulo: 'Anota lo que hiciste',
        bajada: 'El día, las series y el peso de cada una, entre serie y serie.',
      },
      {
        titulo: 'No estás solo entrenando',
        bajada: 'Tu racha al lado de la de tus amigos y la de gente de todo el mundo.',
      },
      { titulo: '', bajada: '' },
    ],
    crear: 'Crear cuenta',
    entrar: 'Ya tengo cuenta',
  },
  {
    nombre: 'B · Aparecer',
    idea: 'La promesa es la constancia, que es lo único que la app puede medir.',
    pantallas: [
      { titulo: 'Aparecer también cuenta', bajada: 'Ascent mide una sola cosa: los días que fuiste.' },
      {
        titulo: 'Tu entrenamiento, anotado',
        bajada: 'Las series se cuentan solas mientras descansas. El peso queda escrito.',
      },
      {
        titulo: 'Con quien quieras',
        bajada: 'Compite con tus amigos, o con gente que no conoces y entrena hoy.',
      },
      { titulo: '', bajada: '' },
    ],
    crear: 'Crear cuenta',
    entrar: 'Ya tengo cuenta',
  },
  {
    nombre: 'C · El objeto',
    idea: 'Habla desde la mecánica: la racha es una cosa que se ve crecer.',
    pantallas: [
      { titulo: 'Empiezas siendo polvo', bajada: 'Cada día que entrenas, algo se junta.' },
      {
        titulo: 'Se anota todo',
        bajada: 'Los días, las series y los pesos. Lo que hiciste queda, no se recuerda.',
      },
      {
        titulo: 'Y se ve desde afuera',
        bajada: 'Tus amigos ven tu racha, tú la de ellos, y el mundo entero está en la lista.',
      },
      { titulo: '', bajada: '' },
    ],
    crear: 'Crear cuenta',
    entrar: 'Ya tengo cuenta',
  },
];

export default function BancoDeBienvenida() {
  const [juego, setJuego] = useState(0);
  const [paso, setPaso] = useState(0);
  const [corrida, setCorrida] = useState(0);
  const [velocidad, setVelocidad] = useState(1);
  const [sinMotor, setSinMotor] = useState(false);
  const [quieta, setQuieta] = useState(false);
  const [terminada, setTerminada] = useState(false);
  // Congelada en un segundo: para mirar un cuadro quieto y para que una
  // captura salga siempre igual.
  const [congelada, setCongelada] = useState<number | null>(null);
  const textos = JUEGOS[juego];

  const reiniciar = useCallback((a = 0) => {
    setTerminada(false);
    setPaso(a);
    setCorrida((n) => n + 1);
  }, []);

  return (
    <div className="banco">
      <Entrada
        congelada={congelada}
        key={`${corrida}-${velocidad}-${sinMotor}-${quieta}-${juego}`}
        textos={textos}
        paso={paso}
        alPaso={setPaso}
        velocidad={velocidad}
        sinMotor={sinMotor}
        quieta={quieta}
        terminada={terminada}
        alTerminar={() => setTerminada(true)}
      />

      <div className="banco-controles">
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
          <b>Textos</b>
          {JUEGOS.map((j, i) => (
            <button key={j.nombre} className={i === juego ? 'activo' : ''} onClick={() => setJuego(i)}>
              {j.nombre}
            </button>
          ))}
        </div>
        <p className="banco-nota">{textos.idea}</p>
      </div>
    </div>
  );
}

function Entrada({
  textos,
  congelada,
  paso,
  alPaso,
  velocidad,
  sinMotor,
  quieta,
  terminada,
  alTerminar,
}: {
  textos: Juego;
  congelada: number | null;
  paso: number;
  alPaso: (n: number) => void;
  velocidad: number;
  sinMotor: boolean;
  quieta: boolean;
  terminada: boolean;
  alTerminar: () => void;
}) {
  const ultima = paso === PASOS_DE_LA_ENTRADA.length - 1;
  return (
    <div className={`bienv ${terminada ? 'bienv-negro' : ''}`}>
      {ultima && (
        <Cuarta
          velocidad={velocidad}
          sinMotor={sinMotor}
          quieta={quieta}
          congelada={congelada}
          alTerminar={alTerminar}
        />
      )}

      {!ultima && (
        <div className="bienv-texto" key={paso}>
          <h1>{textos.pantallas[paso].titulo}</h1>
          <p>{textos.pantallas[paso].bajada}</p>
        </div>
      )}

      {/* El pie NO se rearma entre pantallas: el botón se queda quieto y solo
          cambia lo de arriba. Un botón que entra y sale en cada paso es el
          detalle que hace que una entrada se sienta barata. */}
      <div className={`bienv-pie ${terminada ? 'bienv-pie-fin' : ''}`}>
        {terminada ? (
          <>
            <button className="bienv-solido">{textos.crear}</button>
            <button className="bienv-texto-boton">{textos.entrar}</button>
          </>
        ) : (
          <>
            <div className="bienv-puntos">
              {PASOS_DE_LA_ENTRADA.map((p, i) => (
                <span key={p} className={i === paso ? 'vivo' : ''} />
              ))}
            </div>
            {!ultima && (
              <button className="bienv-solido" onClick={() => alPaso(paso + 1)}>
                Siguiente
              </button>
            )}
            <button className="bienv-texto-boton" onClick={() => alPaso(PASOS_DE_LA_ENTRADA.length - 1)}>
              Saltar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * LA CUARTA: el objeto pasando por los ocho rangos mientras sube el número, y
 * el agujero negro tragándose la pantalla.
 *
 * DOS VERSIONES CON LOS MISMOS TIEMPOS. Con motor son las partículas de
 * siempre; sin motor —equipo flojo, WebGL apagado, o el archivo que todavía no
 * bajó— es un cuerpo de CSS que hace el mismo recorrido. La cuenta la hace en
 * los dos casos `lib/bienvenida.ts`, así que el número y el negro llegan
 * exactamente en el mismo instante.
 */
function Cuarta({
  velocidad,
  sinMotor,
  quieta,
  congelada,
  alTerminar,
}: {
  velocidad: number;
  sinMotor: boolean;
  quieta: boolean;
  /** Un segundo fijo de la línea de tiempo, o `null` para que corra. */
  congelada: number | null;
  alTerminar: () => void;
}) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [cuadro, setCuadro] = useState<CuadroDeLaEntrada>(() => cuadroEn(0));
  const [conMotor, setConMotor] = useState(!sinMotor);

  // El reloj: uno solo para las dos versiones. Con motor lo lleva el bucle del
  // render y esto solo pinta el número; sin motor, esto es todo.
  // El segundo congelado, siempre fresco para el bucle del motor, que se monta
  // una sola vez.
  const congeladaRef = useRef(congelada);
  congeladaRef.current = congelada;

  useEffect(() => {
    const dame = quieta ? cuadroQuietoEn : cuadroEn;
    if (congelada !== null) return setCuadro(dame(congelada));
    let vivo = true;
    let pedido = 0;
    const t0 = performance.now();
    const dur = quieta ? DURACION_QUIETA_S : DURACION_S;
    const paso = (ahora: number) => {
      if (!vivo) return;
      const t = ((ahora - t0) / 1000) * velocidad;
      const c = dame(t);
      setCuadro(c);
      if (t >= dur) return alTerminar();
      pedido = requestAnimationFrame(paso);
    };
    pedido = requestAnimationFrame(paso);
    return () => {
      vivo = false;
      cancelAnimationFrame(pedido);
    };
  }, [velocidad, quieta, congelada, alTerminar]);

  useEffect(() => {
    if (sinMotor) return setConMotor(false);
    const canvas = lienzo.current;
    if (!canvas) return;
    let control: { destruir: () => void } | null = null;
    let cancelado = false;
    import('@/motor/bienvenida').then(({ animarEntrada }) => {
      if (cancelado) return;
      control = animarEntrada(canvas, { velocidad, quieta, reloj: () => congeladaRef.current });
      // Sin WebGL devuelve null: se pasa a la versión de CSS en el acto, sin
      // pantalla en blanco de por medio.
      if (!control) setConMotor(false);
    });
    return () => {
      cancelado = true;
      control?.destruir();
    };
  }, [sinMotor, velocidad, quieta]);

  const i = Math.max(0, RANGOS_DE_LA_ENTRADA.indexOf(cuadro.desde as 1));
  const j = Math.max(0, RANGOS_DE_LA_ENTRADA.indexOf(cuadro.hasta as 1));
  const pal = paletaDe(cuadro.mezcla < 0.5 ? cuadro.desde : cuadro.hasta);
  // Sin motor el objeto es un cuerpo de CSS: cambia de tamaño y de color con
  // los mismos tiempos, y el agujero negro lo cierra igual.
  const tam = [34, 26, 40, 54, 78, 86, 96, 88];
  const lado = (tam[i] + (tam[j] - tam[i]) * cuadro.mezcla) * (1 - cuadro.trago);

  return (
    <div className="bienv-cuarta">
      {conMotor ? (
        <canvas ref={lienzo} className="bienv-lienzo" />
      ) : (
        <div
          className={`bienv-cuerpo ${cuadro.hasta === 8 && cuadro.mezcla > 0.5 ? 'bienv-cuerpo-negro' : ''}`}
          style={{
            width: `${lado}vmin`,
            height: `${lado}vmin`,
            background: `radial-gradient(circle at 38% 34%, ${pal.claro}, ${pal.principal} 45%, ${pal.apagado} 72%, transparent 73%)`,
            opacity: 1 - cuadro.trago,
          }}
        />
      )}

      <div className="bienv-racha" style={{ opacity: 1 - cuadro.trago }}>
        <span className="bienv-numero">{cuadro.racha}</span>
        <span className="bienv-rotulo">Racha</span>
      </div>

      {/* El velo que traga: termina en negro puro, que es el fondo de la
          pantalla de sesión. La animación no corta en ningún lado. */}
      <div className="bienv-trago" style={{ opacity: cuadro.trago }} />
    </div>
  );
}
