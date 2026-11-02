import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { trazarLineaChiquita, type Progreso } from '@nucleo/progreso';
import { C } from './colores';
import { useTema } from './useTema';

const ANCHO = 46;
const ALTO = 18;

/**
 * LO QUE DICE QUE LA FILA SE TOCA: la forma de tu progreso en ese ejercicio. Con una sola sesión,
 * un punto y lo que va a haber; con solo una marca anotada, el punto hueco, como en el gráfico.
 */
export default memo(function LineaChiquita({ progreso }: { progreso?: Progreso }) {
  useTema();
  const trazo = progreso ? trazarLineaChiquita(progreso, ANCHO, ALTO) : null;
  const unaSesion = (progreso?.sesiones.length ?? 0) === 1;
  return (
    <View testID="linea-chiquita">
      <Svg width={ANCHO} height={ALTO}>
        {trazo ? (
          <>
            <Path d={trazo.linea} fill="none" stroke={C.claro} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />
            <Circle cx={trazo.fin.x} cy={trazo.fin.y} r={1.9} fill={C.claro} />
          </>
        ) : (
          <>
            <Line x1={9} y1={ALTO / 2} x2={ANCHO - 3} y2={ALTO / 2} stroke={C.lineaFuerte} strokeDasharray="3 4" />
            {unaSesion ? (
              <Circle cx={4} cy={ALTO / 2} r={2.2} fill={C.claro} />
            ) : (
              <Circle cx={4} cy={ALTO / 2} r={2.4} fill="none" stroke={C.claro} strokeWidth={1.2} />
            )}
          </>
        )}
      </Svg>
    </View>
  );
});
