import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { PanResponder, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Text as SvgText } from 'react-native-svg';
import { APRETADO_MS, REPETIR_MS, type MarcaDeRegla } from '@nucleo/reglaDePeso';
import { FIJO } from './coloresFijos';
import { Text } from './Texto';

/**
 * − Y + A LOS LADOS DE UNA REGLA QUE SE ARRASTRA. Nació con el peso (20/10, la B de la galería) y la
 * usa también la meta de pasos (2/11, a pedido): elegirla con una barra no gustó. Colores fijos,
 * como las hojas donde va.
 */
export default function ReglaConBotones({
  valor,
  alCambiar,
  acotar,
  arrastrado,
  marcasDe,
  paso,
  apretado,
  etiquetaMenos,
  etiquetaMas,
  prefijo,
}: {
  valor: number;
  alCambiar: Dispatch<SetStateAction<number>>;
  acotar: (v: number) => number;
  /** A qué valor lleva arrastrar `dx` píxeles desde `desde`. */
  arrastrado: (desde: number, dx: number) => number;
  marcasDe: (valor: number, ancho: number) => MarcaDeRegla[];
  /** Cuánto mueve un toque, y cuánto cada repetición con el dedo apretado. */
  paso: number;
  apretado: number;
  etiquetaMenos: string;
  etiquetaMas: string;
  /** El comienzo de los testID: `-menos`, `-regla`, `-mas`. */
  prefijo: string;
}) {
  const [ancho, setAncho] = useState(0);
  const actual = useRef(valor);
  actual.current = valor;
  // Por un ref: la regla se crea una vez, y estos cambian entre dibujados.
  const aplicar = useRef({ alCambiar, arrastrado });
  aplicar.current = { alCambiar, arrastrado };

  const mover = (d: number) => alCambiar((v) => acotar(v + d));

  const regla = useMemo(() => {
    let desde = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Horizontal gana; vertical se lo deja al desplazamiento de la hoja.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        desde = actual.current;
        // Sin moverlo: alcanza para que quien la usa sepa que ya la tocaron.
        aplicar.current.alCambiar(desde);
      },
      onPanResponderMove: (_, g) => aplicar.current.alCambiar(aplicar.current.arrastrado(desde, g.dx)),
    });
  }, []);

  const marcas = ancho > 0 ? marcasDe(valor, ancho) : [];
  return (
    <View style={estilos.fila}>
      <Apretable texto="−" etiqueta={etiquetaMenos} testID={`${prefijo}-menos`} alMover={mover} paso={-paso} apretado={-apretado} />
      <View style={estilos.regla} onLayout={(e: LayoutChangeEvent) => setAncho(Math.round(e.nativeEvent.layout.width))} testID={`${prefijo}-regla`} {...regla.panHandlers}>
        {ancho > 0 && (
          <Svg width={ancho} height={54}>
            {marcas.map((m) => (
              <Line
                key={m.x.toFixed(1) + m.alto}
                x1={m.x}
                x2={m.x}
                y1={46}
                y2={46 - (m.alto === 'entero' ? 22 : m.alto === 'medio' ? 15 : 9)}
                stroke={m.alto === 'entero' ? FIJO.sub : FIJO.raya}
                strokeWidth={m.alto === 'entero' ? 1.5 : 1}
              />
            ))}
            {marcas
              .filter((m) => m.etiqueta)
              .map((m) => (
                <SvgText key={'e' + m.etiqueta} x={m.x} y={14} fill={FIJO.sub} fontSize={10} fontFamily="GeistMono_400Regular" textAnchor="middle">
                  {m.etiqueta}
                </SvgText>
              ))}
          </Svg>
        )}
        <View pointerEvents="none" style={estilos.aguja} />
      </View>
      <Apretable texto="+" etiqueta={etiquetaMas} testID={`${prefijo}-mas`} alMover={mover} paso={paso} apretado={apretado} />
    </View>
  );
}

/**
 * Un toque mueve `paso`; apretado, después de un rato, de a `apretado`. Con `onPress` y
 * `onLongPress` y no con `onPressIn`: en la web, `onPressIn` llega 50 ms tarde y un toque
 * corto lo pierde.
 */
function Apretable({ texto, etiqueta, testID, paso, apretado, alMover }: { texto: string; etiqueta: string; testID: string; paso: number; apretado: number; alMover: (d: number) => void }) {
  const seguido = useRef<ReturnType<typeof setInterval> | null>(null);
  const soltar = () => {
    if (seguido.current) clearInterval(seguido.current);
    seguido.current = null;
  };
  useEffect(() => soltar, []);
  return (
    <Pressable
      style={({ pressed }) => [estilos.redondo, pressed && estilos.redondoApretado]}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      testID={testID}
      onPress={() => alMover(paso)}
      delayLongPress={APRETADO_MS}
      onLongPress={() => {
        alMover(apretado);
        seguido.current = setInterval(() => alMover(apretado), REPETIR_MS);
      }}
      onPressOut={soltar}
    >
      <Text style={estilos.redondoTexto}>{texto}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: 8 },
  regla: { flex: 1, height: 54, backgroundColor: FIJO.regla, borderWidth: 1, borderColor: FIJO.linea, overflow: 'hidden' },
  aguja: { position: 'absolute', left: '50%', top: 6, bottom: 6, width: 2, marginLeft: -1, borderRadius: 1, backgroundColor: FIJO.crema },
  redondo: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: FIJO.borde, backgroundColor: FIJO.negro, alignItems: 'center', justifyContent: 'center' },
  redondoApretado: { backgroundColor: FIJO.apretado },
  redondoTexto: { color: FIJO.tinta, fontSize: 20, fontWeight: '300', lineHeight: 24 },
});
