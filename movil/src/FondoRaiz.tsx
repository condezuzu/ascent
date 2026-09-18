import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  InteractionManager,
  PixelRatio,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { LinearGradient } from 'expo-linear-gradient';
import type { WebGLRenderer } from 'three';
import type { Montaje, OpcionesFondo } from '@compartido/motor/escena';
import { eventos } from '@compartido/eventos';
import { PULSO } from '@nucleo/pulso';
import { veloDeRango } from '@nucleo/atmosfera';
import { FONDO_BASE, FONDO_RANGO_8, paletaDe } from '@nucleo/paletas';
import { ELIPSES_BASE, ELIPSES_VELO } from '@compartido/fondoDegradados';
import ElipsesDeLuz from './ElipsesDeLuz';
import { cargarElMotor, esPreferenciaFondo } from '@nucleo/fondo';
import { plataforma } from '@plataforma';
import { conAlfa } from './colores';
import { escucharFondo, type Pedido } from './pedidoDeFondo';

/**
 * EL FONDO DE LA APP NATIVA: el motor de cuerpos celestes detrás de todo.
 *
 * Es el MISMO motor que el de la web; esto es el marco. Tres capas, igual que
 * allá: una base de color, el `GLView` que entra con un fundido cuando el
 * motor está listo, y un velo oscuro arriba que sostiene la legibilidad.
 *
 * VIVE EN LA RAÍZ, NO EN INICIO. Inicio pide el fondo (`FondoEspacial` →
 * `pedidoDeFondo.ts`) y esto lo dibuja. Un solo `GLView`, un solo contexto y
 * un solo renderer para toda la sesión: si el motor viviera adentro de
 * Inicio, cada vuelta a la pestaña crearía un contexto nuevo y recompilaría
 * todos los shaders —medido: 6 shaders y 3 programas por vuelta—.
 *
 * CUANDO NADIE PIDE FONDO la escena no se suelta: se pausa y se esconde.
 * Soltarla borraría los programas de la GPU. Al volver con las mismas
 * opciones —lo normal: mismo día, mismo cuerpo— se reanuda sin armar nada.
 * Si las opciones cambiaron se monta la escena nueva ANTES de soltar la
 * vieja, para que three reuse los programas que ya tiene vivos.
 *
 * LOS BORDES, IGUALES A LA WEB: el degradado vertical que oscurece arriba y
 * abajo (`.velo-bordes`) es lineal, y `expo-linear-gradient` lo reproduce con
 * los mismos cuatro cortes y las mismas opacidades.
 *
 * LAS ELIPSES DE LUZ DE LA BASE Y EL VELO, también iguales (18/9): los números
 * viven en `compartido/fondoDegradados.ts`, de donde los toma la web para su
 * CSS, y acá los dibuja `ElipsesDeLuz` con `react-native-svg`.
 *
 * LO QUE FALTA RESPECTO DE LA WEB, a la vista:
 *
 *   - La animación del velo entre visitas (la "atmósfera" que se abre al subir
 *     de rango). Se pinta el velo del rango, quieto.
 *
 * LO QUE RESPETA IGUAL: la preferencia "Fondo: automático / siempre / nunca"
 * (misma clave, misma decisión de `nucleo/fondo.ts`), el movimiento reducido
 * del sistema, y el pulso de registrar el día.
 */

// La misma clave que la web (`src/lib/fondo.ts`): es la misma preferencia.
const CLAVE_FONDO = 'ascent:fondo';

// EL TOPE DE 2X, igual que la web (`dpr()` en `src/motor/escena.ts`).
//
// Un cuerpo raytraceado a pantalla completa en 3x es lo que calienta un
// teléfono, y la web lo topa a propósito. Acá no se puede pedir menos
// resolución: el buffer de `expo-gl` mide lo que mide la vista, en píxeles
// físicos. Así que se achica la VISTA —a 2/3 en un iPhone de 3x— y se la
// estira con una transformación hasta llenar la pantalla. El motor ve el
// tamaño de verdad y una densidad de 2, y el buffer tiene justo eso.
//
// En pantallas de 2x o menos el factor es 1: no cambia nada.
const DENSIDAD_TOPE = 2;
function factorDeTope() {
  return Math.min(1, DENSIDAD_TOPE / PixelRatio.get());
}

