// LA CAJA NEGRA VA PRIMERO: engancha los errores antes de que se cargue nada
// de la app (ver `src/cajaNegra.ts`). Los imports se evalúan en orden.
import './src/cajaNegra';
import * as SplashScreen from 'expo-splash-screen';
import { registerRootComponent } from 'expo';
import { anotar, registrarError } from './src/cajaNegra';

// EL SPLASH SE SACA A MANO, SIEMPRE (21/9).
//
// `expo-splash-screen` lo saca solo cuando la app monta su primera vista, y
// hasta entonces queda puesto. Desde el 19/9 el splash es NEGRO PURO, así que
// un splash que no se oculta y una app que no arranca se ven exactamente
// igual: pantalla negra. Pedirlo acá no arregla el arranque, pero saca esa
// posibilidad del medio: si sigue negro con esto, el negro no es el splash.
SplashScreen.hideAsync()
  .then(() => anotar('splash: sacado'))
  .catch((e) => registrarError('al sacar el splash', e));

// LA PANTALLA MÍNIMA (`src/Minimo.tsx`): React Native y nada más, con botones
// para cargar las piezas de a una. Se prende con EXPO_PUBLIC_MINIMO=1 al
// compilar o al levantar Metro. El `require` es a propósito: con `import`, la
// app entera se cargaría igual aunque no se use, que es lo que esto evita.
const MINIMO = process.env.EXPO_PUBLIC_MINIMO === '1';
anotar(MINIMO ? 'arranca la pantalla mínima' : 'arranca la app');

// DE ACÁ EN ADELANTE MANDA EL ROUTER (22/9). `expo-router/entry` registra su
// propio componente raíz y monta `app/_layout.tsx`, que es donde quedaron la
// sesión y la caja negra. Por eso este archivo ya no llama a
// `registerRootComponent` en el camino normal.
//
// SIGUE SIENDO UN `require` Y NO UN `import`: con import, el router entero se
// cargaría también en el arranque mínimo, que existe justamente para no cargar
// nada. Metro empaqueta las dos ramas; solo se evalúa la que corre.
if (MINIMO) {
  registerRootComponent(require('./src/Minimo').default);
} else {
  require('expo-router/entry');
}
