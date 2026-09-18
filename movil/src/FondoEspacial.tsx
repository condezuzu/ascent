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
import type { Montaje, OpcionesFondo } from '@compartido/motor/escena';
import { eventos } from '@compartido/eventos';
import { PULSO } from '@nucleo/pulso';
import { veloDeRango } from '@nucleo/atmosfera';
import { FONDO_BASE, FONDO_RANGO_8 } from '@nucleo/paletas';
import { cargarElMotor, esPreferenciaFondo } from '@nucleo/fondo';
import { plataforma } from '@plataforma';

/**
 * EL FONDO DE LA APP NATIVA: el motor de cuerpos celestes detrás de todo.
 *
 * Es el MISMO motor que el de la web; esto es el marco. Tres capas, igual que
 * allá: una base de color que se ve al instante, el `GLView` que entra con un
 * fundido cuando el motor está listo, y un velo oscuro arriba que sostiene la
 * legibilidad.
 *
 * LO QUE FALTA RESPECTO DE LA WEB, a la vista:
 *
 *   - Los degradados. En la web la base y el velo llevan degradados radiales
 *     teñidos por la paleta; React Native no tiene degradados sin sumar una
 *     dependencia, y acá son planos. Es una diferencia que se VE, y va con
 *     foto al lado de la web antes de decidir si se iguala.
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

export default function FondoEspacial(op: OpcionesFondo & { atmosfera?: boolean }) {
  // `null` = todavía no se sabe si hay que cargar el motor. Mientras tanto se
  // ve la base, que es lo mismo que se ve si la respuesta es "no".
  const [cargar, setCargar] = useState<boolean | null>(null);
  const [animar, setAnimar] = useState(op.animar !== false);
  const opacidad = useRef(new Animated.Value(0)).current;

  const caja = useRef(Dimensions.get('window'));
  // El `GLView` se crea recién con la medida de verdad: su buffer se fija al
  // crearse, y crearlo con el tamaño de la ventana para después achicarlo
  // dejaría un buffer que no coincide con la vista.
  const [medida, setMedida] = useState<{ w: number; h: number } | null>(null);
  const oyentesDeTamano = useRef(new Set<() => void>());
  const montaje = useRef<Montaje | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [pref, reducir] = await Promise.all([
        plataforma.almacenamiento.leer(CLAVE_FONDO),
        AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
      ]);
      if (!vivo) return;
      setAnimar(op.animar !== false && !reducir);
      // `null` en "equipo flojo": en el teléfono no hay de dónde leerlo. La
      // regla de `nucleo/fondo.ts` es que no saber NO es flojo.
      setCargar(cargarElMotor(esPreferenciaFondo(pref) ? pref : 'auto', null));
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El impacto de registrar el día llega por el bus, igual que en la web.
  useEffect(() => eventos.escuchar(PULSO, () => montaje.current?.pulso()), []);

  const clave = claveDeEscena(op, animar);

  // Cada escena se suelta cuando deja de ser la actual. El `GLView` se vuelve
  // a crear con la `key` —su contexto de GL muere con él—, pero lo que armó el
  // motor adentro (geometrías, materiales, escuchas) hay que soltarlo a mano.
  useEffect(() => {
    return () => {
      montaje.current?.soltar();
      montaje.current = null;
      opacidad.setValue(0);
    };
  }, [clave, opacidad]);

  const alCrearContexto = async (gl: ExpoWebGLRenderingContext) => {
    // EL MOTOR ESPERA A QUE LA PANTALLA ESTÉ QUIETA: es el equivalente del
    // `requestIdleCallback` de la web. Primero se ve la racha; el fondo
    // después.
    await new Promise<void>((r) => InteractionManager.runAfterInteractions(() => r()));
    const { montarEnGL } = await import('./motorNativo');
    const m = montarEnGL(
      gl,
      {
        tamano: () => ({ w: caja.current.width, h: caja.current.height }),
        alCambiar: (fn) => {
          oyentesDeTamano.current.add(fn);
          return () => oyentesDeTamano.current.delete(fn);
        },
      },
      { ...op, animar }
    );
    if (!m) return;
    montaje.current = m;
    Animated.timing(opacidad, { toValue: 1, duration: 900, useNativeDriver: true }).start();
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

  const fondo = op.rango === 8 ? FONDO_RANGO_8 : FONDO_BASE;
  // Prioridad igual que en la web, menos el velo animado entre visitas.
  const velo = op.atmosfera ? veloDeRango(op.rango) : op.rango >= 5 ? 0.62 : 0.5;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: fondo }]} pointerEvents="none" onLayout={alMedir}>
      {cargar && vistaGL && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacidad }]}>
          <GLView key={clave} style={vistaGL} onContextCreate={alCrearContexto} />
        </Animated.View>
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fondo, opacity: velo }]} />
    </View>
  );
}
