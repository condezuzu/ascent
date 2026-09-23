import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { supabase } from '../src/supabase';
import Login from '../src/Login';
import Onboarding from '../src/Onboarding';
import FondoRaiz from '../src/FondoRaiz';
import Raiz from '../src/Raiz';
import { sesionDesdeEnlace } from '../src/enlace';
import { ProveedorDeSesion } from '../src/sesionDeLaApp';
import { anotar, marcarListo, registrarError } from '../src/cajaNegra';

/**
 * LA RAÍZ DE LA APP, y desde el 22/9 también la raíz del router.
 *
 * QUÉ ES `app/` Y POR QUÉ APARECIÓ. Expo Router arma la navegación con los
 * archivos de esta carpeta: `index.tsx` es la pantalla de las pestañas, `yo`
 * es el perfil propio, `perfil/[id]` el de un amigo. Hasta ahora las pestañas
 * eran un `useState` y alcanzaba, porque eran cinco pantallas planas sin nada
 * apilado encima. El perfil rompe eso: se entra DESDE Ranking, tiene que poder
 * volver con el gesto de siempre, y un día va a llegar por un enlace.
 *
 * LO QUE NO CAMBIÓ, que es la mitad del trabajo:
 *
 * - **El gesto de deslizar entre pestañas** y **el motor** siguen viviendo en
 *   `Pestanas`, que el router monta como una pantalla más. El router no toca
 *   las pestañas: solo apila cosas ENCIMA. Si alguna vez las pestañas pasan a
 *   ser rutas, el motor se monta y se tumba en cada cambio, que es exactamente
 *   lo que este diseño evita.
 * - **La caja negra** sigue envolviendo todo. Antes era `Raiz` cargando `App`
 *   con un `require`; ahora `Raiz` recibe lo que tiene que envolver, que es el
 *   `Stack`. Lo que hace es lo mismo: si algo tira al dibujar, se ve qué fue.
 * - **La sesión** se decide acá, como antes en `App.tsx`: sin sesión no hay
 *   router que valga, porque no hay adónde navegar.
 */

type Sesion = 'mirando' | 'con' | 'sin' | 'sin-nombre';

export default function Layout() {
  const [sesion, setSesion] = useState<Sesion>('mirando');

  // Con marcas para la caja negra: si la app se queda en negro, dice si llegó
  // a preguntar la sesión y si la respuesta volvió.
  const mirar = useCallback(async () => {
    anotar('pidiendo la sesión');
    try {
      const { data } = await supabase.auth.getSession();
      anotar(`sesión: ${data.session ? 'hay' : 'no hay'}`);
      setSesion(data.session ? 'con' : 'sin');
    } catch (e) {
      registrarError('al pedir la sesión', e);
    }
  }, []);

  useEffect(() => {
    if (sesion !== 'mirando') marcarListo();
  }, [sesion]);

  const sinNombre = useCallback(() => setSesion('sin-nombre'), []);

  // AL SALIR NO HAY QUE DESAPILAR NADA: el stack entero se desmonta cuando la
  // sesión se va, así que el perfil que estuviera encima se va con él. La
  // primera versión llamaba a `dismissAll` y la consola lo cantaba —
  // "POP_TO_TOP was not handled"— porque no había nada que sacar.
  const salir = mirar;

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
    <Raiz>
      <ProveedorDeSesion valor={{ salir, sinNombre }}>
      <View style={estilos.todo}>
        <StatusBar style="light" />
        {sesion === 'mirando' && (
          <View style={estilos.centrado}>
            <ActivityIndicator color="#8a93a8" />
          </View>
        )}
        {sesion === 'sin' && <Login alEntrar={mirar} />}
        {sesion === 'sin-nombre' && <Onboarding alElegir={mirar} />}
        {/* EL STACK SOLO EXISTE CON SESIÓN, y la primera versión lo dejaba
            montado y escondido "para no perder el estado del router". Eso
            estaba mal y se vio en la primera corrida: con el login en pantalla,
            las pestañas de atrás ya se estaban dibujando, Inicio pedía sus
            datos sin sesión, le volvía un 401 y llamaba a `alSalir`. Quedaba
            la barra de abajo y ninguna pantalla.

            Y el estado que se quería conservar no existe: sin sesión no hay
            adónde navegar. */}
        {sesion === 'con' && (
        <View style={estilos.todo}>
          {/* EL MOTOR, DETRÁS DE TODO Y UNA SOLA VEZ. Vivía adentro de las
              pestañas, que era su lugar mientras no hubo nada apilado encima;
              con el perfil, entrar a /yo lo tapaba y el planeta desaparecía.
              Acá está detrás del stack entero, así que lo comparten las
              pestañas y lo que se empuje arriba, sin volver a montarse. */}
          <FondoRaiz />
          {/* EL TEMA DEL NAVEGADOR, CON EL FONDO TRANSPARENTE. Cada pantalla
              del stack nace con el gris claro del sistema (#f2f2f2) debajo, y
              eso tapa el motor: entrar a /yo dejaba la pantalla BLANCA con el
              texto claro encima, ilegible. `contentStyle` no alcanza —en la
              vista web ni siquiera llega—; el color sale del tema. */}
          <ThemeProvider value={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: 'transparent' } }}>
          <Stack
            screenOptions={{
              headerShown: false,
              // El fondo del viaje es el de la app: con el blanco de fábrica,
              // cada empujón de pantalla destella.
              // TRANSPARENTE: detrás está el motor. Con un fondo opaco acá,
              // el planeta quedaría tapado por la propia pantalla.
              contentStyle: { backgroundColor: 'transparent' },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" initialParams={{}} />
          </Stack>
          </ThemeProvider>
        </View>
        )}
      </View>
      </ProveedorDeSesion>
    </Raiz>
  );
}

const estilos = StyleSheet.create({
  todo: { flex: 1, backgroundColor: '#05060a' },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // `display: none` y no desmontar: ver el comentario de arriba.
  escondido: { display: 'none' },
});
