import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { C } from './colores';
import { useTema } from './useTema';

/** «Solo lo ves tú», dibujado. */
export default function Candado({ etiqueta }: { etiqueta?: string }) {
  useTema();
  return (
    <View testID="candado" accessibilityLabel={etiqueta}>
      <Svg width={13} height={15} viewBox="0 0 13 15" fill="none" stroke={C.apagado} strokeWidth={1.3}>
        <Rect x={1.5} y={6.5} width={10} height={7.5} rx={0.5} />
        <Path d="M4 6.5V4a2.5 2.5 0 0 1 5 0v2.5" />
      </Svg>
    </View>
  );
}
