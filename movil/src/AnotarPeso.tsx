import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Text as SvgText } from 'react-native-svg';
import { aKilos, conComa, type Unidad } from '@nucleo/peso';
import { APRETADO_MS, REPETIR_MS, marcasDeRegla, pesoAcotado, pesoArrastrado, pesoInicial } from '@nucleo/reglaDePeso';
import { fechaLinda } from '@nucleo/fechas';
import { useEnVuelo } from '@compartido/useEnVuelo';
import { T } from '@nucleo/textos';
import { supabase } from './supabase';
import { FIJO } from './coloresFijos';

/**
 * ANOTAR EL PESO (20/10, la B de la galería): el número grande, − y + a los lados de una
 * regla que se arrastra, la última vez y «Anotar». Arranca en el último peso anotado.
 *
 * EL PESO NO REGISTRA EL DÍA, y por eso tiene su propia puerta: estuvo colgado de la hoja
 * de registrar hasta el 27/8 y pesarse un domingo contaba como día de gimnasio.
 */
export default function AnotarPeso({ unidad, alGuardar }: { unidad: Unidad; alGuardar: () => void }) {
  const [valor, setValor] = useState(() => pesoInicial(null, unidad));
  const [ultimo, setUltimo] = useState<{ fecha: string; valor: number } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ancho, setAncho] = useState(0);
  const tocado = useRef(false);
  const actual = useRef(valor);
  actual.current = valor;

  useEffect(() => {
    let vivo = true;
    void supabase
      .from('weights')
      .select('fecha, valor')
      .order('fecha', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const u = data?.[0] as { fecha: string; valor: number } | undefined;
        if (!vivo || !u) return;
        setUltimo({ fecha: u.fecha, valor: Number(u.valor) });
        // Si ya lo empezó a mover, no se le cambia el número de abajo de los dedos.
        if (!tocado.current) setValor(pesoInicial(Number(u.valor), unidad));
      });
    return () => {
      vivo = false;
    };
  }, [unidad]);

  const mover = (d: number) => {
    tocado.current = true;
    setValor((v) => pesoAcotado(v + d, unidad));
  };

  const regla = useMemo(() => {
    let desde = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Horizontal gana; vertical se lo deja al desplazamiento de la hoja.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        tocado.current = true;
        desde = actual.current;
      },
      onPanResponderMove: (_, g) => setValor(pesoArrastrado(desde, g.dx, unidad)),
    });
  }, [unidad]);

  const guardar = useEnVuelo(async () => {
    setError('');
    setGuardando(true);
    const { error: err } = await supabase.rpc('anotar_peso', { p_valor: Math.round(aKilos(valor, unidad) * 100) / 100 });
    setGuardando(false);
    if (err) return setError(T.general.noSePudo);
    alGuardar();
  });

  return (
    <View style={estilos.todo} testID="anotar-peso">
      <View style={estilos.cifra}>
        <Text style={estilos.numero} testID="anotar-peso-valor">
          {conComa(valor.toFixed(1))}
        </Text>
        <Text style={estilos.unidad}>{unidad}</Text>
      </View>
      <View style={estilos.fila}>
        <Apretable texto="−" etiqueta={T.peso.restar(unidad)} testID="anotar-peso-menos" alMover={mover} paso={-0.1} />
        <View
          style={estilos.regla}
          onLayout={(e: LayoutChangeEvent) => setAncho(Math.round(e.nativeEvent.layout.width))}
          testID="anotar-peso-regla"
          {...regla.panHandlers}
        >
          {ancho > 0 && (
            <Svg width={ancho} height={54}>
              {marcasDeRegla(valor, ancho).map((m) => (
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
              {marcasDeRegla(valor, ancho)
                .filter((m) => m.etiqueta)
                .map((m) => (
                  <SvgText key={'e' + m.etiqueta} x={m.x} y={14} fill={FIJO.sub} fontSize={10} textAnchor="middle">
                    {m.etiqueta}
                  </SvgText>
                ))}
            </Svg>
          )}
          <View pointerEvents="none" style={estilos.aguja} />
        </View>
        <Apretable texto="+" etiqueta={T.peso.sumar(unidad)} testID="anotar-peso-mas" alMover={mover} paso={0.1} />
      </View>
      {ultimo && <Text style={estilos.ultima}>{T.peso.ultima(conComa(pesoInicial(ultimo.valor, unidad).toFixed(1)), unidad, fechaLinda(ultimo.fecha))}</Text>}
      <Pressable style={[estilos.anotar, guardando && estilos.apagado]} onPress={() => guardar()} disabled={guardando} accessibilityRole="button" testID="anotar-peso-anotar">
        <Text style={estilos.anotarTexto}>{guardando ? '…' : T.peso.anotar}</Text>
      </Pressable>
      {!!error && <Text style={estilos.error}>{error}</Text>}
    </View>
  );
}

/**
 * Un toque mueve una décima; apretado, después de un rato, de a una unidad. Con `onPress` y
 * `onLongPress` y no con `onPressIn`: en la web, `onPressIn` llega 50 ms tarde y un toque
 * corto lo pierde.
 */
function Apretable({ texto, etiqueta, testID, paso, alMover }: { texto: string; etiqueta: string; testID: string; paso: number; alMover: (d: number) => void }) {
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
        alMover(Math.sign(paso));
        seguido.current = setInterval(() => alMover(Math.sign(paso)), REPETIR_MS);
      }}
      onPressOut={soltar}
    >
      <Text style={estilos.redondoTexto}>{texto}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  todo: { alignItems: 'center', gap: 14, marginTop: 10 },
  cifra: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 },
  numero: { color: FIJO.tinta, fontSize: 76, fontWeight: '200', lineHeight: 84, fontVariant: ['tabular-nums'] },
  unidad: { color: FIJO.sub, fontSize: 16 },
  fila: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: 8 },
  regla: { flex: 1, height: 54, borderRadius: 12, backgroundColor: FIJO.regla, borderWidth: 1, borderColor: FIJO.linea, overflow: 'hidden' },
  aguja: { position: 'absolute', left: '50%', top: 6, bottom: 6, width: 2, marginLeft: -1, borderRadius: 1, backgroundColor: FIJO.crema },
  redondo: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: FIJO.borde, backgroundColor: FIJO.negro, alignItems: 'center', justifyContent: 'center' },
  redondoApretado: { backgroundColor: FIJO.apretado },
  redondoTexto: { color: FIJO.tinta, fontSize: 20, fontWeight: '300', lineHeight: 24 },
  ultima: { color: FIJO.sub, fontSize: 12, fontVariant: ['tabular-nums'] },
  anotar: { alignSelf: 'stretch', backgroundColor: FIJO.crema, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  apagado: { opacity: 0.6 },
  anotarTexto: { color: FIJO.negro, fontSize: 15, fontWeight: '600' },
  error: { color: FIJO.error, fontSize: 13 },
});
