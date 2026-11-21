import { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';
import { FORMAS, LINEAS, SILUETA, trazoDe, type Lado, type Punto } from '@nucleo/cuerpo';
import type { EstadoDelPuntaje } from '@nucleo/puntajeMuscular';
import { MOSS } from './coloresDeMoss';

/** El color de cada estado del estímulo de la semana: el mismo orden que en Moss, con los tonos de Moss. */
export const RELLENO: Record<EstadoDelPuntaje, string> = { sinEntrenar: MOSS.musculoSin, poco: MOSS.musculoPoco, enSuPunto: MOSS.oro, mucho: MOSS.terracota };
const ESPEJO = 'translate(100 0) scale(-1 1)';

type DelMusculo = { estado: EstadoDelPuntaje; vuelveEn: number };

/**
 * EL CUERPO DE LA SECCIÓN DE MOSS (19/11, rehecho el mismo día): las mismas formas que en Moss (`nucleo/cuerpo.ts`,
 * copiado tal cual), de un lado por vez, cada músculo con el color de cuánto se entrenó esta semana. Lo que todavía se
 * recupera lleva un borde punteado, fijo (sin latido, así respeta Reducir movimiento). Con uno elegido, el resto va en
 * gris.
 */
export default function CuerpoDeMoss({ musculos, lado, ancho, elegido, alTocar }: { musculos: ReadonlyMap<string, DelMusculo>; lado: Lado; ancho: number; elegido: string | null; alTocar: (m: string) => void }) {
  return (
    <Svg testID="cuerpo-de-moss" width={ancho} height={(ancho * 192) / 100} viewBox="0 0 100 192">
      <Path d={SILUETA} fill={MOSS.nocheVidrio} stroke={MOSS.linea} strokeWidth={0.8} />
      <Ellipse cx={50} cy={13.8} rx={7.6} ry={9.2} fill={MOSS.nocheVidrio} stroke={MOSS.linea} strokeWidth={0.8} />
      {Object.entries(FORMAS[lado]).flatMap(([m, formas]) => {
        const d = musculos.get(m);
        const marcado = elegido === m;
        const relleno = RELLENO[elegido && !marcado ? 'sinEntrenar' : (d?.estado ?? 'sinEntrenar')];
        const fatigado = !!d && d.vuelveEn > 0;
        return (formas ?? []).flatMap((f, i) =>
          [false, true].map((espejo) => (
            <Path
              key={`${m}-${i}-${espejo}`}
              d={trazoDe(f)}
              transform={espejo ? ESPEJO : undefined}
              fill={relleno}
              stroke={marcado ? MOSS.oroClaro : fatigado ? MOSS.pergamino : 'transparent'}
              strokeWidth={marcado ? 1.6 : 1}
              strokeDasharray={!marcado && fatigado ? '2 1.6' : undefined}
              onPress={() => alTocar(m)}
            />
          ))
        );
      })}
      {LINEAS[lado].flatMap((d, i) => [false, true].map((espejo) => <Path key={`l${i}-${espejo}`} d={d} transform={espejo ? ESPEJO : undefined} fill="none" stroke={MOSS.noche0} strokeOpacity={0.5} strokeWidth={0.6} />))}
    </Svg>
  );
}

/**
 * El pecho o el tríceps solo, de cerca, partido en dos: el pecho alto arriba (un poco más de un tercio) y la cabeza
 * larga del lado del cuerpo (la de adentro), como en Moss. Es un dibujo para ubicarse, no una medida de dónde termina
 * cada parte.
 */
export function ParteDeCerca({ musculo, ancho, alto, parte, resto }: { musculo: 'pecho' | 'triceps'; ancho: number; alto: number; parte: EstadoDelPuntaje; resto: EstadoDelPuntaje }) {
  const id = useId().replace(/:/g, '');
  const lado: Lado = musculo === 'pecho' ? 'frente' : 'espalda';
  const formas = (FORMAS[lado][musculo] ?? []).filter((f): f is Punto[] => Array.isArray(f));
  const puntos = formas.flat();
  const x0 = Math.min(...puntos.map((p) => p[0])), x1 = Math.max(...puntos.map((p) => p[0]));
  const y0 = Math.min(...puntos.map((p) => p[1])), y1 = Math.max(...puntos.map((p) => p[1]));
  // El pecho va entero (las dos mitades se tocan); el tríceps, un brazo solo.
  const conEspejo = musculo === 'pecho';
  const bx0 = conEspejo ? Math.min(x0, 100 - x1) : x0;
  const bx1 = conEspejo ? Math.max(x1, 100 - x0) : x1;
  const w = bx1 - bx0, h = y1 - y0;
  const k = Math.min(ancho / w, alto / h) * 0.9;
  const dx = (ancho - w * k) / 2 - bx0 * k, dy = (alto - h * k) / 2 - y0 * k;
  const corte = musculo === 'pecho' ? y0 + h * 0.42 : x0 + (x1 - x0) * 0.5;
  const dibujar = (relleno: string | null) => formas.flatMap((f, j) => (conEspejo ? [false, true] : [false]).map((espejo) => (
    <Path key={`${j}${espejo}`} d={trazoDe(f)} transform={espejo ? ESPEJO : undefined} fill={relleno ?? 'none'} stroke={relleno ? 'none' : MOSS.pergaminoTenue} strokeWidth={0.5} />
  )));
  return (
    <Svg width={ancho} height={alto}>
      <Defs>
        <ClipPath id={`p${id}`}>{musculo === 'pecho' ? <Rect x={-10} y={y0 - 5} width={120} height={corte - y0 + 5} /> : <Rect x={corte} y={y0 - 5} width={x1 - corte + 5} height={h + 10} />}</ClipPath>
        <ClipPath id={`r${id}`}>{musculo === 'pecho' ? <Rect x={-10} y={corte} width={120} height={y1 - corte + 5} /> : <Rect x={x0 - 5} y={y0 - 5} width={corte - x0 + 5} height={h + 10} />}</ClipPath>
      </Defs>
      <G transform={`translate(${dx} ${dy}) scale(${k})`}>
        <G clipPath={`url(#r${id})`}>{dibujar(RELLENO[resto])}</G>
        <G clipPath={`url(#p${id})`}>{dibujar(RELLENO[parte])}</G>
        {dibujar(null)}
        <Path d={musculo === 'pecho' ? `M${bx0} ${corte}L${bx1} ${corte}` : `M${corte} ${y0}L${corte} ${y1}`} stroke={MOSS.pergamino} strokeWidth={0.6} strokeDasharray="1.5 1.2" />
      </G>
    </Svg>
  );
}

/** Un aro que se llena hasta que el músculo está listo: `hecho` de 0 a 1 (lo que ya pasó de su recuperación). */
export function Reloj({ tam, hecho }: { tam: number; hecho: number }) {
  const r = tam / 2 - 2;
  const c = tam / 2;
  const f = Math.max(0.04, Math.min(1, hecho));
  const a = (-90 + 360 * f) * (Math.PI / 180);
  const arco = f >= 1 ? null : `M${c} ${c - r}A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${c + r * Math.cos(a)} ${c + r * Math.sin(a)}`;
  return (
    <Svg width={tam} height={tam}>
      <Circle cx={c} cy={c} r={r} stroke={MOSS.linea} strokeWidth={2} fill="none" />
      {arco ? <Path d={arco} stroke={MOSS.terracota} strokeWidth={2.4} strokeLinecap="round" fill="none" /> : <Circle cx={c} cy={c} r={r} stroke={MOSS.terracota} strokeWidth={2.4} fill="none" />}
    </Svg>
  );
}
