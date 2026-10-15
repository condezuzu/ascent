import { useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';
import { plataforma } from '@plataforma';
import { T } from '@nucleo/textos';
import { C } from './colores';

/**
 * ARRASTRAR PARA ORDENAR (15/10). Apretar largo levanta la fila como un globito
 * —crece un poco, se despega del fondo y queda arriba de las otras— y sigue al
 * dedo; las demás se corren para hacerle lugar, y al soltar queda ahí.
 *
 * Con lo que trae React Native (PanResponder + Animated): una librería de
 * gestos es código nativo, y eso no viaja por OTA.
 *
 * Las filas tienen todas el mismo `alto`: con eso se sabe sobre cuál está el
 * dedo sin medir nada.
 */
export default function FilasArrastrables<T>({
  filas,
  llave,
  alto,
  dibujar,
  alMover,
  alArrastrar,
  testID,
}: {
  filas: T[];
  llave: (f: T, i: number) => string;
  alto: number;
  dibujar: (f: T, i: number) => ReactNode;
  alMover: (desde: number, hasta: number) => void;
  /** Para que la pantalla apague su scroll mientras se arrastra. */
  alArrastrar?: (si: boolean) => void;
  testID?: string;
}) {
  const [levantada, setLevantada] = useState<number | null>(null);
  const desde = useRef<number | null>(null);
  const destino = useRef(0);
  const yInicial = useRef(0);
  const concedido = useRef(false);
  const dy = useRef(new Animated.Value(0)).current;
  const escala = useRef(new Animated.Value(1)).current;
  // Un corrimiento por fila, para que las otras se aparten con suavidad.
  const corrimientos = useRef<Animated.Value[]>([]);
  while (corrimientos.current.length < filas.length) corrimientos.current.push(new Animated.Value(0));

  function correrLasOtras(d: number, hasta: number) {
    corrimientos.current.forEach((v, i) => {
      if (i === d) return;
      const a = d < i && i <= hasta ? -alto : hasta <= i && i < d ? alto : 0;
      Animated.timing(v, { toValue: a, duration: 140, useNativeDriver: true }).start();
    });
  }

  function soltar(mover: boolean) {
    const d = desde.current;
    if (d === null) return;
    desde.current = null;
    concedido.current = false;
    const hasta = destino.current;
    corrimientos.current.forEach((v) => v.setValue(0));
    dy.setValue(0);
    escala.setValue(1);
    setLevantada(null);
    alArrastrar?.(false);
    if (mover && hasta !== d) alMover(d, hasta);
  }

  function levantar(i: number, e: GestureResponderEvent) {
    desde.current = i;
    destino.current = i;
    yInicial.current = e.nativeEvent.pageY;
    concedido.current = false;
    dy.setValue(0);
    setLevantada(i);
    alArrastrar?.(true);
    plataforma.haptica.pulso();
    Animated.spring(escala, { toValue: 1.04, friction: 6, useNativeDriver: true }).start();
  }

  // El PanResponder nace una vez: lo que cambia con cada render lo lee de acá.
  const ultimo = useRef({ soltar, correrLasOtras, alto, n: filas.length });
  ultimo.current = { soltar, correrLasOtras, alto, n: filas.length };

  const gestos = useRef(
    PanResponder.create({
      // Solo se queda con el dedo DESPUÉS del apretar largo: antes, tocar y
      // deslizar es el scroll de siempre.
      onMoveShouldSetPanResponderCapture: () => desde.current !== null,
      onPanResponderGrant: () => {
        concedido.current = true;
      },
      onPanResponderMove: (_, g) => {
        const d = desde.current;
        if (d === null) return;
        const mov = g.moveY - yInicial.current;
        dy.setValue(mov);
        const u = ultimo.current;
        const hasta = Math.max(0, Math.min(u.n - 1, d + Math.round(mov / u.alto)));
        if (hasta !== destino.current) {
          destino.current = hasta;
          u.correrLasOtras(d, hasta);
        }
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: () => ultimo.current.soltar(true),
      onPanResponderTerminate: () => ultimo.current.soltar(true),
    })
  ).current;

  return (
    <Animated.View testID={testID} {...gestos.panHandlers}>
      {filas.map((f, i) => {
        const esta = levantada === i;
        return (
          <Animated.View
            key={llave(f, i)}
            style={[
              { height: alto },
              esta
                ? [estilos.globo, { transform: [{ translateY: dy }, { scale: escala }] }]
                : { transform: [{ translateY: corrimientos.current[i] }] },
            ]}
          >
            <Pressable
              style={estilos.fila}
              delayLongPress={280}
              onLongPress={(e) => levantar(i, e)}
              // Se levantó y se soltó sin mover: no hubo arrastre, se apoya donde estaba.
              // Con una espera: en la web esto llega ANTES de que el arrastre tome
              // el dedo, y cortarlo ahí dejaba la fila sin moverse.
              onPressOut={() => {
                setTimeout(() => {
                  if (desde.current !== null && !concedido.current) ultimo.current.soltar(false);
                }, 150);
              }}
              accessibilityHint={T.rutina.arrastrarAyuda}
              accessibilityActions={[
                { name: 'subir', label: T.rutina.subir },
                { name: 'bajar', label: T.rutina.bajar },
              ]}
              onAccessibilityAction={(ev) => {
                if (ev.nativeEvent.actionName === 'subir' && i > 0) alMover(i, i - 1);
                if (ev.nativeEvent.actionName === 'bajar' && i < filas.length - 1) alMover(i, i + 1);
              }}
            >
              {dibujar(f, i)}
            </Pressable>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  fila: { flex: 1, justifyContent: 'center' },
  globo: {
    zIndex: 10,
    elevation: 8,
    backgroundColor: C.hoja,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    paddingHorizontal: 10,
    marginHorizontal: -10,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
});
