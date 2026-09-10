import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { supabase } from './src/supabase';
import Login from './src/Login';
import Inicio from './src/Inicio';
import Onboarding from './src/Onboarding';
import { sesionDesdeEnlace } from './src/enlace';

/**
 * LA APP NATIVA — qué pantalla va según si hay sesión.
 *
 * TANDA 0 demostró que Expo corre en el teléfono, que habla con la MISMA
 * Supabase y que el núcleo compartido funciona sin tocar una coma. Eso ya no
 * hace falta demostrarlo con una pantalla propia: ahora lo demuestra Inicio,
 * que es la pantalla de verdad.
 *
 * TANDA 1 puso los nueve puertos de `plataforma/`. Su banco de pruebas vive en
 * `src/PruebaDePuertos.tsx` y NO se monta acá: no es una pantalla de la app,
 * se abre cuando haya que probar los puertos con el teléfono en la mano.
 *
 * TANDA 2 es esto: entrar, elegir el nombre si la cuenta es nueva, ver la
 * racha, registrar el día.
 *
 * NO HAY ROUTER TODAVÍA, y es a propósito: con dos pantallas, un router es
 * una dependencia y una capa de indirección para responder una pregunta que
 * `if` contesta. Entra cuando entre la barra de navegación, que es la tanda
 * donde hay cinco pantallas y la pregunta se vuelve de verdad.
 */

type Sesion = 'mirando' | 'con' | 'sin' | 'sin-nombre';

export default function App() {
  const [sesion, setSesion] = useState<Sesion>('mirando');

  const mirar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSesion(data.session ? 'con' : 'sin');
  }, []);

  // Con `useCallback` y no una flecha suelta: `Inicio` la tiene en las
  // dependencias de su carga, y una función nueva en cada render la haría
  // recargar en bucle.
  const sinNombre = useCallback(() => setSesion('sin-nombre'), []);

  // EL ENLACE DEL CORREO. Se mira de las dos formas y hacen falta las dos: la
  // app puede estar CERRADA cuando se toca el enlace —ahí llega como URL
  // inicial— o abierta atrás, y ahí llega como evento. Con una sola, la mitad
  // de las confirmaciones no entran y no hay forma de saber cuál mitad.
  useEffect(() => {
    let vivo = true;
    Linking.getInitialURL().then(async (url) => {
      if (vivo && (await sesionDesdeEnlace(url))) mirar();
    });
    const sub = Linking.addEventListener('url', async ({ url }) => {
      if (await sesionDesdeEnlace(url)) mirar();
    });
    return () => {
      vivo = false;
      sub.remove();
    };
  }, [mirar]);

  useEffect(() => {
    mirar();
    // También cuando cambia sola: el token se renueva, o la sesión vence
    // estando la app abierta. Sin esto, una sesión muerta deja la pantalla
    // mostrando datos viejos hasta que alguien la recargue.
    const { data } = supabase.auth.onAuthStateChange(() => mirar());
    return () => data.subscription.unsubscribe();
  }, [mirar]);

  return (
    <View style={estilos.todo}>
      <StatusBar style="light" />
      {sesion === 'mirando' && (
        <View style={estilos.centrado}>
          <ActivityIndicator color="#8a93a8" />
        </View>
      )}
      {sesion === 'sin' && <Login alEntrar={mirar} />}
      {sesion === 'sin-nombre' && <Onboarding alElegir={mirar} />}
      {sesion === 'con' && <Inicio alSalir={mirar} alFaltarNombre={sinNombre} />}
    </View>
  );
}

const estilos = StyleSheet.create({
  todo: { flex: 1, backgroundColor: '#05060a' },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
