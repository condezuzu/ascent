import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTransitionProgress } from 'react-native-screens';

/**
 * LA PANTALLA DE ATRÁS, BORROSA MIENTRAS SE VUELVE DESLIZANDO (15/10).
 * *"La pantalla en la que estoy queda sobrepuesta encima de la que viene atrás.
 * Quiero que la de atrás se vea borrosa y se vaya aclarando a medida que arrastro."*
 *
 * Las pantallas apiladas son transparentes (detrás está el motor), así que en el
 * gesto se veían las dos enteras. Esto pone un desenfoque DETRÁS del contenido de
 * la apilada: tapa lo de atrás, y baja con el avance del gesto que da la propia
 * transición nativa. En escalones, como `desenfoqueDelFondo`: un `setState` por
 * píxel de desenfoque y no uno por cuadro. Un `alpha` menor que 1 sobre un
 * desenfoque de iOS lo dibuja mal, por eso se mueve la intensidad.
 */
const PASOS = 14;
const MAXIMO = 60;

// Fuera de la pila nativa (la web) no hay avance: el desenfoque queda fijo.
function useAvance() {
  try {
    return useTransitionProgress();
  } catch {
    return null;
  }
}

export default function DesenfoqueDeVuelta({ children }: { children: ReactNode }) {
  const avance = useAvance();
  const [paso, setPaso] = useState(PASOS);

  useEffect(() => {
    if (!avance) return;
    let progreso = 1;
    let cerrando = 0;
    // Abriendo, se ve en la medida del avance; cerrando (el gesto de volver), al revés.
    const mirar = () => setPaso(Math.round((cerrando ? 1 - progreso : progreso) * PASOS));
    const a = avance.progress.addListener(({ value }) => {
      progreso = value;
      mirar();
    });
    const b = avance.closing.addListener(({ value }) => {
      cerrando = value;
      mirar();
    });
    return () => {
      avance.progress.removeListener(a);
      avance.closing.removeListener(b);
    };
  }, [avance]);

  return (
    <View style={estilos.todo}>
      {paso > 0 && <BlurView style={StyleSheet.absoluteFill} tint="dark" intensity={(paso / PASOS) * MAXIMO} pointerEvents="none" />}
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({ todo: { flex: 1 } });
