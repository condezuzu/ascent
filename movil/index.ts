// LA CAJA NEGRA VA PRIMERO: engancha los errores antes de que se cargue nada
// de la app (ver `src/cajaNegra.ts`). Los imports se evalúan en orden.
import './src/cajaNegra';
import { registerRootComponent } from 'expo';

import Raiz from './src/Raiz';

// `Raiz` carga `App` adentro de un try y muestra qué falló si algo tira: ver
// `src/Raiz.tsx`. registerRootComponent llama a
// AppRegistry.registerComponent('main', () => Raiz).
registerRootComponent(Raiz);
