import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { T } from '@nucleo/textos';
import Espacio from './bienvenida/Espacio';
import Objetos from './bienvenida/Objetos';
import Circulito from './bienvenida/Circulito';
import RankingDeEntrada from './bienvenida/RankingDeEntrada';
import { MiniAmigo, MiniBloque, MiniSemana } from './bienvenida/Muestras';
import { C } from './colores';

/**
 * LA ENTRADA (15/10, aprobada en la galería): cuatro pantallas, una cosa real de la
 * app cada una —los pesos, el día que entra solo, el amigo en vivo y el ranking—,
 * sobre el espacio de la app. No hay "Saltar": el circulito carga un segundo y
 * medio y recién ahí deja pasar. La última, la del ranking, termina en "Crear
 * cuenta" / "Ya tengo cuenta". Los rangos se ven y no se explican (§7).
 *
 * La misma pantalla que la web (`src/components/bienvenida/Bienvenida.tsx`). Solo
 * la ve un aparato que nunca la vio y nunca tuvo sesión: ver `EntradaYLogin` y
 * `compartido/entradaVista.ts`.
 */
const PANTALLAS = ['pesos', 'llegar', 'amigo', 'ranking'] as const;
type Clave = (typeof PANTALLAS)[number];

/** Segundos desde que apareció la pantalla, para lo que se mueve arriba del texto. */
function useReloj(clave: string) {
  const [t, setT] = useState(0);
  useEffect(() => {
    setT(0);
    const t0 = Date.now();
    const id = setInterval(() => setT((Date.now() - t0) / 1000), 100);
    return () => clearInterval(id);
  }, [clave]);
  return t;
}

export default function Bienvenida({ alSalir }: { alSalir: (destino: 'crear' | 'entrar') => void }) {
  const [clave, setClave] = useState<Clave>('pesos');
  const t = useReloj(clave);
  const entra = useRef(new Animated.Value(0)).current;
  const indice = PANTALLAS.indexOf(clave);

  useEffect(() => {
    entra.setValue(0);
    Animated.timing(entra, { toValue: 1, duration: 500, easing: Easing.bezier(0.2, 0.7, 0.2, 1), useNativeDriver: true }).start();
  }, [clave, entra]);

  const texto = {
    pesos: { titulo: T.bienvenida.pesosTitulo, bajada: T.bienvenida.pesosBajada },
    llegar: { titulo: T.bienvenida.llegarTitulo, bajada: T.bienvenida.llegarBajada },
    amigo: { titulo: T.bienvenida.amigoTitulo, bajada: T.bienvenida.amigoBajada },
    ranking: { titulo: '', bajada: '' },
  }[clave];

  return (
    <View style={estilos.raiz} testID="bienvenida">
      <Espacio />
      {clave === 'amigo' && <Objetos escala={0.6} />}
      {clave === 'ranking' ? (
        <RankingDeEntrada alSalir={alSalir} />
      ) : (
        <>
          <Animated.View
            style={[
              estilos.contenido,
              { opacity: entra, transform: [{ translateX: entra.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] },
            ]}
          >
            {clave === 'pesos' && <MiniBloque t={t} />}
            {clave === 'llegar' && <MiniSemana t={t} />}
            {clave === 'amigo' && <MiniAmigo t={t} />}
            <View>
              <Text style={estilos.titulo}>{texto.titulo}</Text>
              <Text style={estilos.bajada}>{texto.bajada}</Text>
            </View>
          </Animated.View>
          <View style={estilos.pie}>
            <View style={estilos.puntos}>
              {PANTALLAS.map((p, i) => (
                <View key={p} style={[estilos.punto, i === indice && estilos.puntoVivo]} />
              ))}
            </View>
            <Circulito clave={clave} alPasar={() => setClave(PANTALLAS[indice + 1])} />
          </View>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { ...StyleSheet.absoluteFillObject, backgroundColor: C.fondo },
  contenido: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 34 },
  titulo: { color: C.tinta, fontSize: 30, lineHeight: 36, fontWeight: '500', marginBottom: 12 },
  bajada: { color: C.sub, fontSize: 17, lineHeight: 25 },
  pie: { alignItems: 'center', gap: 18, paddingBottom: 50, minHeight: 140, justifyContent: 'flex-end' },
  puntos: { flexDirection: 'row', gap: 8 },
  punto: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.apagado },
  puntoVivo: { backgroundColor: C.tinta },
});
