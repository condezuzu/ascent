import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { T } from '@nucleo/textos';
import { C, conTema, luz } from './colores';
import { LLEGA, sinMovimiento } from './movimiento';
import { Fantasma } from './roles';
import Tocable from './Tocable';
import { useTema } from './useTema';

const ALTO = 44;
const PUNTO = 10;
const FIN = 46; // Lo que ocupan el pin y el día a la derecha.
const MUESTRAS = 9;

// El camino: una curva suave de izquierda a derecha. El punto va por las mismas muestras.
const altura = (f: number) => ALTO / 2 + Math.sin(f * Math.PI * 2) * 9;

/**
 * EL DÍA ENTRA SOLO AL LLEGAR, Y SE VE (propuesta D, aprobada el 31/10). Decía «Marca tu gimnasio: el
 * día entra solo al llegar.». Ahora un punto camina hasta el pin y el día se llena. Camina una vez al
 * aparecer y de nuevo al tocarlo: en Inicio, un bucle sería ruido. VoiceOver lee el texto de siempre.
 */
export default function GimnasioExplicado({ alMarcar }: { alMarcar: () => void }) {
  useTema();
  const [ancho, setAncho] = useState(0);
  const [lleno, setLleno] = useState(false);
  const camino = useRef(new Animated.Value(0)).current;
  const onda = useRef(new Animated.Value(0)).current;
  const dia = useRef(new Animated.Value(1)).current;
  const ocupado = useRef(false);
  const vivo = useRef(true);

  const caminar = async () => {
    if (ocupado.current) return;
    ocupado.current = true;
    if (await sinMovimiento()) {
      if (!vivo.current) return;
      camino.setValue(1);
      setLleno(true);
      ocupado.current = false;
      return;
    }
    if (!vivo.current) return;
    setLleno(false);
    camino.setValue(0);
    Animated.timing(camino, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start(() => {
      if (!vivo.current) return;
      onda.setValue(0);
      Animated.timing(onda, { toValue: 1, duration: 620, easing: LLEGA, useNativeDriver: true }).start();
      setLleno(true);
      dia.setValue(0);
      Animated.timing(dia, { toValue: 1, duration: 520, easing: LLEGA, useNativeDriver: true }).start();
      ocupado.current = false;
    });
  };

  useEffect(() => {
    vivo.current = true;
    const t = setTimeout(() => void caminar(), 900);
    return () => {
      vivo.current = false;
      clearTimeout(t);
    };
    // Una vez, al aparecer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const largo = Math.max(1, ancho - FIN);
  const fracciones = Array.from({ length: MUESTRAS }, (_, i) => i / (MUESTRAS - 1));
  const d = fracciones.map((f, i) => `${i ? 'L' : 'M'}${(PUNTO / 2 + f * (largo - PUNTO)).toFixed(1)} ${altura(f).toFixed(1)}`).join(' ');

  return (
    <View style={estilos.fila} testID="gimnasio-explicado">
      <Tocable
        hundir={1}
        style={estilos.escena}
        onPress={() => void caminar()}
        onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
        accessibilityLabel={T.inicio.gimnasioRecordatorioNativo}
        testID="gimnasio-escena"
      >
        {ancho > 0 && (
          <>
            <Svg width={ancho} height={ALTO} pointerEvents="none">
              <Path d={d} fill="none" stroke={C.lineaFuerte} strokeWidth={1.5} strokeDasharray="2 6" strokeLinecap="round" />
              <Path transform={`translate(${largo + 2},${ALTO / 2 - 9})`} d="M7 16s6-5.4 6-10A6 6 0 0 0 1 6c0 4.6 6 10 6 10Z" fill="none" stroke={C.claro} strokeWidth={1.3} />
              <Circle cx={largo + 9} cy={ALTO / 2 - 3} r={2} fill="none" stroke={C.claro} strokeWidth={1.3} />
            </Svg>
            <Animated.View
              pointerEvents="none"
              style={[estilos.onda, { left: largo - 9, opacity: onda.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }), transform: [{ scale: onda.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }] }]}
            />
            <Animated.View
              testID="gimnasio-punto"
              pointerEvents="none"
              style={[
                estilos.punto,
                {
                  transform: [
                    { translateX: camino.interpolate({ inputRange: fracciones, outputRange: fracciones.map((f) => f * (largo - PUNTO)) }) },
                    { translateY: camino.interpolate({ inputRange: fracciones, outputRange: fracciones.map((f) => altura(f) - PUNTO / 2) }) },
                  ],
                },
              ]}
            />
            <Animated.View
              testID={lleno ? 'gimnasio-dia-lleno' : 'gimnasio-dia'}
              pointerEvents="none"
              style={[estilos.dia, lleno && estilos.diaLleno, { transform: [{ scale: dia.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.5, 1.25, 1] }) }] }]}
            />
          </>
        )}
      </Tocable>
      <Fantasma texto={T.ajustes.gimnasioMarcar} alTocar={alMarcar} testID="gimnasio-marcar" />
    </View>
  );
}

const estilos = conTema(() => StyleSheet.create({
  // La placa: en reposo el planeta le pasa por detrás.
  fila: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: C.linea, backgroundColor: C.placa },
  escena: { flex: 1, height: ALTO },
  punto: { position: 'absolute', left: 0, top: 0, width: PUNTO, height: PUNTO, borderRadius: PUNTO / 2, backgroundColor: C.tinta },
  onda: { position: 'absolute', top: ALTO / 2 - 22, width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.claro },
  dia: { position: 'absolute', right: 2, top: ALTO / 2 - 8, width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: C.claro },
  diaLleno: { backgroundColor: C.claro, ...luz(C.claro, 0.45, 5) },
}));
