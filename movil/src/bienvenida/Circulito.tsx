import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { T } from '@nucleo/textos';
import { C, conAlfa } from '../colores';

/** Lo que tarda en cargar antes de dejar pasar. */
export const CARGA_MS = 1500;
const R = 25;
const LARGO = 2 * Math.PI * R;

/**
 * EL CIRCULITO DE LA ENTRADA (15/10): en vez de "Siguiente" y "Saltar", un aro que
 * se carga en un segundo y medio y recién ahí deja pasar. Se rearma con cada
 * pantalla (`clave`).
 *
 * EL AVANCE VA POR CUADROS, CON ESTADO, y no con un `Circle` animado: animado,
 * `react-native-svg` le pasaba `collapsable={false}` al DOM en la vista web y React
 * lo cantaba en la consola. Son 1,5 s de un dibujo chico: no pesa.
 */
export default function Circulito({ clave, alPasar }: { clave: string; alPasar: () => void }) {
  const [avance, setAvance] = useState(0);
  const listo = avance >= 1;
  useEffect(() => {
    setAvance(0);
    const t0 = Date.now();
    let cuadro = 0;
    const paso = () => {
      const a = Math.min(1, (Date.now() - t0) / CARGA_MS);
      setAvance(a);
      if (a < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [clave]);
  return (
    <Pressable
      testID="bienvenida-siguiente"
      onPress={() => listo && alPasar()}
      disabled={!listo}
      accessibilityRole="button"
      accessibilityLabel={T.bienvenida.siguiente}
      accessibilityState={{ disabled: !listo }}
      hitSlop={10}
      style={estilos.boton}
    >
      <Svg width={58} height={58} viewBox="0 0 58 58">
        <Circle cx={29} cy={29} r={R} fill={listo ? conAlfa(C.tinta, 0.08) : 'none'} stroke={C.lineaFuerte} strokeWidth={1.5} />
        <Circle
          cx={29}
          cy={29}
          r={R}
          fill="none"
          stroke={C.tinta}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray={`${LARGO}`}
          strokeDashoffset={LARGO * (1 - avance)}
          // Arranca arriba, como un reloj.
          transform="rotate(-90 29 29)"
        />
        <Path d="M25 21l8 8-8 8" fill="none" stroke={C.tinta} strokeOpacity={listo ? 1 : 0.25} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  boton: { width: 58, height: 58 },
});
