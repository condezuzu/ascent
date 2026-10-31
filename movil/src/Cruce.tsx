import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LLEGA, MS, SE_VA, sinMovimiento } from './movimiento';

/**
 * DOS COSAS QUE SE REEMPLAZAN EN EL MISMO LUGAR, sin pisarse (30/10). La que sale queda encima del
 * lugar, sin ocupar lugar y sin recibir toques, y se apaga rápido; la que entra arranca un poco
 * después. Es el chip de «Iniciar entrenamiento» que se vuelve el reloj.
 */
export default function Cruce({ clave, children, style }: { clave: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const anterior = useRef({ clave, nodo: children });
  const [saliendo, setSaliendo] = useState<ReactNode>(null);
  const entra = useRef(new Animated.Value(1)).current;
  const sale = useRef(new Animated.Value(0)).current;

  // Lo último que se dibujó de la clave de ahora: es lo que va a salir cuando cambie.
  useEffect(() => {
    if (anterior.current.clave === clave) anterior.current.nodo = children;
  });

  useEffect(() => {
    if (anterior.current.clave === clave) return;
    const nodoViejo = anterior.current.nodo;
    anterior.current = { clave, nodo: children };
    let vivo = true;
    void sinMovimiento().then((quieto) => {
      if (!vivo || quieto) return;
      setSaliendo(nodoViejo);
      sale.setValue(1);
      entra.setValue(0);
      Animated.parallel([
        Animated.timing(sale, { toValue: 0, duration: MS.cruceSale, easing: SE_VA, useNativeDriver: true }),
        Animated.timing(entra, { toValue: 1, duration: MS.cruceEntra, delay: MS.cruceDemora, easing: LLEGA, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished && vivo) setSaliendo(null);
      });
    });
    return () => {
      vivo = false;
    };
    // Solo con la clave: `children` cambia en cada dibujo y cortaría el cruce en el medio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, entra, sale]);

  return (
    <View style={style}>
      {saliendo !== null && (
        <Animated.View testID="cruce-saliendo" pointerEvents="none" style={[estilos.saliendo, { opacity: sale }]}>
          {saliendo}
        </Animated.View>
      )}
      <Animated.View style={{ opacity: entra }}>{children}</Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  saliendo: { position: 'absolute', top: 0, right: 0 },
});
