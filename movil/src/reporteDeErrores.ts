import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { reportarErroresA } from './cajaNegra';

/**
 * EL BUZÓN DE ERRORES DE JS — manda afuera lo que la app no atrapó.
 *
 * POR QUÉ. Una actualización por el aire le llega a todos en segundos, y un
 * error de JS —no un crash nativo— NO aparece en el reporte de fallos de App
 * Store Connect: pasa en silencio. Sin esto, la única señal de que la app le
 * tiró a alguien es que esa persona lo cuente. La tabla `errores_js` (por la
 * anon key, con RLS: cualquiera inserta, nadie lee desde el cliente) es donde
 * queda el rastro. Ver `supabase/migracion-49-buzon-de-errores.sql`.
 *
 * QUÉ MANDA Y QUÉ NO. Mensaje, pila, pantalla/contexto, versión de la app y de
 * OTA, plataforma y un id anónimo por instalación. NADA de datos personales ni
 * contenido del usuario: el id es un número al azar guardado en el teléfono,
 * solo sirve para saber si diez errores son de diez aparatos o del mismo.
 *
 * CÓMO. Se engancha al sumidero de la caja negra (`registrarError` ya recibe
 * todo: los errores sin atrapar del handler global, las promesas sin catch, y
 * los del límite de React). Dispara y se olvida: NO reintenta, NO encola, NO
 * espera. Un reporte que rompe la app es peor que no tener reporte, así que
 * todo cuelga de un try/catch y nada de esto puede tirar hacia afuera.
 *
 * ES JS PURO / OTA: `expo-constants`, `expo-updates` y AsyncStorage ya están en
 * la build; no agrega ningún módulo nativo.
 */

// ---- TOPES, para que una tormenta de errores no martille la red ----
//
// "Que no reintente ni encole" (dixit el humano). Pero un bucle de render puede
// tirar el MISMO error decenas de veces por segundo, y dispararlos todos sí
// sería martillar. Estos topes no son una cola —no guardan nada para después—:
// solo dejan de mandar. Un tope alcanzado es en sí la señal de que algo anda en
// loop.
const TOPE_POR_SESION = 25;
const VENTANA_REPETIDO_MS = 10_000;
let enviadosEnLaSesion = 0;
const vistosHace = new Map<string, number>();

// La pantalla actual, para el campo `pantalla`. La setea el layout con
// `usePathname` (`fijarPantalla`); si nunca se seteó, queda el contexto que
// trae `registrarError` ("al dibujar (en X)", "al pedir la sesión", …).
let pantallaActual: string | null = null;
export function fijarPantalla(ruta: string | null) {
  pantallaActual = ruta;
}

const CLAVE_ID = 'ascent:id-anonimo';
let idAnonimo: string | null = null;

/** Un id al azar por instalación. Sin PII: no sale de ningún dato de la persona. */
function nuevoId(): string {
  const azar = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${azar()}${azar()}`;
}

async function cargarId(): Promise<void> {
  try {
    const guardado = await AsyncStorage.getItem(CLAVE_ID);
    if (guardado) {
      idAnonimo = guardado;
      return;
    }
    idAnonimo = nuevoId();
    await AsyncStorage.setItem(CLAVE_ID, idAnonimo);
  } catch {
    // Sin almacenamiento, un id de esta corrida igual sirve para agrupar.
    idAnonimo = idAnonimo ?? nuevoId();
  }
}

function versionApp(): string {
  return (Constants.expoConfig?.version ?? 'desconocida').slice(0, 100);
}

function versionOta(): string {
  // `updateId` es null cuando corre la build incrustada (sin OTA aplicada);
  // ahí lo que identifica la versión es la huella de ejecución.
  const id = Updates.updateId ?? `incrustada@${Updates.runtimeVersion ?? '?'}`;
  return id.slice(0, 100);
}

function mensajeDe(e: unknown): string {
  if (e instanceof Error) return (e.message || e.name || 'Error').slice(0, 2000);
  if (typeof e === 'string') return e.slice(0, 2000);
  try {
    return JSON.stringify(e).slice(0, 2000);
  } catch {
    return String(e).slice(0, 2000);
  }
}

function pilaDe(e: unknown): string | null {
  const s = e instanceof Error ? e.stack : null;
  return s ? s.slice(0, 8000) : null;
}

/** El insert, disparado y olvidado. Nunca tira, nunca espera a nadie. */
function enviar(donde: string, e: unknown): void {
  try {
    if (enviadosEnLaSesion >= TOPE_POR_SESION) return;

    const clave = mensajeDe(e);
    const ahora = Date.now();
    const antes = vistosHace.get(clave);
    if (antes !== undefined && ahora - antes < VENTANA_REPETIDO_MS) return;
    vistosHace.set(clave, ahora);

    enviadosEnLaSesion++;
    const pantalla = (pantallaActual ? `${pantallaActual} · ${donde}` : donde).slice(0, 300);

    // En una función aparte, sin que el que llamó espere: el error ya quedó en
    // la caja negra; esto va por su lado y no puede frenar ni romper el hilo que
    // venía tirando. El try/catch de adentro es obligatorio: un insert que falla
    // (sin red, RLS, lo que sea) NO puede volverse una promesa sin catch —que
    // es, justo, una de las cosas que este archivo reporta.
    void (async () => {
      try {
        await supabase.from('errores_js').insert({
          mensaje: clave,
          stack: pilaDe(e),
          pantalla,
          version_app: versionApp(),
          version_ota: versionOta(),
          plataforma: Platform.OS,
          id_anonimo: idAnonimo,
        });
      } catch {
        /* fire-and-forget: sin red o sin permiso, se pierde y ya */
      }
    })();
  } catch {
    /* nada de esto puede romper al que registró el error */
  }
}

/**
 * Enciende el buzón: carga el id anónimo y engancha el sumidero. Se llama UNA
 * vez, temprano, desde el layout. Es idempotente y no bloquea: si el id todavía
 * no cargó cuando llega el primer error, ese sale con id null y los siguientes
 * ya lo tienen.
 */
export function iniciarReporteDeErrores(): void {
  void cargarId();
  reportarErroresA(enviar);
}
