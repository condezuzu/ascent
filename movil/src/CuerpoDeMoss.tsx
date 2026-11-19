import { useWindowDimensions } from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';
import { FORMAS, LINEAS, SILUETA, trazoDe, type Lado } from '@nucleo/cuerpo';
import type { EstadoDeFatiga, EstadoDelPuntaje } from '@nucleo/puntajeMuscular';
import { MOSS } from './coloresDeMoss';

/** El color de cada estado del estímulo de la semana: el mismo orden que en Moss, con los tonos de Moss. */
const RELLENO: Record<EstadoDelPuntaje, string> = { sinEntrenar: MOSS.musculoSin, poco: MOSS.musculoPoco, enSuPunto: MOSS.oro, mucho: MOSS.terracota };

type DelMusculo = { estado: EstadoDelPuntaje; fatiga: EstadoDeFatiga };

/**
 * EL CUERPO DE LA SECCIÓN DE MOSS (19/11): las mismas formas que en Moss (`nucleo/cuerpo.ts`, copiado tal cual), de
 * frente y de espalda, cada músculo con el color de cuánto se entrenó esta semana. Fatigado va como borde encima del
 * color (fijo: sin latido, así respeta Reducir movimiento): entero si está cargado, punteado si se recupera.
 */
export default function CuerpoDeMoss({ musculos, elegido, alTocar }: { musculos: ReadonlyMap<string, DelMusculo>; elegido: string | null; alTocar: (m: string) => void }) {
  const { width } = useWindowDimensions();
  const ancho = Math.min(width - 32, 420);
  const figura = (lado: Lado, x: number) => (
    <G key={lado} transform={`translate(${x} 0)`}>
      <Path d={SILUETA} fill={MOSS.nocheVidrio} stroke={MOSS.linea} strokeWidth={0.8} />
      <Ellipse cx={50} cy={13.8} rx={7.6} ry={9.2} fill={MOSS.nocheVidrio} stroke={MOSS.linea} strokeWidth={0.8} />
      {Object.entries(FORMAS[lado]).flatMap(([m, formas]) => {
        const d = musculos.get(m);
        const relleno = RELLENO[d?.estado ?? 'sinEntrenar'];
        const borde = elegido === m ? MOSS.oroClaro : d?.fatiga === 'cargado' ? MOSS.pergamino : d?.fatiga === 'recuperandose' ? MOSS.pergaminoTenue : 'transparent';
        return (formas ?? []).flatMap((f, i) =>
          [false, true].map((espejo) => (
            <Path
              key={`${m}-${i}-${espejo}`}
              d={trazoDe(f)}
              transform={espejo ? 'translate(100 0) scale(-1 1)' : undefined}
              fill={relleno}
              stroke={borde}
              strokeWidth={elegido === m ? 1.6 : 1}
              strokeDasharray={elegido !== m && d?.fatiga === 'recuperandose' ? '2 1.6' : undefined}
              onPress={() => alTocar(m)}
            />
          ))
        );
      })}
      {LINEAS[lado].flatMap((d, i) => [false, true].map((espejo) => <Path key={`l${i}-${espejo}`} d={d} transform={espejo ? 'translate(100 0) scale(-1 1)' : undefined} fill="none" stroke={MOSS.noche0} strokeOpacity={0.5} strokeWidth={0.6} />))}
    </G>
  );
  return (
    <Svg testID="cuerpo-de-moss" width={ancho} height={(ancho * 192) / 210} viewBox="0 0 210 192">
      {figura('frente', 0)}
      {figura('espalda', 110)}
    </Svg>
  );
}
