import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { conComa, puntoMasCercano, trazarPeso, type Unidad } from '@nucleo/peso';
import { fechaLinda } from '@nucleo/fechas';
import { T } from '@nucleo/textos';
import { C, conAlfa } from './colores';

/**
 * LA TENDENCIA DEL PESO, en la app nativa: la misma que la web
 * (`src/components/GraficoPeso.tsx`), con la misma cuenta
 * (`trazarPeso` en `nucleo/peso.ts`, donde están los porqués).
 *
 * Lo que cambia es solo cómo se dibuja:
 *
 *   - EL SVG SE DIBUJA AL ANCHO DE VERDAD, medido con `onLayout`. La web usa un
 *     viewBox fijo que se estira sin conservar la proporción, y por eso
 *     necesita `non-scaling-stroke` para que la línea no engorde de costado.
 *     Acá no se estira nada: la cuenta recibe el ancho real.
 *   - LEER UN DÍA ES ARRASTRAR EL DEDO, con el sistema de respuesta de toques
 *     de React Native. Mientras se arrastra, el gráfico no le suelta el toque
 *     al scroll: si no, el primer movimiento en diagonal se lo lleva la lista.
 *   - AL TOCAR SE MUESTRA EL PESO CRUDO, no el suavizado, igual que en la web:
 *     el suavizado es una afirmación sobre la tendencia, y esto es la pregunta
 *     "cuánto pesaba ese día".
 */

const ALTO = 84;
const VENTANA = 7;

// Las ventanas de tiempo. `null` es todo el historial.
const RANGOS: { dias: number | null; etiqueta: () => string }[] = [
  { dias: 30, etiqueta: () => T.stats.pesoMes },
  { dias: 90, etiqueta: () => T.stats.pesoTresMeses },
  { dias: null, etiqueta: () => T.stats.pesoTodo },
];

export default function GraficoPeso({
  pesos,
  unidad,
  claro,
}: {
  pesos: { fecha: string; valor: number }[];
  unidad: Unidad;
  /** El `--pal-claro` de la web: la paleta del rango. */
  claro: string;
}) {
  const [rango, setRango] = useState<number | null>(null);
  const [tocado, setTocado] = useState<number | null>(null);
  const [ancho, setAncho] = useState(0);

  const trazo = ancho > 0 ? trazarPeso(pesos, unidad, rango, ancho, ALTO, VENTANA) : null;
  const serie = trazo?.serie ?? [];
  const alMover = (e: GestureResponderEvent) => {
    if (ancho > 0 && serie.length > 1) setTocado(puntoMasCercano(e.nativeEvent.locationX / ancho, serie.length));
  };
  const elegido = tocado === null || !trazo ? null : serie[tocado];
  const posElegido = tocado === null || !trazo ? null : trazo.puntos[tocado];
  const ultimo = trazo?.puntos[trazo.puntos.length - 1];

  return (
    <View style={estilos.grafico}>
      <View
        style={estilos.lienzo}
        onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={alMover}
        onResponderMove={alMover}
        onResponderRelease={() => setTocado(null)}
        onResponderTerminate={() => setTocado(null)}
      >
        {/* Nada de lo dibujado recibe el toque: `locationX` se mide contra la
            vista que toca el dedo, y si fuera un punto daría otra x. */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {trazo && (
            <Svg width={ancho} height={ALTO}>
              <Defs>
                <LinearGradient id="peso-relleno" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={claro} stopOpacity={0.18} />
                  <Stop offset="1" stopColor={claro} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Path d={trazo.area} fill="url(#peso-relleno)" />
              <Path
                d={trazo.linea}
                fill="none"
                stroke={claro}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {posElegido && (
                <Line
                  x1={posElegido.x}
                  y1={0}
                  x2={posElegido.x}
                  y2={ALTO}
                  stroke={claro}
                  strokeWidth={1}
                  opacity={0.45}
                />
              )}
            </Svg>
          )}
          {ultimo && <Punto x={ultimo.x} y={ultimo.y} color={claro} aro={conAlfa(C.fondo, 0.65)} />}
          {posElegido && <Punto x={posElegido.x} y={posElegido.y} color={claro} aro={conAlfa(claro, 0.22)} />}
        </View>
      </View>

      {trazo &&
        (elegido ? (
          <View style={estilos.pie}>
            <Text style={estilos.cuando}>{fechaLinda(elegido.fecha)}</Text>
            <Text style={estilos.hoy}>
              {conComa(elegido.valor.toFixed(1))}
              <Text style={estilos.unidad}> {unidad}</Text>
            </Text>
          </View>
        ) : (
          <View style={estilos.pie}>
            <Text style={estilos.hoy}>
              {conComa(trazo.hoy.toFixed(1))}
              <Text style={estilos.unidad}> {unidad}</Text>
            </Text>
            {/* Con signo, siempre: sin él, "0.4" no dice si subiste o bajaste. */}
            <Text style={estilos.cambio}>
              {T.stats.pesoCambio(
                trazo.dias,
                `${trazo.cambio >= 0 ? '+' : '−'}${conComa(Math.abs(trazo.cambio).toFixed(1))}`,
                unidad
              )}
            </Text>
          </View>
        ))}

      {/* La ventana. Con todo el historial, tres meses de una bajada de dos
          kilos se ven planos: la escala la manda el punto más lejano. */}
      <View style={estilos.rangos}>
        {RANGOS.map((r) => {
          const activo = r.dias === rango;
          return (
            <Pressable
              key={String(r.dias)}
              hitSlop={8}
              onPress={() => {
                setRango(r.dias);
                setTocado(null);
              }}
            >
              <Text
                style={[
                  estilos.rango,
                  activo && { color: claro, borderBottomWidth: 1, borderColor: conAlfa(claro, 0.45) },
                ]}
              >
                {r.etiqueta()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Un punto de 7 px con un aro de 3 px alrededor. En la web el aro es una
 * sombra, que va por FUERA; acá un borde translúcido se mezclaría con el
 * relleno del punto, así que el aro es otra vista, detrás.
 */
function Punto({ x, y, color, aro }: { x: number; y: number; color: string; aro: string }) {
  return (
    <>
      <View style={[estilos.aro, { left: x, top: y, backgroundColor: aro }]} />
      <View style={[estilos.punto, { left: x, top: y, backgroundColor: color }]} />
    </>
  );
}

const estilos = StyleSheet.create({
  grafico: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.linea, paddingTop: 26, paddingBottom: 6 },
  lienzo: { height: ALTO },
  punto: {
    position: 'absolute',
    width: 7,
    height: 7,
    marginLeft: -3.5,
    marginTop: -3.5,
    borderRadius: 3.5,
  },
  aro: { position: 'absolute', width: 13, height: 13, marginLeft: -6.5, marginTop: -6.5, borderRadius: 6.5 },
  pie: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, marginTop: 16 },
  hoy: { color: C.tinta, fontSize: 30, fontWeight: '300', fontVariant: ['tabular-nums'] },
  unidad: { color: C.sub, fontSize: 13 },
  cambio: { color: C.apagado, fontSize: 11, letterSpacing: 0.7, fontVariant: ['tabular-nums'] },
  cuando: { flex: 1, color: C.apagado, fontSize: 12 },
  rangos: { flexDirection: 'row', gap: 14, marginTop: 10 },
  rango: { color: C.apagado, fontSize: 12, paddingVertical: 4 },
});
