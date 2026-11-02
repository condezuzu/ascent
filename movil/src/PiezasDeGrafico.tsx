import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { masCercano, pasoDeVoiceOver, type MarcaDeTiempo, type Punto } from '@nucleo/grafico';
import { C, conAlfa, conTema, luz } from './colores';
import { useTema } from './useTema';
import { Text } from './Texto';
import { L } from './fuentes';
import { LLENA, MS, sinMovimiento } from './movimiento';

/**
 * LAS PIEZAS DE LOS GRÁFICOS DE LÍNEA (1/11): el peso, los pasos y el progreso de un ejercicio se
 * dibujan igual y se leen igual. Las cuentas están en `nucleo/grafico.ts`.
 */

/** Lo que queda a la derecha para los números de la escala. */
export const MARGEN_ESCALA = 34;

const TrazoAnimado = Animated.createAnimatedComponent(Path);

/** La línea se dibuja de izquierda a derecha al aparecer; después es una línea común. */
export function TrazoQueSeDibuja({ d, color, largo }: { d: string; color: string; largo: number }) {
  useTema();
  const t = useRef(new Animated.Value(0)).current;
  const [lista, setLista] = useState(false);
  useEffect(() => {
    let vivo = true;
    void sinMovimiento().then((quieto) => {
      if (!vivo) return;
      if (quieto) return setLista(true);
      // Por JS: el trazo de un SVG no va por el motor nativo.
      Animated.timing(t, { toValue: 1, duration: MS.trazo, easing: LLENA, useNativeDriver: false }).start(() => vivo && setLista(true));
    });
    return () => {
      vivo = false;
    };
  }, [t]);
  const comun = { d, fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (lista) return <Path {...comun} />;
  return <TrazoAnimado {...comun} strokeDasharray={[largo, largo]} strokeDashoffset={t.interpolate({ inputRange: [0, 1], outputRange: [largo, 0] })} />;
}

/** De 0 a 1 cada vez que cambia `clave`: lo que acompaña a la línea mientras se dibuja. */
export function useAparicion(clave: unknown) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let vivo = true;
    v.setValue(0);
    void sinMovimiento().then((quieto) => {
      if (!vivo) return;
      if (quieto) return v.setValue(1);
      Animated.timing(v, { toValue: 1, duration: MS.trazo, easing: LLENA, useNativeDriver: true }).start();
    });
    return () => {
      vivo = false;
    };
  }, [clave, v]);
  return v;
}

/**
 * LEER UN PUNTO ES TOCARLO O ARRASTRAR. Al soltar queda elegido, para poder sacar el dedo y
 * mirarlo; tocar el mismo de nuevo lo suelta. Mientras se arrastra el gráfico no le da el toque
 * al scroll: si no, el primer movimiento en diagonal se lo lleva la lista.
 *
 * Nada de lo dibujado recibe el toque (`pointerEvents="none"`): `locationX` se mide contra la
 * vista que toca el dedo, y si fuera un punto daría otra x.
 */
export function useLectura(xs: number[], elegido: number | null, alElegir: (i: number | null) => void) {
  const antes = useRef<number | null>(null);
  const inicio = useRef(0);
  const movio = useRef(false);
  const cerca = (e: GestureResponderEvent) => masCercano(xs, e.nativeEvent.locationX);
  return {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      antes.current = elegido;
      inicio.current = e.nativeEvent.pageX;
      movio.current = false;
      if (xs.length) alElegir(cerca(e));
    },
    onResponderMove: (e: GestureResponderEvent) => {
      // Un dedo nunca está quieto: unos píxeles siguen siendo un toque.
      if (Math.abs(e.nativeEvent.pageX - inicio.current) > 6) movio.current = true;
      if (xs.length) alElegir(cerca(e));
    },
    onResponderRelease: (e: GestureResponderEvent) => {
      if (!movio.current && xs.length && antes.current === cerca(e)) alElegir(null);
    },
    onResponderTerminate: () => alElegir(null),
  };
}

/** Lo mismo para VoiceOver: subir y bajar recorre los puntos, de a uno. */
export function leerConVoiceOver(cuantos: number, elegido: number | null, alElegir: (i: number) => void) {
  return {
    accessibilityRole: 'adjustable' as const,
    accessibilityActions: [{ name: 'increment' }, { name: 'decrement' }],
    onAccessibilityAction: (e: { nativeEvent: { actionName: string } }) => {
      if (cuantos > 0) alElegir(pasoDeVoiceOver(cuantos, elegido, e.nativeEvent.actionName === 'increment'));
    },
  };
}

/** Los rótulos de abajo. */
export function EjeDeTiempo({ marcas }: { marcas: MarcaDeTiempo[] }) {
  useTema();
  return (
    <View testID="grafico-eje" style={estilos.eje} pointerEvents="none">
      {marcas.map((m) => (
        <Text key={`${m.x}-${m.texto}`} style={[estilos.rotuloEje, { left: m.x - 30 }]}>
          {m.texto}
        </Text>
      ))}
    </View>
  );
}

/**
 * Un punto de 7 px con un aro de 3 px alrededor. Un borde translúcido se mezclaría con el relleno
 * del punto, así que el aro es otra vista, detrás.
 */
export function PuntoConAro({ x, y, color, aro, testID }: { x: number; y: number; color: string; aro: string; testID?: string }) {
  useTema();
  return (
    <>
      <View style={[estilos.aro, { left: x, top: y, backgroundColor: aro }]} />
      <View testID={testID} style={[estilos.punto, { left: x, top: y, backgroundColor: color }, luz(color, 0.9, 5)]} />
    </>
  );
}

