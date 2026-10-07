import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../colores';

/**
 * EL FONDO DE LA SEGUNDA EN NATIVO: una lista de ejercicios que sube, se inclina,
 * acelera hasta desenfocarse por la velocidad, y termina siendo estrellas. La
 * misma coreografía que la web (`src/components/bienvenida/Registro.tsx`): dice
 * "se anota todo" y hace el puente del registro al espacio —anotás series y eso
 * se vuelve un objeto en el cielo—.
 *
 * DOS CUIDADOS, igual que la web: NO compite con el texto (pasa detrás, al 40%,
 * y se calma antes de que se termine de leer) y se hace UNA sola vez (un bucle
 * volvería el fondo una tragamonedas).
 *
 * El desenfoque por velocidad usa el `filter: blur` de estilos —soportado en la
 * New Architecture (Expo SDK 54 / RN 0.81), y también en react-native-web para el
 * barrido—. Va sobre UN contenedor que ya se mueve con `transform`, no renglón
 * por renglón. El recorte de los bordes (en la web un `mask-image`) se hace con
 * dos velos del color del fondo: como el fondo es el mismo negro del cielo, casi
 * no se nota más que en apagar un par de estrellas del borde.
 */

// Nombres del catálogo de la app. Son de verdad: inventar ejercicios en la
// pantalla que promete que anota los tuyos sería empezar mintiendo.
const EJERCICIOS = [
  'Press de banca · 4 × 80 kg',
  'Sentadilla · 5 × 100 kg',
  'Dominadas · 3 × 8',
  'Peso muerto · 3 × 140 kg',
  'Remo con barra · 4 × 60 kg',
  'Press militar · 4 × 45 kg',
  'Curl con barra · 3 × 30 kg',
  'Zancadas · 3 × 20 kg',
  'Fondos · 3 × 10',
  'Elevaciones laterales · 4 × 10 kg',
  'Prensa · 4 × 180 kg',
  'Plancha · 3 × 60 s',
  // MÁS LARGA (8/10): con doce, el viaje llegaba al final de la lista antes de
  // deshacerse y se veía el hueco. Todos del catálogo, como los de arriba.
  'Hip thrust · 4 × 90 kg',
  'Jalón al pecho · 4 × 55 kg',
  'Press inclinado · 4 × 60 kg',
  'Sentadilla búlgara · 3 × 24 kg',
  'Remo en polea · 4 × 50 kg',
  'Curl predicador · 3 × 25 kg',
  'Peso muerto rumano · 4 × 80 kg',
  'Face pull · 3 × 20 kg',
  'Extensión de cuádriceps · 3 × 45 kg',
  'Press Arnold · 3 × 18 kg',
  'Gemelos de pie · 4 × 60 kg',
  'Elevación de piernas colgado · 3 × 12',
];

/**
 * EL DESENFOQUE, SOLO EN LA WEB (8/10). En el iPhone se veía "un cuadrado blanco
 * semitransparente que pasa por encima". `filter: blur` hace que iOS dibuje el
 * contenedor entero aparte, como una sola imagen: con veinte renglones de letra
 * clara, inclinados y al 40%, eso se lee como una placa blancuzca cruzando la
 * pantalla. En el teléfono la velocidad la dan el movimiento y el
 * desvanecimiento; el desenfoque queda para la web, donde se ve bien.
 * (No se pudo ver en un iPhone desde acá: es la causa más probable, leída.)
 */
const CON_DESENFOQUE = Platform.OS === 'web';

/** Lo que dura el viaje de la lista, en segundos. */
const VIAJE_S = 3.4;

// Los puntos que quedan cuando la lista se deshace. Posiciones deterministas,
// como en la web (nada al azar: quedaba amontonado).
const POLVO = Array.from({ length: 26 }).map((_, i) => ({
  left: `${(i * 37) % 100}%`,
  top: `${(i * 61) % 100}%`,
  color: i % 4 === 0 ? C.claro : '#cfd8f0',
  escala: 0.6 + ((i * 13) % 7) / 10,
}));

export default function Registro({ quieto = false }: { quieto?: boolean }) {
  const [t, setT] = useState(quieto ? 1 : 0);

  useEffect(() => {
    if (quieto) return;
    let vivo = true;
    let pedido = 0;
    const t0 = Date.now();
    const paso = () => {
      if (!vivo) return;
      const p = Math.min(1, (Date.now() - t0) / 1000 / VIAJE_S);
      setT(p);
      if (p < 1) pedido = requestAnimationFrame(paso);
    };
    pedido = requestAnimationFrame(paso);
    return () => {
      vivo = false;
      cancelAnimationFrame(pedido);
    };
  }, [quieto]);

  // El recorrido: arranca quieto, acelera —el desplazamiento crece con el
  // cuadrado del tiempo— y en el último tercio se desarma en puntos.
  const avance = t * t;
  const desenfoque = Math.min(6, Math.max(0, (t - 0.45) * 14));
  const inclina = 6 + t * 16;
  const desvanece = t < 0.62 ? 1 : Math.max(0, 1 - (t - 0.62) / 0.28);
  const estrellas = t < 0.55 ? 0 : Math.min(1, (t - 0.55) / 0.35);

  // Los renglones no dependen de `t`: se arman una vez y solo cambia el estilo
  // del contenedor, así el re-render de cada cuadro es barato.
  const renglones = useMemo(
    () =>
      [...EJERCICIOS, ...EJERCICIOS].map((e, i) => (
        <Text key={`${e}-${i}`} style={estilos.renglon}>
          {e}
        </Text>
      )),
    []
  );

  return (
    <View style={estilos.raiz} pointerEvents="none">
      <View
        style={[
          estilos.lista,
          {
            opacity: desvanece * 0.4,
            // El desenfoque por velocidad. La forma STRING la respetan las dos:
            // react-native-web (la mapea a `filter: blur()` de CSS) y la New
            // Architecture en iOS (RN 0.81). La forma array `[{blur}]` no la
            // tomaba react-native-web, así que el barrido no la mostraba.
            ...(CON_DESENFOQUE ? { filter: `blur(${desenfoque}px)` } : null),
            transform: [
              { perspective: 700 },
              { rotateX: `${inclina}deg` },
              { translateY: `${-avance * 62}%` },
            ],
          },
        ]}
      >
        {renglones}
      </View>

      {/* Lo que queda cuando la lista se deshace: los mismos renglones, ahora
          puntos, encendiéndose donde estaba el texto. */}
      <View style={[StyleSheet.absoluteFill, { opacity: estrellas }]} pointerEvents="none">
        {POLVO.map((d, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: d.left as `${number}%`,
              top: d.top as `${number}%`,
              width: 3,
              height: 3,
              borderRadius: 999,
              backgroundColor: d.color,
              transform: [{ scale: d.escala }],
            }}
          />
        ))}
      </View>

      {/* El recorte de arriba y abajo (mask-image en la web). Del color del
          fondo: sobre el cielo negro casi no se nota. */}
      <LinearGradient
        pointerEvents="none"
        colors={[C.fondo, 'transparent']}
        style={[estilos.velo, { top: 0, height: '18%' }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', C.fondo]}
        style={[estilos.velo, { bottom: 0, height: '28%' }]}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  lista: { position: 'absolute', left: 0, right: 0, top: '8%' },
  renglon: {
    fontSize: 15,
    lineHeight: 31,
    color: C.tinta,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  velo: { position: 'absolute', left: 0, right: 0 },
});
