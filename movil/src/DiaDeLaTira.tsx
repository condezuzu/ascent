import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { paletaDe } from '@nucleo/paletas';

/**
 * UN DÍA DE LA TIRA DE LUNES A DOMINGO, con la animación aprobada en la galería
 * (15/10, «la B»; pasada a la app el 16/10). Los días entran de a uno al montarse la
 * tira y, al terminar, el de hoy —si ya está registrado— pega un saltito y toma un
 * color casi blanco con el tinte del rango. Los números son los de
 * `src/app/galeria/propuestas/animaciones/page.tsx`.
 */
const ESPERA_MS = 120;
const ENTRE_DIAS_MS = 45;
const ENTRA_MS = 320;
const SALTO_MS = 420;
const FIN_DE_LA_ENTRADA = ESPERA_MS + 6 * ENTRE_DIAS_MS + ENTRA_MS;
const CURVA_ENTRA = Easing.bezier(0.2, 0.7, 0.2, 1);
const CURVA_SALTO = Easing.bezier(0.3, 0.6, 0.3, 1);

function mezclar(a: string, b: string, cuanto: number) {
  const h = (x: string) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
  const [ca, cb] = [h(a), h(b)];
  return '#' + ca.map((v, i) => Math.round(v * (1 - cuanto) + cb[i] * cuanto).toString(16).padStart(2, '0')).join('');
}

/** La B: la tinta con un 30 % del claro del rango y el halo del claro; el agujero negro, más oscuro. */
export function colorDelDiaRegistrado(rango: number) {
  const p = paletaDe(rango);
  if (rango === 7) return { relleno: mezclar(p.claro, '#05050A', 0.25), halo: p.principal };
  return { relleno: mezclar('#e8ecf6', p.claro, 0.3), halo: p.claro };
}

export default function DiaDeLaTira({
  indice,
  hoyRegistrado,
  rango,
  letra,
  estiloLetra,
  children,
}: {
  indice: number;
  hoyRegistrado: boolean;
  rango: number;
  letra: string;
  estiloLetra: StyleProp<TextStyle>;
  /** El círculo del día, como se dibujaba antes. */
  children: ReactNode;
}) {
  const entra = useRef(new Animated.Value(0)).current;
  const salto = useRef(new Animated.Value(0)).current;
  const tinta = useRef(new Animated.Value(0)).current;
  const montado = useRef(false);

  useEffect(() => {
    Animated.timing(entra, { toValue: 1, duration: ENTRA_MS, delay: ESPERA_MS + indice * ENTRE_DIAS_MS, easing: CURVA_ENTRA, useNativeDriver: true }).start();
  }, [entra, indice]);

  useEffect(() => {
    // Al montarse espera a que entren los siete; si se registra con la tira a la vista, salta ya.
    const espera = montado.current ? 0 : FIN_DE_LA_ENTRADA + 80;
    montado.current = true;
    if (!hoyRegistrado) {
      tinta.setValue(0);
      return;
    }
    const anim = Animated.parallel([
      Animated.sequence([
        Animated.timing(salto, { toValue: 1, duration: SALTO_MS * 0.4, delay: espera, easing: CURVA_SALTO, useNativeDriver: true }),
        Animated.timing(salto, { toValue: 0, duration: SALTO_MS * 0.6, easing: CURVA_SALTO, useNativeDriver: true }),
      ]),
      Animated.timing(tinta, { toValue: 1, duration: SALTO_MS, delay: espera, easing: Easing.ease, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [hoyRegistrado, salto, tinta]);

  const color = colorDelDiaRegistrado(rango);
  return (
    <Animated.View
      style={[
        estilos.dia,
        {
          opacity: entra,
          transform: [
            { translateY: Animated.add(entra.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }), salto.interpolate({ inputRange: [0, 1], outputRange: [0, -7] })) },
            { scale: salto.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
          ],
        },
      ]}
    >
      <Animated.View>
        {children}
        {hoyRegistrado && (
          <Animated.View
            pointerEvents="none"
            style={[
              estilos.registrado,
              {
                backgroundColor: color.relleno,
                shadowColor: color.halo,
                opacity: tinta,
                transform: [{ scale: tinta.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
              },
            ]}
          />
        )}
      </Animated.View>
      <Text style={estiloLetra}>{letra}</Text>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  dia: { alignItems: 'center', gap: 7 },
  // El halo de la galería (0 0 12px) es una sombra sin corrimiento, del color del claro.
  registrado: { position: 'absolute', left: 0, top: 0, width: 26, height: 26, borderRadius: 13, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
});
