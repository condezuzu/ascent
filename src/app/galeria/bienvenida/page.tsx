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
import Cielo from './Cielo';
import Registro from './Registro';
import Objetos from './Objetos';

type Juego = {
  nombre: string;
  idea: string;
  pantallas: { titulo: string; bajada: string }[];
  cierre: string;
  crear: string;
  entrar: string;
};

/**
 * LOS TEXTOS. El humano eligió el juego C (15/9) y descartó A y B: "es el
 * único que no podría estar en cualquier app de gimnasio". Lo que queda para
 * elegir es el título de la tercera, que era el flojo, y la línea del final.
 *
 * LA REGLA: nada de prometer resultados físicos ni cambios de vida. Todo lo
 * que se dice acá lo hace la app.
 *
 * Son borradores y por eso viven en esta pantalla y no en `nucleo/textos.ts`:
 * se mudan cuando se elige.
 */
const BASE: { titulo: string; bajada: string }[] = [
  {
    // "Empiezas desde el polvo" y no "siendo polvo": es un punto de partida,
    // no una descripción de quién sos.
    titulo: 'Empiezas desde el polvo',
    bajada: 'Cada día que entrenas, algo se junta. Y lo que se junta cambia de forma.',
  },
  {
    titulo: 'Se anota todo',
    bajada: 'Los días, las series y los pesos. Lo que hiciste queda, no se recuerda.',
  },
  {
    titulo: '',
    bajada: 'Tus amigos ven tu racha, tú la de ellos, y el universo entero está en la lista.',
  },
  { titulo: '', bajada: '' },
];

/** Las opciones para el título de la tercera: el que no convencía. */
const TITULOS_3 = [
  'Que se vea',
  'Mostrá lo que llevas',
  'Alguien más está entrenando ahora',
  'Tu racha no es solo tuya',
];

/** Y para la línea sobre el negro, antes de los botones. */
const CIERRES = [
  'Inicia sesión y empieza tu viaje',
  'Tu viaje empieza en el polvo',
  'Todo esto empieza con un día',
];

const JUEGOS: Juego[] = TITULOS_3.map((titulo, i) => ({
  nombre: `Título 3 · ${titulo.split(' ').slice(0, 2).join(' ')}`,
  idea: `Tercera pantalla: "${titulo}". Cierre: "${CIERRES[i % CIERRES.length]}".`,
  pantallas: BASE.map((p, n) => (n === 2 ? { ...p, titulo } : p)),
  cierre: CIERRES[i % CIERRES.length],
  crear: 'Crear cuenta',
  entrar: 'Ya tengo cuenta',
}));

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
      {/* EL FONDO. Las tres primeras no pueden ser texto sobre negro (15/9):
          el cielo está desde el primer cuadro y no espera al motor. La
          segunda suma la lista de ejercicios que termina en estrellas, y la
          tercera, los objetos de otras rachas flotando lejos. */}
      {!ultima && <Cielo paso={paso} quieto={quieta} />}
      {paso === 1 && <Registro key={`reg-${paso}`} quieto={quieta} />}
      {paso === 2 && <Objetos quieto={quieta} />}
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
            {/* Sobre el negro, antes de los botones: la línea que dice para
                qué es el formulario que viene. */}
            <p className="bienv-cierre">{textos.cierre}</p>
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

      {/* LA RACHA, TRAGADA: no se desvanece, se va PARA ADENTRO. Se encoge
          hacia el centro del agujero, se estira un poco en el camino y se
          apaga recién al final. Lo que se traga es el dato que venía subiendo
          toda la animación. */}
      <div
        className="bienv-racha"
        style={{
          opacity: Math.max(0, 1 - cuadro.tragoRacha * 1.15),
          transform: `translate3d(0, ${cuadro.tragoRacha * 26}vh, 0) scale(${1 - cuadro.tragoRacha * 0.88})`,
          filter: cuadro.tragoRacha > 0 ? `blur(${cuadro.tragoRacha * 3}px)` : undefined,
        }}
      >
        <span className="bienv-numero">{cuadro.racha}</span>
        <span className="bienv-rotulo">Racha</span>
      </div>

      {/* Y DESPUÉS, LA CÁMARA. El negro no aparece encima: CRECE desde el
          centro, que es donde está el agujero, hasta pasar por encima de quien
          mira. Termina en negro puro, que es el fondo del formulario: la
          animación no corta en ningún lado. */}
      <div
        className="bienv-trago"
        style={{
          background: `radial-gradient(circle at 50% 50%, #000 ${cuadro.trago * 115}%, rgba(0,0,0,0) ${cuadro.trago * 115 + 14}%)`,
          opacity: cuadro.trago > 0 ? 1 : 0,
        }}
      />
    </div>
  );
}
