import { Stack, useLocalSearchParams } from 'expo-router';
import ProgresoDeEjercicio from '../../src/ProgresoDeEjercicio';
import DesenfoqueDeVuelta from '../../src/DesenfoqueDeVuelta';

/**
 * `/progreso/<ejercicio>` — apilada encima de las pestañas, como `/marcas`: se entra desde
 * Stats, se mira, se vuelve.
 */
export default function Pantalla() {
  const { ejercicio } = useLocalSearchParams<{ ejercicio: string }>();
  return (
    <DesenfoqueDeVuelta>
      {/* Arrastrar lee el gráfico: volver deslizando queda solo para el borde. */}
      <Stack.Screen options={{ fullScreenGestureEnabled: false }} />
      <ProgresoDeEjercicio ejercicio={String(ejercicio)} />
    </DesenfoqueDeVuelta>
  );
}
