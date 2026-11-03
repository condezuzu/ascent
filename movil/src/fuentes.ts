import type { TextStyle } from 'react-native';

/** Las familias que un estilo nombra. Inter es lo que hay si no nombra ninguna. */
export const L = { dato: 'Geist Mono', racha: 'Outfit' } as const;

const ARCHIVOS = {
  Inter_300Light: require('../assets/fuentes/Inter_300Light.ttf'),
  Inter_400Regular: require('../assets/fuentes/Inter_400Regular.ttf'),
  Inter_400Regular_Italic: require('../assets/fuentes/Inter_400Regular_Italic.ttf'),
  Inter_500Medium: require('../assets/fuentes/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('../assets/fuentes/Inter_600SemiBold.ttf'),
  Outfit_200ExtraLight: require('../assets/fuentes/Outfit_200ExtraLight.ttf'),
  Outfit_300Light: require('../assets/fuentes/Outfit_300Light.ttf'),
  GeistMono_200ExtraLight: require('../assets/fuentes/GeistMono_200ExtraLight.ttf'),
  GeistMono_300Light: require('../assets/fuentes/GeistMono_300Light.ttf'),
  GeistMono_400Regular: require('../assets/fuentes/GeistMono_400Regular.ttf'),
  GeistMono_500Medium: require('../assets/fuentes/GeistMono_500Medium.ttf'),
};

/** Las letras de Moss (la entrada de arriba de Stats). Se cargan aparte: Ascent no las usa para nada más. */
export const LETRAS_DE_MOSS = { titulo: 'CormorantGaramond_400Regular_Italic', texto: 'Jost_400Regular' } as const;

export function cargarFuentesDeMoss() {
  return new Promise<void>((listo) =>
    listo(
      require('expo-font').loadAsync({
        CormorantGaramond_400Regular_Italic: require('../assets/fuentes/CormorantGaramond_400Regular_Italic.ttf'),
        Jost_400Regular: require('../assets/fuentes/Jost_400Regular.ttf'),
      }),
    ),
  ).catch(() => {});
}

let listas = false;

export function fuentesListas() {
  return listas;
}

/**
 * Se cargan debajo del logo. Con tope: una fuente que no llega no puede dejar a nadie afuera de la
 * app (si llega después, se usa desde el próximo dibujo).
 */
export function cargarFuentes(topeMs = 2500) {
  // Adentro y no arriba del archivo: si el módulo nativo faltara en una build, importarlo tiraría toda
  // la app abajo, y sin fuentes la app funciona igual.
  const carga = new Promise<void>((listo) => listo(require('expo-font').loadAsync(ARCHIVOS))).then(
    () => {
      listas = true;
    },
    () => {},
  );
  return Promise.race([carga, new Promise<void>((r) => setTimeout(r, topeMs))]);
}

function numeroDe(peso: TextStyle['fontWeight']) {
  if (peso === 'bold') return 700;
  const n = typeof peso === 'number' ? peso : parseInt(peso ?? '400', 10);
  return Number.isNaN(n) ? 400 : n;
}

/** El archivo de esa familia y ese peso. `null` si la familia no es de las nuestras. */
export function archivoDe(familia: string | undefined, peso: TextStyle['fontWeight'], estilo: TextStyle['fontStyle']) {
  const n = numeroDe(peso);
  if (familia === L.racha) return n <= 200 ? 'Outfit_200ExtraLight' : 'Outfit_300Light';
  if (familia === L.dato) {
    if (n <= 200) return 'GeistMono_200ExtraLight';
    if (n <= 300) return 'GeistMono_300Light';
    return n >= 500 ? 'GeistMono_500Medium' : 'GeistMono_400Regular';
  }
  if (familia) return null;
  if (estilo === 'italic') return 'Inter_400Regular_Italic';
  if (n <= 300) return 'Inter_300Light';
  if (n >= 600) return 'Inter_600SemiBold';
  return n >= 500 ? 'Inter_500Medium' : 'Inter_400Regular';
}
