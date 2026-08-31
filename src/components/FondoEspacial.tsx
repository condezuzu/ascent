'use client';

import { useEffect, useRef, useState } from 'react';
import type { Montaje, OpcionesFondo } from '@/motor/escena';
import { eventos } from '@/plataforma/eventos';
import { PULSO } from '@/lib/pulso';
import { aplicarTema } from '@/lib/paletas';
import { marca, medir, instalarLector } from '@/lib/medir';
import { veloDeRango, msDeTransicion } from '@nucleo/atmosfera';
import { plataforma } from '@/plataforma';
import { hayQueCargarElMotor } from '@/lib/fondo';

// El fondo vive detrás de todo, con un velo plano oscuro entre el render y
// la interfaz. Cuanto más detallado el fondo, más velo.
//
// La interfaz NUNCA espera al motor: el degradado de la paleta se pinta en
// CSS al instante y el canvas entra con un fundido recién cuando está listo.
//
// CON `atmosfera` EL VELO LO DECIDE EL RANGO y se mueve solo entre visitas:
// subir abre la app, perder la racha la vuelve a cerrar. Ver `lib/atmosfera.ts`
// para el porqué. Sin `atmosfera` el velo es el de siempre —una constante— y
// esta pantalla no toca nada de lo que se recuerda entre sesiones.

// El último rango que esta persona VIO, no el que tiene. La diferencia entre
// los dos es toda la animación: si abrís la app un día después de perder la
// racha, el velo arranca donde lo dejaste y se cierra delante tuyo.
const CLAVE_RANGO_VISTO = 'ascent:rango-visto';

