import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { C, conTema, luz } from './colores';
import { useTema } from './useTema';

const PERILLA = 24;

/**
 * UNA BARRA QUE SE ARRASTRA. Con lo que trae React Native (PanResponder): una librería de deslizadores
 * es código nativo, y eso no viaja por OTA. VoiceOver la mueve con el gesto de ajustar.
 */
export default function Deslizador({
  valor,
  min,
  max,
  paso,
  alMover,
  etiqueta,
  textoDelValor,
  testID,
}: {
  valor: number;
  min: number;
  max: number;
  paso: number;
  alMover: (v: number) => void;
  etiqueta: string;
  textoDelValor?: string;
  testID?: string;
}) {
  useTema();
  const [ancho, setAncho] = useState(0);
  const ahora = useRef({ valor, ancho: 0, min, max, paso, alMover });
  ahora.current = { valor, ancho, min, max, paso, alMover };
  const alEmpezar = useRef(valor);

  const aValor = (x: number) => {
    const u = ahora.current;
    const f = Math.max(0, Math.min(1, x / Math.max(1, u.ancho - PERILLA)));
    return Math.round((u.min + f * (u.max - u.min)) / u.paso) * u.paso;
  };

  const gestos = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Adentro de una hoja que se desplaza: el dedo en la barra es de la barra.
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const v = aValor(e.nativeEvent.locationX - PERILLA / 2);
          alEmpezar.current = v;
          ahora.current.alMover(v);
        },
        onPanResponderMove: (_, g) => {
          const u = ahora.current;
          const xInicio = ((alEmpezar.current - u.min) / (u.max - u.min)) * Math.max(1, u.ancho - PERILLA);
          u.alMover(aValor(xInicio + g.dx));
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const fraccion = Math.max(0, Math.min(1, (valor - min) / (max - min)));
  const x = fraccion * Math.max(0, ancho - PERILLA);
  return (
    <View
      testID={testID}
      style={estilos.todo}
      onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={etiqueta}
      accessibilityValue={{ min, max, now: valor, text: textoDelValor }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const sube = e.nativeEvent.actionName === 'increment';
        alMover(Math.max(min, Math.min(max, valor + (sube ? paso : -paso))));
      }}
      {...gestos.panHandlers}
    >
      <View style={estilos.pista} pointerEvents="none">
        <View style={[estilos.lleno, { width: x + PERILLA / 2 }]} />
      </View>
      <View style={[estilos.perilla, { left: x }]} pointerEvents="none" />
    </View>
  );
}

const estilos = conTema(() => StyleSheet.create({
  // 44 de alto aunque se vea fina: se toca con el pulgar.
  todo: { height: 44, justifyContent: 'center' },
  pista: { height: 4, borderRadius: 999, backgroundColor: C.barraPista, overflow: 'hidden' },
  lleno: { height: '100%', backgroundColor: C.claro },
  perilla: { position: 'absolute', top: 10, width: PERILLA, height: PERILLA, borderRadius: PERILLA / 2, backgroundColor: C.claro, ...luz(C.claro, 0.4, 6) },
}));
