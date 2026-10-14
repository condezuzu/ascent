import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Insignia from './Insignia';
import { C } from './colores';

/**
 * EL RANGO MÁS ALTO QUE ALCANZÓ, CON FORMA DE MEDALLA (14/10/2026).
 *
 * Era la insignia del rango sola, al lado del número de la racha: se leía como
 * "la racha de hoy" y no como un logro. Ahora cuelga de una cinta y va en un
 * disco con borde, y vive al lado del nombre con las otras medallas. Los
 * colores son los del rango (regla 2): nada suelto.
 */
export default function MedallaDeRango({ rango, tam = 20 }: { rango: number; tam?: number }) {
  const cinta = Math.round(tam * 0.55);
  return (
    <View style={{ width: tam, height: tam + cinta * 0.6, alignItems: 'center' }} pointerEvents="none">
      <Svg width={tam} height={cinta} viewBox="0 0 20 10" style={{ position: 'absolute', top: 0 }}>
        <Path d="M3 0 L9 0 L11.5 10 L6.5 10 Z" fill={C.claro} />
        <Path d="M11 0 L17 0 L13.5 10 L8.5 10 Z" fill={C.sub} />
      </Svg>
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          width: tam,
          height: tam,
          borderRadius: tam / 2,
          borderWidth: Math.max(1, tam / 14),
          borderColor: C.claro,
          backgroundColor: C.hoja,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Insignia rango={rango} tam={Math.round(tam * 0.72)} />
      </View>
    </View>
  );
}
