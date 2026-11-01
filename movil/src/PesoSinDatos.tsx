import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { T } from '@nucleo/textos';
import { C } from './colores';
import { useTema } from './useTema';

/**
 * EL GRÁFICO ANTES DE TENER DATOS (propuesta F, aprobada el 31/10). Decía «Anota tu peso y aquí
 * aparece la tendencia. Solo la ves tú.». Ahora se ve el gráfico que va a haber, punteado, y el candado
 * de la sección dice lo otro. El primer peso es un punto; con el segundo ya es `GraficoPeso`.
 * VoiceOver lee el texto de siempre.
 */
export default function PesoSinDatos({ conUno }: { conUno: boolean }) {
  useTema();
  return (
    <View testID="peso-sin-datos" accessible accessibilityLabel={conUno ? T.stats.pesoUnoMas : T.stats.pesoVacio}>
      <Svg width="100%" height={96} viewBox="0 0 300 96" pointerEvents="none">
        <Path d="M4 56 C60 36 90 70 150 52 S240 36 296 30" fill="none" stroke={C.lineaFuerte} strokeWidth={1.4} strokeDasharray="3 7" strokeLinecap="round" />
        {conUno && <Circle cx={30} cy={44} r={3} fill={C.claro} testID="peso-primer-punto" />}
      </Svg>
    </View>
  );
}

