import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { puntoMasCercano, trazarSerie } from '@nucleo/tendencia';
import { fechaLinda } from '@nucleo/fechas';
import { T } from '@nucleo/textos';
import { C, conAlfa } from './colores';

/**
 * LOS PASOS, COMO TENDENCIA. El mismo gráfico que el del peso —la misma media
 * móvil de siete días, las mismas tres ventanas, el mismo arrastrar el dedo
 * para leer un día— con la cuenta compartida de `nucleo/tendencia.ts`.
 *
 * TODOS LOS DÍAS, NO SOLO LOS DE ENTRENAMIENTO. Era el pedido, y además es lo
 * único que tiene sentido: los pasos no son una métrica de gimnasio, son
 * cuánto te moviste. Un domingo de 14.000 pasos es información; esconderlo
 * porque no fue día de fuerza sería mirar para otro lado.
 *
 * Y NO CUENTAN COMO ENTRENAMIENTO, que es la otra mitad de lo mismo y está
 * dicho en pantalla. Un día de gimnasio de fuerza puede tener 2.000 pasos.
 * `plataforma/salud.ts` tiene el porqué largo: los entrenamientos de Health
 * son la señal honesta de "fuiste", los pasos se muestran y no deciden nada.
 *
 * LOS HUECOS NO SON CEROS. Un día sin el teléfono encima no llega en la serie,
 * y la línea lo cruza en vez de bajar a cero: bajar a cero sería afirmar que
 * no caminaste. Es la misma regla que el peso, donde los días sin anotar
 * tampoco existen.
 */

const ALTO = 84;
const VENTANA = 7;

// Las mismas ventanas que el peso: son el mismo gesto en la misma pantalla.
// `null` es todo el historial que haya devuelto Health.
const RANGOS: { dias: number | null; etiqueta: () => string }[] = [
  { dias: 30, etiqueta: () => T.stats.pesoMes },
  { dias: 90, etiqueta: () => T.stats.pesoTresMeses },
  { dias: null, etiqueta: () => T.stats.pesoTodo },
];

/** Con punto cada tres cifras: 12.480 se lee de un vistazo y 12480 no. */
const conMiles = (n: number) => Math.round(n).toLocaleString('es-UY');

export default function GraficoPasos({
  pasos,
  claro,
}: {
  pasos: { fecha: string; valor: number }[];
  /** El `--pal-claro` de la web: la paleta del rango. */
  claro: string;
}) {
  const [rango, setRango] = useState<number | null>(null);
  const [tocado, setTocado] = useState<number | null>(null);
  const [ancho, setAncho] = useState(0);

  // LA LUZ MÍNIMA ES 1 Y NO 0,4: acá la unidad es un paso, y cuatro décimas de
  // paso no existen. Solo hace falta que una serie perfectamente plana no
  // divida por cero.
  const trazo = ancho > 0 ? trazarSerie(pasos, rango, ancho, ALTO, VENTANA, 1) : null;
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
                {/* El `id` es otro que el del peso A PROPÓSITO: los dos gráficos
                    viven en la misma pantalla, y un `id` repetido lo resuelve
                    el motor de SVG callado y mal —el segundo degradado se
                    dibuja con la definición del primero—. Es la misma trampa
                    que documenta `compartido/insignias.ts`. */}
                <LinearGradient id="pasos-relleno" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={claro} stopOpacity={0.18} />
                  <Stop offset="1" stopColor={claro} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Path d={trazo.area} fill="url(#pasos-relleno)" />
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
            {/* EL CRUDO DE ESE DÍA, no el suavizado: la pregunta que hace el
                dedo es "cuántos pasos di ese día". */}
            <Text style={estilos.hoy}>{T.stats.pasosDia(conMiles(elegido.valor))}</Text>
          </View>
        ) : (
          <View style={estilos.pie}>
            <Text style={estilos.hoy}>{T.stats.pasosDia(conMiles(trazo.hoy))}</Text>
            {/* En el peso acá va el CAMBIO con signo; en los pasos va el
                promedio. Un "+300 pasos" contra el primer día de la ventana no
                dice nada —los pasos no tienen una dirección buena—, y en cambio
                cuánto caminás por día es exactamente lo que se viene a mirar. */}
            <Text style={estilos.cambio}>
              {T.stats.pasosPromedio(
                trazo.dias,
                conMiles(trazo.serie.reduce((a, p) => a + p.valor, 0) / trazo.serie.length)
              )}
            </Text>
          </View>
        ))}

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

      <Text style={estilos.nota}>{T.stats.pasosNota}</Text>
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
  cambio: { color: C.apagado, fontSize: 11, letterSpacing: 0.7, fontVariant: ['tabular-nums'] },
  cuando: { flex: 1, color: C.apagado, fontSize: 12 },
  rangos: { flexDirection: 'row', gap: 14, marginTop: 10 },
  rango: { color: C.apagado, fontSize: 12, paddingVertical: 4 },
  nota: { color: C.apagado, fontSize: 11, marginTop: 12, lineHeight: 16 },
});
