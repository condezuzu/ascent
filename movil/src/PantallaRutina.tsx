import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { numeroDeRango, planetaDeDia } from '@nucleo/rangos';
import { T } from '@nucleo/textos';
import { leerPerfilCache } from '@compartido/cache';
import FondoEspacial from './FondoEspacial';
import MiRutina from './MiRutina';
import { C } from './colores';
import { volverOInicio } from './volver';

/**
 * `/rutina` — TU RUTINA, EN SU PROPIA PANTALLA (15/10). Vivía al fondo de Stats
 * → Entrenamiento, y quien no la buscaba no la encontraba. Ahora se entra desde
 * Inicio, con el día de hoy ya abierto: es lo que se mira antes de ir al gimnasio.
 *
 * Apilada y no una pestaña, como Mis marcas: la barra ya tiene cinco.
 */
export default function PantallaRutina() {
  const router = useRouter();
  const [racha, setRacha] = useState(0);
  // Mientras se arrastra un ejercicio la pantalla no se mueve: si no, el dedo
  // que lleva el ejercicio también hace scroll.
  const [arrastrando, setArrastrando] = useState(false);

  useEffect(() => {
    void leerPerfilCache().then((p) => setRacha(p?.racha_actual ?? 0));
  }, []);

  return (
    <View style={estilos.todo}>
      <FondoEspacial rango={numeroDeRango(racha)} planeta={planetaDeDia(racha)} esquina="arriba-derecha" velo={0.74} />
      <ScrollView contentContainerStyle={estilos.contenido} scrollEnabled={!arrastrando} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => volverOInicio(router)} hitSlop={10}>
          <Text style={estilos.volver}>{T.general.volver}</Text>
        </Pressable>
        <MiRutina visible abrirHoy alArrastrar={setArrastrando} />
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  todo: { flex: 1 },
  contenido: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },
  volver: { color: C.sub, fontSize: 15, paddingVertical: 6 },
});
