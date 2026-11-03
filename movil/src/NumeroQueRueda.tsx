import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import { LLEGA, sinMovimiento, SE_VA } from './movimiento';
import { TextoAnimado } from './Texto';

const ENTRA_MS = 520;
const SALE_MS = 300;

/**
 * UN NÚMERO QUE RUEDA (2/11): el de antes se va para arriba y el nuevo sube desde abajo. Es el de lo que
 * se acaba de sumar, la racha o una serie; una cuenta de 47 a 48 se leía como un parpadeo. La primera vez
 * no se anima, y con «reducir movimiento» cambia en el acto.
 *
 * \`alto\` es el de la línea: de ahí sale cuánto viaja.
 */
export default function NumeroQueRueda({ valor, style, alto, testID }: { valor: number; style?: StyleProp<TextStyle>; alto: number; testID?: string }) {
  const [vista, setVista] = useState<{ ahora: number; antes: number | null; rumbo: number }>({ ahora: valor, antes: null, rumbo: 1 });
  const entra = useRef(new Animated.Value(1)).current;
  const sale = useRef(new Animated.Value(1)).current;
  const enPantalla = useRef(valor);

  useEffect(() => {
    if (valor === enPantalla.current) return;
    const antes = enPantalla.current;
    enPantalla.current = valor;
    let vivo = true;
    void sinMovimiento().then((quieto) => {
      if (!vivo) return;
      if (quieto) return setVista({ ahora: valor, antes: null, rumbo: 1 });
      setVista({ ahora: valor, antes, rumbo: valor > antes ? 1 : -1 });
      entra.setValue(0);
      sale.setValue(0);
      Animated.timing(sale, { toValue: 1, duration: SALE_MS, easing: SE_VA, useNativeDriver: true }).start();
      Animated.timing(entra, { toValue: 1, duration: ENTRA_MS, easing: LLEGA, useNativeDriver: true }).start(({ finished }) => {
        if (finished && vivo) setVista((v) => ({ ...v, antes: null }));
      });
    });
    return () => {
      vivo = false;
    };
  }, [valor, entra, sale]);

  const viaje = alto * 0.6 * vista.rumbo;
  return (
    <View style={estilos.lugar}>
      <TextoAnimado
        testID={testID}
        allowFontScaling={false}
        style={[style, { opacity: entra, transform: [{ translateY: entra.interpolate({ inputRange: [0, 1], outputRange: [viaje, 0] }) }] }]}
      >
        {vista.ahora}
      </TextoAnimado>
      {vista.antes !== null && (
        <TextoAnimado
          allowFontScaling={false}
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[style, estilos.encima, { opacity: sale.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ translateY: sale.interpolate({ inputRange: [0, 1], outputRange: [0, -viaje] }) }] }]}
        >
          {vista.antes}
        </TextoAnimado>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  lugar: { overflow: 'visible' },
  encima: { position: 'absolute', left: 0, top: 0 },
});
