import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import { DESPERTADOR } from '@nucleo/avisoDescanso';

/**
 * LA PÍLDORA DEL DESCANSO SUENA COMO UN DESPERTADOR (20/10, a pedido): al llegar a 0:00 se
 * sacude un poco, una vez por tanda del despertador, mientras vibra (la vibración la dispara
 * `avisarFin`, una sola vez por descanso). Con «Reducir movimiento», quieta.
 */
export default function TimbreDePildora({ fin, children }: { fin: number | null; children: ReactNode }) {
  const t = useRef(new Animated.Value(0)).current;
  const sonoPara = useRef<number | null>(null);

  useEffect(() => {
    if (!fin || sonoPara.current === fin) return;
    const falta = fin - Date.now();
    // Un descanso que ya terminó hace rato no se festeja al volver a mirarlo.
    if (falta < -1000) return;
    let vivo = true;
    const reloj = setTimeout(async () => {
      if (!vivo || (await AccessibilityInfo.isReduceMotionEnabled().catch(() => false))) return;
      sonoPara.current = fin;
      // Una animación nueva por tanda: la misma instancia no se puede encadenar tres veces.
      const tanda = () => Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: -1, duration: 140, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 1, duration: 140, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 110, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]);
      // Cada sacudón arranca con su tanda de golpes: de arranque a arranque, lo mismo.
      const pausa = DESPERTADOR.entreGolpes * (DESPERTADOR.golpes - 1) + DESPERTADOR.entreTandas - 480;
      Animated.sequence(Array.from({ length: DESPERTADOR.tandas }, (_, i) => (i === 0 ? tanda() : Animated.sequence([Animated.delay(pausa), tanda()])))).start();
    }, Math.max(0, falta));
    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
  }, [fin, t]);

  return (
    <Animated.View
      testID="pildora-timbre"
      style={{
        transform: [
          { rotate: t.interpolate({ inputRange: [-1, 1], outputRange: ['-7deg', '7deg'] }) },
          { scale: t.interpolate({ inputRange: [-1, 0, 1], outputRange: [1.08, 1, 1.08] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
