import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import { ESCALON_MS, SURGIR_MS, SURGIR_PX } from '@nucleo/animacion';
import { CURVA } from '@nucleo/deslizar';

/**
 * CÓMO SE MUEVE LA APP (30/10). Había 46 duraciones y 14 curvas, y casi nada salía: lo que se iba, se
 * cortaba. Una curva para llegar, una para irse y otra para llenar, y salir siempre más corto que
 * entrar: lo que se va ya no le importa a nadie.
 *
 * TODO CON `Animated`, que está en el binario, así que sale por OTA. Lo que necesita Reanimated, y por
 * lo tanto una build, queda para la 1.2.0: que las filas se reacomoden solas cuando una se va (`layout`)
 * y arrastrar una hoja con el dedo en el hilo de la interfaz.
 */

/** Sale disparada y frena de a poco. Es la curva del viaje entre pestañas. */
export const LLEGA = Easing.bezier(...CURVA);
/** Arranca despacio y se va sin frenar. */
export const SE_VA = Easing.bezier(0.4, 0, 1, 1);
/** Para lo que se llena: una barra, el arco. */
export const LLENA = Easing.bezier(0.2, 0.7, 0.2, 1);

export const MS = {
  entra: SURGIR_MS,
  sale: 220,
  escalon: ESCALON_MS,
  hojaEntra: 340,
  hojaSale: 230,
  cuenta: 480,
  barra: 1100,
  pulgar: 340,
  tic: 240,
  // Dos chips que se reemplazan se cruzan sin pisarse.
  cruceSale: 180,
  cruceEntra: 340,
  cruceDemora: 80,
  // Lo que aparece al empezar a entrenar: primero el bloque, después «Terminar».
  bloque: 150,
  terminar: 300,
  columna: 13,
};

export const DESPLAZA = SURGIR_PX;

export function sinMovimiento() {
  return AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
}

/**
 * Lo que sube y baja por encima de todo: mantiene el `Modal` abierto hasta que termina la salida.
 * `avance` va de 0 (abajo, oculta) a 1 (arriba). Con «reducir movimiento» aparece y se va en el acto.
 */
export function useQueSube(visible: boolean) {
  const [montada, setMontada] = useState(visible);
  const avance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let vivo = true;
    if (visible) setMontada(true);
    void sinMovimiento().then((quieto) => {
      if (!vivo) return;
      Animated.timing(avance, {
        toValue: visible ? 1 : 0,
        duration: quieto ? 0 : visible ? MS.hojaEntra : MS.hojaSale,
        easing: visible ? LLEGA : SE_VA,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && vivo && !visible) setMontada(false);
      });
    });
    return () => {
      vivo = false;
    };
  }, [visible, avance]);
  return { montada, avance };
}