/** Lo que se está leyendo: una línea de arriba abajo y el punto. */
export function PuntoElegido({ x, y, alto, ancho, color, hueco }: { x: number; y: number; alto: number; ancho: number; color: string; hueco?: boolean }) {
  useTema();
  return (
    <>
      <Svg width={ancho} height={alto} style={StyleSheet.absoluteFill}>
        <Line x1={x} y1={0} x2={x} y2={alto} stroke={color} strokeWidth={1} opacity={0.45} />
      </Svg>
      <PuntoConAro testID="grafico-elegido" x={x} y={y} color={hueco ? C.fondo : color} aro={conAlfa(color, 0.22)} />
    </>
  );
}

type Tendencia = {
  puntos: Punto[];
  linea: string;
  area: string;
  largo: number;
  escala: { valor: number; y: number }[];
};

/**
 * LA TENDENCIA ENTERA, MENOS LO QUE SE ESTÁ LEYENDO: las líneas de la escala, el área y la línea.
 * Va aparte de lo elegido porque arrastrar el dedo vuelve a dibujar en cada movimiento, y esto
 * pueden ser 365 puntos.
 */
export function LineaDeTendencia({
  trazo,
  ancho,
  alto,
  color,
  clave,
  rotular,
  idRelleno,
  conPuntos = false,
  referencia = null,
}: {
  trazo: Tendencia;
  ancho: number;
  alto: number;
  color: string;
  /** Cada vez que cambia, la línea se vuelve a dibujar: el rango. */
  clave: unknown;
  rotular: (valor: number) => string;
  /** Único por gráfico: un `id` repetido lo resuelve el motor de SVG callado y mal. */
  idRelleno: string;
  /** Cada anotación, sobre la línea: dice cuándo hay un dato, sin sumar el ruido del crudo (§9). */
  conPuntos?: boolean;
  /** La meta o el objetivo: la línea contra la que se mira. Detrás del trazo. */
  referencia?: { y: number; texto: string } | null;
}) {
  useTema();
  const aparece = useAparicion(clave);
  const entranPuntos = aparece.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 0, 1] });
  const ultimo = trazo.puntos[trazo.puntos.length - 1];
  const finLineas = ancho - MARGEN_ESCALA + 6;
  // Ni contra el borde ni encima del rótulo de la referencia.
  const rotulos = trazo.escala.filter((e) => e.y > 7 && e.y < alto - 16 && (!referencia || Math.abs(e.y - referencia.y) > 12));
  return (
    <>
      <Svg width={ancho} height={alto} style={StyleSheet.absoluteFill}>
        {trazo.escala.filter((e) => e.y < alto - 16).map((e) => (
          <Line key={e.valor} x1={0} y1={e.y} x2={finLineas} y2={e.y} stroke={C.linea} strokeWidth={1} />
        ))}
        <Line x1={0} y1={alto - 0.5} x2={finLineas} y2={alto - 0.5} stroke={C.lineaFuerte} strokeWidth={1} />
        {referencia && <Line x1={0} y1={referencia.y} x2={finLineas} y2={referencia.y} stroke={color} strokeWidth={0.8} strokeDasharray="3 4" opacity={0.5} />}
      </Svg>
      {rotulos.map((e) => (
        <Text key={e.valor} style={[estilos.rotuloEscala, { top: e.y - 7 }]}>
          {rotular(e.valor)}
        </Text>
      ))}
      {referencia && <Text style={[estilos.rotuloEscala, estilos.rotuloReferencia, { top: referencia.y - 7, color }]}>{referencia.texto}</Text>}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: aparece }]}>
        <Svg width={ancho} height={alto}>
          <Defs>
            <LinearGradient id={idRelleno} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.16} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={trazo.area} fill={`url(#${idRelleno})`} />
        </Svg>
      </Animated.View>
      <Svg width={ancho} height={alto} style={StyleSheet.absoluteFill}>
        <TrazoQueSeDibuja key={String(clave)} d={trazo.linea} color={color} largo={trazo.largo} />
      </Svg>
      {conPuntos && (
        <Animated.View testID="grafico-anotaciones" style={[StyleSheet.absoluteFill, { opacity: entranPuntos }]}>
          <Svg width={ancho} height={alto}>
            {trazo.puntos.map((p) => (
              <Circle key={p.x} cx={p.x} cy={p.y} r={2} fill={color} />
            ))}
          </Svg>
        </Animated.View>
      )}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: entranPuntos }]}>
        <PuntoConAro x={ultimo.x} y={ultimo.y} color={color} aro={conAlfa(C.fondo, 0.65)} />
      </Animated.View>
    </>
  );
}

const estilos = conTema(() => StyleSheet.create({
  punto: { position: 'absolute', width: 7, height: 7, marginLeft: -3.5, marginTop: -3.5, borderRadius: 3.5 },
  aro: { position: 'absolute', width: 13, height: 13, marginLeft: -6.5, marginTop: -6.5, borderRadius: 6.5 },
  eje: { height: 22 },
  rotuloEje: { position: 'absolute', top: 8, width: 60, textAlign: 'center', color: C.apagado, fontSize: 10.5, fontFamily: L.dato },
  rotuloEscala: { position: 'absolute', right: 0, width: MARGEN_ESCALA - 8, textAlign: 'right', color: C.apagado, fontSize: 10.5, lineHeight: 14, fontFamily: L.dato },
  rotuloReferencia: { width: MARGEN_ESCALA },
}));
