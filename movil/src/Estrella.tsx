import Svg, { Defs, LinearGradient, Path, RadialGradient, Stop, Circle } from 'react-native-svg';
import { C } from './colores';

/**
 * LA VIDA, DIBUJADA (19/10, aprobada en la galería): un destello de cuatro puntas, más alto
 * que ancho, con los lados curvos hacia adentro. `luz` es la de siempre, `hielo` la del día
 * congelado, `apagada` la usada (solo el contorno) y `oscura` la que va en un botón crema.
 */
const PUNTAS = 'M0,-48 C3,-15 9,-6 27,0 C9,6 3,15 0,48 C-3,15 -9,6 -27,0 C-9,-6 -3,-15 0,-48 Z';

/** `porGanar` (21/10): la tercera vida, que se gana con racha de 20; punteada para que no se lea como usada. */
export type ModoDeEstrella = 'luz' | 'hielo' | 'apagada' | 'oscura' | 'porGanar';

export default function Estrella({ tam, modo = 'luz' }: { tam: number; modo?: ModoDeEstrella }) {
  return (
    <Svg width={tam} height={tam} viewBox="-50 -50 100 100">
      <Defs>
        <RadialGradient id="luz" cx="50%" cy="50%" r="55%">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="0.4" stopColor="#f1eee6" />
          <Stop offset="1" stopColor={C.crema} />
        </RadialGradient>
        <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#ffffff" stopOpacity={0.38} />
          <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="hielo" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="1" stopColor={C.hielo} />
        </LinearGradient>
      </Defs>
      {modo === 'apagada' ? (
        <Path d={PUNTAS} fill="none" stroke={C.apagado} strokeWidth={4} strokeLinejoin="round" />
      ) : modo === 'porGanar' ? (
        <Path d={PUNTAS} fill="none" stroke={C.apagado} strokeWidth={4} strokeLinejoin="round" strokeDasharray="7 9" opacity={0.7} />
      ) : (
        <>
          {modo === 'luz' && <Circle cx={0} cy={0} r={50} fill="url(#halo)" />}
          <Path d={PUNTAS} fill={modo === 'oscura' ? C.negro : modo === 'hielo' ? 'url(#hielo)' : 'url(#luz)'} />
        </>
      )}
    </Svg>
  );
}
