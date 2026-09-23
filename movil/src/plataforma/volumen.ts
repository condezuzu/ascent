import { Platform } from 'react-native';
import {
  addVolumeListener,
  getVolume,
  setVolume,
  showNativeVolumeUI,
} from 'react-native-volume-manager';
import type { Volumen } from '@nucleo/plataforma';

/**
 * LAS TECLAS DE VOLUMEN SUMAN UNA SERIE (§13f).
 *
 * El bucle de una sesión es *hacer la serie → sumarla → descansar*, y hasta
 * ahora sumarla obligaba a agarrar el teléfono y apuntarle a un botón, doce
 * veces. Con el teléfono apoyado en el banco, una tecla que ya está ahí y se
 * aprieta sin mirar es el gesto correcto.
 *
 * EN LA WEB ES IMPOSIBLE: el navegador no ve las teclas físicas. Es de lo
 * poco que solo se gana al ser una app de verdad.
 *
 * ─────────────────────────────────────────────────────────────────────
 * LA CORRECCIÓN QUE YA ESTABA ANOTADA EN LA SPEC
 *
 * *"Con el teléfono en el bolsillo y sin mirar la pantalla"* **no se puede en
 * iOS**: con la pantalla bloqueada el sistema no le entrega las teclas a
 * nadie. Lo que queda, que es el caso real del gimnasio, es el teléfono
 * apoyado con la app abierta.
 *
 * ─────────────────────────────────────────────────────────────────────
 * NO HAY "EVENTO DE TECLA": HAY UN VOLUMEN QUE CAMBIÓ
 *
 * iOS no da las teclas de volumen; da el volumen del sistema. Así que esto
 * escucha el volumen, y cuando se mueve, lo devuelve a donde estaba y cuenta
 * una serie. Tres cosas se siguen de eso:
 *
 *  - **NO SE SABE SI FUE ARRIBA O ABAJO**, y no importa: las dos suman. Es
 *    mejor así — a oscuras y de memoria, cualquiera de las dos es "la tecla".
 *  - **HAY QUE DEJARLE LUGAR PARA LOS DOS LADOS.** Con el volumen en 0 ó en 1,
 *    una de las dos teclas no cambia nada y el sistema no avisa nada: la tecla
 *    quedaría muerta. Por eso, y SOLO en ese caso, el volumen se corre a 0,1 ó
 *    0,9 al empezar. Si estaba en cualquier otro lado no se toca: alguien
 *    escuchando música a su volumen no tiene por qué encontrárselo movido.
 *  - **VOLVER A PONERLO GENERA OTRO AVISO**, que es nuestro. Sin filtrarlo,
 *    cada serie sumaría dos. Se ignora el aviso que trae justo el valor que
 *    acabamos de poner.
 *
 * EL CARTELITO DE VOLUMEN DEL SISTEMA SE APAGA mientras tanto: es un cuadro
 * gris tapando la pantalla doce veces por sesión, y además mostraría el
 * volumen saltando y volviendo, que es exactamente lo que no queremos contar.
 *
 * AL SALIR SE DEJA TODO COMO ESTABA: el volumen de antes y el cartelito
 * prendido. Esto se arma al empezar la sesión y se desarma al terminarla; no
 * vive mientras la app está abierta.
 */

/** Con el volumen acá o más abajo, subir es lo único que se nota. */
const PISO = 0.05;
/** Y acá o más arriba, bajar. */
const TECHO = 0.95;

/** A dónde correrlo cuando está pegado a un extremo. */
const REFUGIO_ABAJO = 0.1;
const REFUGIO_ARRIBA = 0.9;

/**
 * Cuánto tiene que moverse para contar. Una tecla mueve un escalón (1/16 en
 * iOS, o sea 0,0625); esto es la mitad de eso, para no perder un escalón y no
 * contar el ruido de redondeo del propio sistema.
 */
const MINIMO = 0.03;

export const volumenNativo: Volumen = {
  disponible() {
    // Android queda afuera con todo lo demás de esta app.
    return Platform.OS === 'ios';
  },

  escucharTeclas(alApretar) {
    if (Platform.OS !== 'ios') return () => {};

    let vivo = true;
    let original: number | null = null;
    let parado = 0.5;
    let sub: { remove: () => void } | null = null;

    // El volumen se lee antes de tocar nada: es lo que hay que devolver al
    // salir, y es también lo que decide si hace falta correrlo.
    getVolume()
      .then(async (r) => {
        if (!vivo) return;
        original = r.volume;
        parado = r.volume <= PISO ? REFUGIO_ABAJO : r.volume >= TECHO ? REFUGIO_ARRIBA : r.volume;

        try {
          await showNativeVolumeUI({ enabled: false });
        } catch {
          // Si el cartelito no se puede apagar, la función igual sirve: se ve
          // el cuadro gris y se suma la serie. Peor sería no sumarla.
        }
        if (parado !== original) {
          try {
            await setVolume(parado, { showUI: false, playSound: false });
          } catch {
            // Y si no se puede mover, queda como esté: una de las dos teclas
            // no va a hacer nada, pero la otra sí.
          }
        }
        if (!vivo) return;

        sub = addVolumeListener((e) => {
          if (!vivo) return;
          // NUESTRO PROPIO AVISO: `setVolume` dispara esto igual que una tecla.
          // Sin este filtro cada serie contaría dos veces.
          if (Math.abs(e.volume - parado) < MINIMO) return;
          alApretar();
          setVolume(parado, { showUI: false, playSound: false }).catch(() => {});
        });
      })
      .catch(() => {
        // Sin poder leer el volumen no se arma nada. La sesión sigue igual:
        // esto es un atajo, no la única forma de sumar una serie.
      });

    return () => {
      vivo = false;
      sub?.remove();
      sub = null;
      showNativeVolumeUI({ enabled: true }).catch(() => {});
      // COMO ESTABA. Si lo habíamos corrido porque estaba en un extremo, se
      // devuelve al extremo: el volumen del teléfono es de la persona.
      if (original !== null) setVolume(original, { showUI: false, playSound: false }).catch(() => {});
    };
  },
};
