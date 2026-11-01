import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, type GestureResponderEvent, View } from 'react-native';
import { plataforma } from '@plataforma';
import { T } from '@nucleo/textos';
import { C, conTema, luz } from './colores';
import { LLEGA, MS, SE_VA, sinMovimiento } from './movimiento';
import { useTema } from './useTema';

const CLAVE_ENSENADO = 'ascent:arrastrar-ensenado';

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
 *
 * EL GESTO SE MUESTRA (propuesta K, aprobada el 31/10): cada fila lleva su agarradera, y la primera
 * vez que se ven, la del medio se levanta y vuelve, sola. Después no se repite.
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
  useTema();
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

  // La del medio se levanta y vuelve, una sola vez en la vida de la app.
  const laQueEnsena = Math.floor((filas.length - 1) / 2);
  const ensena = useRef(new Animated.Value(0)).current;
  const hayFilas = filas.length >= 2;
  useEffect(() => {
    if (!hayFilas) return;
    let vivo = true;
    const espera = setTimeout(() => {
      void Promise.all([plataforma.almacenamiento.leer(CLAVE_ENSENADO).catch(() => '1'), sinMovimiento()]).then(([visto, quieto]) => {
        if (!vivo || visto || quieto) return;
        void plataforma.almacenamiento.guardar(CLAVE_ENSENADO, '1').catch(() => {});
        Animated.sequence([
          Animated.timing(ensena, { toValue: 1, duration: 460, easing: LLEGA, useNativeDriver: true }),
          Animated.delay(320),
          Animated.timing(ensena, { toValue: 0, duration: MS.sale, easing: SE_VA, useNativeDriver: true }),
        ]).start();
      });
    }, 700);
    return () => {
      vivo = false;
      clearTimeout(espera);
    };
  }, [hayFilas, ensena]);

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
                : i === laQueEnsena
                  ? { zIndex: 5, transform: [{ translateY: Animated.add(corrimientos.current[i], ensena.interpolate({ inputRange: [0, 1], outputRange: [0, -14] })) }, { scale: ensena.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) }] }
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
              <View style={estilos.agarradera} testID="agarradera" pointerEvents="none">
                {[0, 1, 2].map((k) => (
                  <View key={k} style={estilos.parDePuntos}>
                    <View style={estilos.puntito} />
                    <View style={estilos.puntito} />
                  </View>
                ))}
              </View>
              <View style={estilos.contenido}>{dibujar(f, i)}</View>
            </Pressable>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

const estilos = conTema(() => StyleSheet.create({
  fila: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  contenido: { flex: 1 },
  // Se ve qué se agarra, sin decirlo.
  agarradera: { gap: 3 },
  parDePuntos: { flexDirection: 'row', gap: 3 },
  puntito: { width: 2.5, height: 2.5, borderRadius: 1.25, backgroundColor: C.apagado },
  globo: {
    zIndex: 10,
    backgroundColor: C.hoja,
    borderRadius: 1,
    borderWidth: 1,
    borderColor: C.lineaFuerte,
    paddingHorizontal: 10,
    marginHorizontal: -10,
    ...luz(C.claro, 0.25, 10),
  },
}));