// De qué depende que haya que armar la escena de nuevo. Igual que las
// dependencias del efecto de la web: si cambia cualquiera, el objeto es otro.
function claveDeEscena(op: OpcionesFondo, animar: boolean) {
  return [
    op.rango,
    op.planeta ?? '',
    op.apagado ? 1 : 0,
    op.vacio ? 1 : 0,
    op.reposo ? 1 : 0,
    op.presagio ? 1 : 0,
    op.fantasma?.rango ?? '',
    op.fantasma?.planeta ?? '',
    op.esquina ?? '',
    animar ? 1 : 0,
  ].join('|');
}

type Escena = { clave: string; montaje: Montaje };

export default function FondoRaiz() {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  // El pedido de AHORA, para el montaje asíncrono: si mientras se importaba
  // el motor la pantalla dejó de pedir, la escena nueva nace en pausa.
  const pedidoAhora = useRef<Pedido | null>(null);
  pedidoAhora.current = pedido;
  // El último pedido que hubo: los colores de la base se quedan con él
  // mientras la escena está guardada, para no parpadear al volver.
  const ultimoPedido = useRef<Pedido | null>(null);
  // `null` = todavía no se sabe si hay que cargar el motor.
  const [cargar, setCargar] = useState<boolean | null>(null);
  const [reducir, setReducir] = useState(false);
  const opacidad = useRef(new Animated.Value(0)).current;

  const caja = useRef(Dimensions.get('window'));
  // El `GLView` se crea recién con la medida de verdad: su buffer se fija al
  // crearse, y crearlo con el tamaño de la ventana para después achicarlo
  // dejaría un buffer que no coincide con la vista.
  const [medida, setMedida] = useState<{ w: number; h: number } | null>(null);
  const oyentesDeTamano = useRef(new Set<() => void>());

  const gl = useRef<ExpoWebGLRenderingContext | null>(null);
  const renderer = useRef<WebGLRenderer | null>(null);
  const [listo, setListo] = useState(false);
  const escena = useRef<Escena | null>(null);
  const yaSeVio = useRef(false);

  useEffect(() => escucharFondo(setPedido), []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [pref, r] = await Promise.all([
        plataforma.almacenamiento.leer(CLAVE_FONDO),
        AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
      ]);
      if (!vivo) return;
      setReducir(r);
      // `null` en "equipo flojo": en el teléfono no hay de dónde leerlo. La
      // regla de `nucleo/fondo.ts` es que no saber NO es flojo.
      setCargar(cargarElMotor(esPreferenciaFondo(pref) ? pref : 'auto', null));
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // El impacto de registrar el día llega por el bus, igual que en la web.
  useEffect(() => eventos.escuchar(PULSO, () => escena.current?.montaje.pulso()), []);

  // Al cerrar la sesión la raíz se desmonta: ahí sí se suelta todo.
  useEffect(
    () => () => {
      escena.current?.montaje.soltar();
      escena.current = null;
      renderer.current?.dispose();
      renderer.current = null;
    },
    []
  );

  // LA ESCENA SIGUE AL PEDIDO.
  useEffect(() => {
    if (pedido) ultimoPedido.current = pedido;
    const actual = escena.current;

    if (!pedido || !listo || !renderer.current || !gl.current) {
      // Nadie pide fondo, o el motor todavía no está: se guarda lo que haya.
      actual?.montaje.pausar(true);
      opacidad.setValue(0);
      return;
    }

    const animar = pedido.animar !== false && !reducir;
    const clave = claveDeEscena(pedido, animar);

    if (actual && actual.clave === clave) {
      // Lo normal: la misma escena de la última vez. Se reanuda y listo.
      actual.montaje.pausar(false);
    } else {
      // Otra escena. Primero la nueva, DESPUÉS se suelta la vieja: mientras
      // las dos existen, los programas que comparten siguen vivos y three los
      // reusa en vez de compilarlos otra vez.
      void import('./motorNativo').then(({ montarEscenaEnGL }) => {
        if (!renderer.current || !gl.current) return;
        const m = montarEscenaEnGL(
          renderer.current,
          gl.current,
          {
            tamano: () => ({ w: caja.current.width, h: caja.current.height }),
            alCambiar: (fn) => {
              oyentesDeTamano.current.add(fn);
              return () => oyentesDeTamano.current.delete(fn);
            },
          },
          { ...pedido, animar }
        );
        const vieja = escena.current;
        escena.current = m ? { clave, montaje: m } : null;
        vieja?.montaje.soltar();
        if (!pedidoAhora.current) m?.pausar(true);
      });
    }

    // El fundido de entrada solo la primera vez: al volver a Inicio la
    // escena ya estaba, y hacerla aparecer de a poco otra vez se leería como
    // que se cargó de nuevo.
    if (yaSeVio.current) {
      opacidad.setValue(1);
    } else {
      yaSeVio.current = true;
      Animated.timing(opacidad, { toValue: 1, duration: 900, useNativeDriver: true }).start();
    }
  }, [pedido, listo, reducir, opacidad]);

  const alCrearContexto = async (contexto: ExpoWebGLRenderingContext) => {
    // EL MOTOR ESPERA A QUE LA PANTALLA ESTÉ QUIETA: es el equivalente del
    // `requestIdleCallback` de la web. Primero se ve la racha; el fondo
    // después.
    await new Promise<void>((r) => InteractionManager.runAfterInteractions(() => r()));
    const { crearRenderer } = await import('./motorNativo');
    const r = crearRenderer(contexto);
    if (!r) return;
    gl.current = contexto;
    renderer.current = r;
    setListo(true);
  };

  const alMedir = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    caja.current = { ...caja.current, width, height };
    setMedida({ w: width, h: height });
    for (const fn of oyentesDeTamano.current) fn();
  };

  // La vista del GL, achicada por el tope y estirada de vuelta desde el
  // centro: ocupa exactamente lo mismo que la pantalla.
  const f = factorDeTope();
  const vistaGL = medida && {
    position: 'absolute' as const,
    width: medida.w * f,
    height: medida.h * f,
    left: (medida.w - medida.w * f) / 2,
    top: (medida.h - medida.h * f) / 2,
    transform: [{ scale: 1 / f }],
  };

  const op = pedido ?? ultimoPedido.current;
  // Hasta el primer pedido no se crea nada: ni el contexto ni three.
  if (!op) return null;
  const fondo = op.rango === 8 ? FONDO_RANGO_8 : FONDO_BASE;
  const paleta = paletaDe(op.rango, op.planeta);
  // Prioridad igual que en la web —lo que pidió la pantalla, después lo que
  // dice el rango, después el valor fijo—, menos el velo animado entre visitas.
  const velo = op.velo ?? (op.atmosfera ? veloDeRango(op.rango) : op.rango >= 5 ? 0.62 : 0.5);

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: fondo, opacity: pedido ? 1 : 0 }]}
      pointerEvents="none"
      onLayout={alMedir}
    >
      {medida && (
        <ElipsesDeLuz elipses={ELIPSES_BASE} paleta={paleta} ancho={medida.w} alto={medida.h} estrellas id="base" />
      )}
      {cargar && vistaGL && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacidad }]}>
          <GLView style={vistaGL} onContextCreate={alCrearContexto} />
        </Animated.View>
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fondo, opacity: velo }]}>
        {medida && <ElipsesDeLuz elipses={ELIPSES_VELO} paleta={paleta} ancho={medida.w} alto={medida.h} id="velo" />}
      </View>
      {/* LOS BORDES, lo que sostiene la legibilidad cuando el velo se abre: el
          mismo `.velo-bordes` de la web —fondo al 80 % arriba, nada del 26 % al
          86 %, fondo al 88 % abajo—. Los extremos transparentes son el fondo
          con alfa 0 y no `transparent`: CSS mezcla premultiplicado y acá no,
          y hacia negro transparente el degradado ensuciaría el color. */}
      <LinearGradient
        style={StyleSheet.absoluteFill}
        colors={[conAlfa(fondo, 0.8), conAlfa(fondo, 0), conAlfa(fondo, 0), conAlfa(fondo, 0.88)]}
        locations={[0, 0.26, 0.86, 1]}
      />
    </View>
  );
}
