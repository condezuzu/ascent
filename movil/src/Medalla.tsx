import { useContext, useEffect, useId, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { plataforma } from '@plataforma';
import { C, conAlfa } from './colores';
import { ContextoVisible } from './pedidoDeFondo';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, Path } from 'react-native-svg';
import { CAJA, LADO_ILUMINADO, MATERIALES, trazosDeMedalla, type Trazo } from '@compartido/medallas';
import type { ClaveMaterial, ZonaMedalla } from '@nucleo/medallas';

/**
 * Una medalla por marca, en la app nativa. QUÉ se dibuja vive en
 * `compartido/medallas.ts`, lo mismo que dibuja la web; acá solo se traduce a
 * `react-native-svg`.
 */
export default function Medalla({
  zona,
  material,
  tam = 18,
}: {
  zona: ZonaMedalla;
  material: ClaveMaterial;
  tam?: number;
}) {
  // Igual que en la web: el `id` del recorte sale de `useId` porque en una fila
  // puede haber dos medallas iguales y un `id` repetido se resuelve callado y
  // mal. Los dos puntos no son válidos en un `id` de SVG.
  const recorte = 'medalla' + useId().replace(/:/g, '');
  const mat = MATERIALES[material];
  const { base, cielo, borde } = trazosDeMedalla(zona, mat, tam);

  const destello = useDestello();
  return (
    <View style={{ width: tam, height: tam }} pointerEvents="none">
    <Svg width={tam} height={tam} viewBox={`0 0 ${CAJA} ${CAJA}`} pointerEvents="none">
      <Defs>
        <ClipPath id={recorte}>
          <Circle cx="12" cy="12" r="11" />
        </ClipPath>
      </Defs>
      {base.map(pintar)}
      {/* El lado iluminado, apenas insinuado: separa un objeto de un disco
          plano sin robarle contraste a las estrellas. */}
      <Path d={LADO_ILUMINADO} fill={mat.apagado} opacity={0.55} />
      <G clipPath={`url(#${recorte})`}>{cielo.map(pintar)}</G>
      <Circle cx="12" cy="12" r="11" fill="none" stroke={borde.color} strokeWidth="0.6" opacity={borde.op} />
    </Svg>
      <Destello tam={tam} avance={destello} />
    </View>
  );
}

function pintar(t: Trazo, i: number) {
  if (t.t === 'circulo') {
    return <Circle key={i} cx={t.cx} cy={t.cy} r={t.r} fill={t.color} opacity={t.op} />;
  }
  if (t.t === 'elipse') {
    return (
      <Ellipse
        key={i}
        cx={t.cx}
        cy={t.cy}
        rx={t.rx}
        ry={t.ry}
        fill={t.color}
        opacity={t.op}
        origin={`${t.cx}, ${t.cy}`}
        rotation={t.giro}
      />
    );
  }
  return (
    <Line
      key={i}
      x1={t.x1}
      y1={t.y1}
      x2={t.x2}
      y2={t.y2}
      stroke={t.color}
      strokeWidth={t.ancho}
      strokeLinecap="round"
      opacity={t.op}
    />
  );
}

// ── EL DESTELLO (15/10, aprobado en la galería) ──
//
// Una franja de luz que cruza UNA medalla por vez, cada 5 a 7 s (16/10, a pedido: eran
// 8 a 12), con la app a la vista. Las medallas de la pestaña que se ve se anotan acá y
// el reloj elige una al azar: muchas destellando juntas serían una vidriera, no un premio.
// SOLO LAS QUE SE VEN: las pestañas quedan montadas, y sin esto el sorteo caía seguido en
// una medalla escondida (la cabecera de Inicio) y en el ranking pasaban 12 s sin nada.
const montadas = new Set<() => void>();
let reloj: ReturnType<typeof setTimeout> | null = null;

function programar() {
  if (reloj || montadas.size === 0) return;
  reloj = setTimeout(() => {
    reloj = null;
    const todas = [...montadas];
    if (todas.length && plataforma.ciclo.visible()) todas[Math.floor(Math.random() * todas.length)]();
    programar();
  }, 5000 + Math.random() * 2000);
}

function useDestello(): Animated.Value {
  const avance = useRef(new Animated.Value(0)).current;
  const seVe = useContext(ContextoVisible);
  useEffect(() => {
    if (!seVe) return;
    const pasar = () => {
      avance.setValue(0);
      Animated.timing(avance, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
    };
    montadas.add(pasar);
    programar();
    return () => {
      montadas.delete(pasar);
      if (montadas.size === 0 && reloj) {
        clearTimeout(reloj);
        reloj = null;
      }
    };
  }, [avance, seVe]);
  return avance;
}

function Destello({ tam, avance }: { tam: number; avance: Animated.Value }) {
  // El disco de la medalla es el círculo de radio 11 en una caja de 24.
  const lado = (tam * 22) / 24;
  const ancho = lado * 0.42;
  const x = avance.interpolate({ inputRange: [0, 1], outputRange: [-ancho * 1.4, lado + ancho * 0.4] });
  return (
    <View style={{ position: 'absolute', left: tam / 24, top: tam / 24, width: lado, height: lado, borderRadius: lado / 2, overflow: 'hidden' }}>
      <Animated.View style={{ position: 'absolute', top: -lado * 0.2, width: ancho, height: lado * 1.4, transform: [{ translateX: x }, { rotate: '20deg' }] }}>
        <LinearGradient
          colors={['transparent', conAlfa(C.tinta, 0.75), 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}