export default function FondoEspacial(
  op: OpcionesFondo & { velo?: number; atmosfera?: boolean }
) {
  const ref = useRef<HTMLDivElement>(null);
  // El impacto de registrar el día llega por el bus de eventos: quien lo
  // dispara es la pantalla, y la pantalla no tiene por qué conocer el motor.
  const pulsoRef = useRef<(() => void) | null>(null);
  const [listo, setListo] = useState(false);
  // `null` = todavía no se sabe de dónde viene; se pinta el velo de destino.
  const [veloVivo, setVeloVivo] = useState<number | null>(null);
  const [msVelo, setMsVelo] = useState(0);

  // La paleta se aplica de forma sincrónica, antes de pintar: así el fondo
  // ya sale con el color del rango y no hay salto de gris a color.
  if (typeof document !== 'undefined') aplicarTema(op.rango, op.planeta);

  useEffect(() => {
    aplicarTema(op.rango, op.planeta);
  }, [op.rango, op.planeta]);

  useEffect(() => eventos.escuchar(PULSO, () => pulsoRef.current?.()), []);

  // ---- el velo que se abre y se cierra ----
  useEffect(() => {
    if (!op.atmosfera) return;
    let cancelado = false;

    (async () => {
      const guardado = await plataforma.almacenamiento.leer(CLAVE_RANGO_VISTO);
      if (cancelado) return;

      const antes = Number(guardado);
      const destino = veloDeRango(op.rango);
      const hayDeDonde = Number.isFinite(antes) && antes >= 1 && antes !== op.rango;

      // Con "reducir movimiento" no se anima nada: se pone el velo que
      // corresponde y listo. Una transición de siete segundos es justo lo que
      // esa preferencia pide que no pase.
      const quieto =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (hayDeDonde && !quieto) {
        setMsVelo(0);
        setVeloVivo(veloDeRango(antes));
        // Dos cuadros. El primero PINTA el velo viejo; recién el segundo
        // arranca el viaje. Sin esa pausa el navegador ve un solo cambio de
        // estilo y no hay transición que animar: se vería el corte que
        // justamente no queremos.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (cancelado) return;
            setMsVelo(msDeTransicion(antes, op.rango));
            setVeloVivo(destino);
          })
        );
      } else {
        setMsVelo(0);
        setVeloVivo(destino);
      }

      // Se anota DESPUÉS de haber leído: si se guardara antes, la animación no
      // tendría de dónde salir nunca.
      await plataforma.almacenamiento.guardar(CLAVE_RANGO_VISTO, String(op.rango));
    })();

    return () => {
      cancelado = true;
    };
  }, [op.atmosfera, op.rango]);

  useEffect(() => {
    instalarLector();
    const cont = ref.current;
    if (!cont) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animar = op.animar !== false && !reduceMotion;

    let montaje: Montaje | null = null;
    let cancelado = false;

    // ---- EL MOTOR SE CARGA TARDE, Y A VECES NO SE CARGA ----
    //
    // MEDIDO: three.js cuesta TRES SEGUNDOS de arranque. La racha aparece a
    // los 3619 ms con motor y a los 635 sin él, con 74 kB de diferencia de
    // descarga — o sea que el costo no es bajarlo, es evaluarlo.
    //
    // Y las marcas de acá abajo lo tapaban: `motor-import` daba 0 ms,
    // partículas 1 ms, shaders 9 ms. Esas miden MONTAR la escena; el trabajo
    // caro es evaluar el módulo, y eso pasaba antes, donde no había marca.
    // Nos mandó a mirar al lado equivocado dos veces.
    //
    // Ahora se espera a que el hilo principal esté libre —o sea, a que la app
    // ya se pueda usar— y recién ahí se importa. El fondo de CSS cubre el
    // hueco, que es exactamente para lo que estaba.
    const importar = async () => {
      if (cancelado) return;
      if (!(await hayQueCargarElMotor())) return;
      if (cancelado) return;
      marca('ascent:motor-import-inicio');
      const { montarFondo } = await import('@/motor/escena');
      return montarFondo;
    };

    // ESPERAR A QUE EL HILO ESTÉ LIBRE NO ALCANZA, y lo aprendí midiendo: con
    // solo `requestIdleCallback` el número no se movió ni un poco (3505 ms
    // contra 3619 de antes).
    //
    // La razón es que el hilo SÍ se queda libre tempranísimo: entre el primer
    // pintado (~270 ms) y la vuelta de Supabase (~800 ms) no hay nada que
    // hacer más que esperar la red. El callback disparaba ahí y evaluaba
    // three.js JUSTO en el momento en que llegaban los datos — o sea, en el
    // peor momento posible.
    //
    // Por eso hay además un PISO de tiempo: no se toca el motor antes de los
    // dos segundos, pase lo que pase. Es un número y no una señal fina porque
    // no existe una señal fina: el navegador no avisa "la app ya se puede
    // usar". Dos segundos es holgado contra los ~700 ms que tarda la app en
    // ser usable sin el motor, y el fondo de CSS cubre el hueco entero.
    const PISO_MS = 2000;
    const cuandoHayaLugar = (fn: () => void) => {
      const w = window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void };
      const intentar = () => {
        if (cancelado) return;
        // Si todavía es temprano, se vuelve a agendar en vez de correr: el
        // hilo puede estar libre y la app no estar lista igual.
        if (performance.now() < PISO_MS) {
          setTimeout(intentar, Math.max(120, PISO_MS - performance.now()));
          return;
        }
        fn();
      };
      if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(intentar, { timeout: 2500 });
      else setTimeout(intentar, PISO_MS);
    };

    cuandoHayaLugar(() => {
      importar().then((montarFondo) => {
        if (!montarFondo || cancelado) return;
        marca('ascent:motor-import-fin');
        medir('ascent:motor-import', 'ascent:motor-import-inicio', 'ascent:motor-import-fin');
        marca('ascent:motor-montar-inicio');
        montaje = montarFondo(cont, { ...op, animar });
        pulsoRef.current = montaje?.pulso ?? null;
        marca('ascent:motor-montar-fin');
        medir('ascent:motor-montar', 'ascent:motor-montar-inicio', 'ascent:motor-montar-fin');
        medir('ascent:motor-total', 'ascent:motor-import-inicio', 'ascent:motor-montar-fin');
        if (!cancelado) setListo(true);
      });
    });

    return () => {
      cancelado = true;
      montaje?.soltar();
      pulsoRef.current = null;
      setListo(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    op.rango,
    op.planeta,
    op.apagado,
    op.vacio,
    op.esquina,
    op.reposo,
    op.presagio,
    op.fantasma?.rango,
    op.fantasma?.planeta,
  ]);

  // Prioridad: lo que pidió la pantalla a mano > lo que dice el rango > el
  // viejo valor fijo. Una pantalla que pasa `velo` sigue mandando ella.
  const velo =
    op.velo ?? veloVivo ?? (op.atmosfera ? veloDeRango(op.rango) : op.rango >= 5 ? 0.62 : 0.5);

  return (
    <div className="fondo-espacial" aria-hidden>
      {/* Base en CSS puro: se ve al instante, sin esperar a WebGL */}
      <div className="fondo-base" />
      <div ref={ref} className={`fondo-lienzo ${listo ? 'listo' : ''}`} />
      <div
        className="velo"
        style={{ opacity: velo, transitionDuration: `${msVelo}ms` }}
      />
      {/* Constante en todos los rangos: es lo que sostiene la legibilidad
          cuando el velo de arriba se abre. Ver `.velo-bordes` en globals. */}
      <div className="velo-bordes" />
    </div>
  );
}
