import { ESPERA_LLEGADA_MS } from './reglas.ts';

/**
 * Que la sesión arranque al llegar al gimnasio, y termine al irse (§13).
 *
 * LA DECISIÓN ESTÁ SEPARADA DE TODO LO DEMÁS, a propósito. `decidir()` no sabe
 * de Supabase, ni de GPS, ni de React, ni de qué hora es: recibe lo que se vio
 * y devuelve qué hay que hacer. Es lo único de esta función que se puede
 * probar de verdad — la parte que la envuelve no se puede probar sin un
 * teléfono caminando hasta un gimnasio, y por eso tiene que ser lo más fina
 * posible.
 *
 * POR QUÉ HAY UNA ESPERA. Uno llega, se cambia, saluda: no empieza a entrenar
 * apenas cruza la puerta. Arrancar al instante daría siempre unos minutos de
 * más. Y de paso resuelve solo el falso positivo del que pasa caminando por la
 * puerta camino a otro lado: si no se queda, no dispara nada.
 *
 * POR QUÉ EL INICIO VA HACIA ATRÁS. El cronómetro arranca a los siete minutos,
 * pero la sesión dice la hora en que llegaste. Llegaste 10:00, arranca 10:07,
 * la sesión dice 10:00. Si dijera 10:07 la duración saldría corta siempre, que
 * es peor que no tener el automático: un número equivocado se cree.
 *
 * POR QUÉ SE CIERRA AL SALIR. El que usa el automático es justo el que no se
 * va a acordar de parar el cronómetro. Sin cierre por salida se come el
 * vencimiento de las 4 horas y la sesión queda sin duración.
 *
 * EN WEB ESTO SOLO PASA CON LA APP ABIERTA. No es una limitación que se pueda
 * tapar: el navegador no despierta a nadie. El automático de verdad —que el
 * teléfono despierte a la app al llegar— es geofencing del sistema operativo y
 * está en spec/etapa-nativa.md §13.
 *
 * NO IMPORTA NADA salvo las reglas, igual que `reglas.ts` y `estandares.ts`:
 * así `test:db` la puede cargar con node pelado y probar la decisión de
 * verdad. Lo que hay que guardar entre visitas vive en `sesionCache.ts`, que
 * ya es la casa de las cosas de la sesión que viven en el teléfono.
 */

/**
 * Lo que sabemos de esta visita al gimnasio.
 *
 * `desde` es la hora de llegada y es lo que termina siendo el inicio de la
 * sesión. `ultimoAdentro` es la última vez que se lo vio ahí, y es con lo que
 * se cierra: si la app estuvo cerrada, nos enteramos de que se fue mucho
 * después de que se fue.
 *
 * `arranco` evita que se vuelva a disparar sola después de que la pares a
 * mano. Sin eso, parar el cronómetro estando todavía en el gimnasio lo
 * volvería a encender a los pocos segundos, que es exactamente la clase de
 * cosa que hace que alguien apague la función entera.
 */
export type Vigilancia = {
  desde: number;
  ultimoAdentro: number;
  arranco: boolean;
};

export type Decision =
  | { hacer: 'nada'; vigilancia: Vigilancia | null }
  | { hacer: 'arrancar'; desde: number; vigilancia: Vigilancia }
  | { hacer: 'terminar'; hasta: number; vigilancia: Vigilancia | null };

export type EstadoParaDecidir = {
  corriendo: boolean;
  /** Si arrancó sola. Las que empezaste vos NO se cierran al salir. */
  porUbicacion: boolean;
};

/**
 * Qué hacer con lo que se vio. Pura: mismos argumentos, misma respuesta.
 *
 * `adentro` en `null` significa NO SÉ —sin permiso, sin señal, sin punto
 * cargado— y nunca se trata como "no estás". Confundirlos apagaría la sesión
 * de alguien que sigue entrenando, cada vez que el GPS se pierde adentro de un
 * subsuelo.
 *
 * `medidoEn` es cuándo se midió el punto, no cuándo lo miramos: un arreglo del
 * GPS puede venir de hace un rato, y esa hora está más cerca de la llegada
 * real que `ahora`.
 */
export function decidir(
  adentro: boolean | null,
  medidoEn: number,
  ahora: number,
  vigilancia: Vigilancia | null,
  sesion: EstadoParaDecidir
): Decision {
  if (adentro === null) return { hacer: 'nada', vigilancia };

  if (adentro) {
    const v: Vigilancia = vigilancia
      ? { ...vigilancia, ultimoAdentro: Math.max(vigilancia.ultimoAdentro, medidoEn) }
      : { desde: medidoEn, ultimoAdentro: medidoEn, arranco: false };

    // Ya hay una corriendo, o ya disparamos en esta visita: solo se anota que
    // sigue acá, para poder cerrarla con la hora correcta cuando se vaya.
    if (sesion.corriendo || v.arranco) return { hacer: 'nada', vigilancia: v };

    if (ahora - v.desde < ESPERA_LLEGADA_MS) return { hacer: 'nada', vigilancia: v };

    return { hacer: 'arrancar', desde: v.desde, vigilancia: { ...v, arranco: true } };
  }

  // Se fue. La visita termina acá en cualquier caso: la próxima vez que
  // aparezca es una llegada nueva, con su propia espera.
  if (sesion.corriendo && sesion.porUbicacion) {
    // Se cierra con la última vez que se lo vio adentro, no con ahora.
    return { hacer: 'terminar', hasta: vigilancia?.ultimoAdentro ?? ahora, vigilancia: null };
  }
  return { hacer: 'nada', vigilancia: null };
}

/**
 * Marca la visita como ya disparada, para que parar el cronómetro a mano no se
 * deshaga solo mientras seguís en el gimnasio.
 */
export function marcarComoUsada(v: Vigilancia | null): Vigilancia | null {
  return v ? { ...v, arranco: true } : v;
}
