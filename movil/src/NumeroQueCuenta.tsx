import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Text, type StyleProp, type TextStyle } from 'react-native';
import { hayQueContar, valorContado } from '@nucleo/contar';

/**
 * UN NÚMERO QUE VIAJA hasta su valor nuevo en vez de reemplazarse. El mismo
 * que la web (`components/NumeroQueCuenta.tsx`), con las mismas dos reglas y
 * la misma cuenta (`nucleo/contar.ts`).
 *
 * 1. **La primera vez no se anima.** Si al abrir la app la racha contara de 0
 *    a 47, estaría contando una historia falsa: no subiste 47 hoy. Solo se
 *    anima cuando el número cambia con la pantalla a la vista.
 * 2. **Cifra tabular.** Sin ancho fijo por dígito el número se sacude mientras
 *    cuenta, que se ve peor que no animarlo. Acá lo pone `fontVariant`, que en
 *    la web es `tabular-nums`.
 *
 * CON "REDUCIR MOVIMIENTO" SALTA DIRECTO: contar es movimiento, y el ajuste
 * del sistema existe para quien eso le hace mal. En web es una media query; en
 * iOS es `AccessibilityInfo`, que además avisa si se cambia con la app
 * abierta.
 *
 * SIN `Animated`: lo que cambia no es una propiedad de estilo sino el TEXTO, y
 * eso `Animated` no lo interpola. Es un `requestAnimationFrame` como en la web.
 */
export default function NumeroQueCuenta({
  valor,
  ms = 700,
  style,
}: {
  valor: number;
  ms?: number;
  style?: StyleProp<TextStyle>;
}) {
  const [mostrado, setMostrado] = useState(valor);
  const [quieto, setQuieto] = useState(false);
  // Lo que está EN PANTALLA, que no siempre es el valor anterior: si el número
  // cambia de nuevo a mitad de una cuenta —47 y enseguida 48—, la cuenta nueva
  // tiene que salir de donde quedó la vieja.
  const enPantalla = useRef(valor);
  enPantalla.current = mostrado;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setQuieto).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setQuieto);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const desde = enPantalla.current;
    // Cuándo se cuenta y qué número va en cada instante vive en
    // `nucleo/contar.ts`, probado con números. Acá queda solo el reloj.
    if (!hayQueContar(desde, valor, quieto)) {
      setMostrado(valor);
      return;
    }
    let vivo = true;
    const t0 = Date.now();
    const paso = () => {
      if (!vivo) return;
      const t = (Date.now() - t0) / ms;
      setMostrado(valorContado(desde, valor, t));
      if (t < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
    return () => {
      vivo = false;
    };
  }, [valor, ms, quieto]);

  return (
    <Text style={[{ fontVariant: ['tabular-nums'] }, style]} allowFontScaling={false}>
      {mostrado}
    </Text>
  );
}
