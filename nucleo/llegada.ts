
/**
 * Qué hacer con la sesión según dónde estás (§13).
 *
 * HASTA EL 15/10 LA SESIÓN ARRANCABA SOLA a los siete minutos de llegar, fechada
 * en la llegada, y se cerraba al salir. Se sacó a pedido: llegar registra el día
 * y el cronómetro lo arranca la persona. Queda el cierre al salir, solo para una
 * sesión que haya arrancado sola antes del cambio.
 *
 * LA DECISIÓN ESTÁ SEPARADA DE TODO LO DEMÁS, a propósito. `decidir()` no sabe
 * de Supabase, ni de GPS, ni de React, ni de qué hora es: recibe lo que se vio
 * y devuelve qué hay que hacer.
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

/**
 * UNA VISITA VIEJA NO ES ESTA VISITA (bug del 15/9).
 *
 * La visita solo se borra cuando la app VE que te fuiste. Con la app cerrada al
 * salir —lo normal—, quedaba guardada, y al día siguiente se leía como la misma:
 * si ya había disparado, la sesión no arrancaba nunca más; si no, arrancaba al
 * instante con la hora de llegada de ayer. Tres horas sin verte adentro es más
 * que el tope de una sesión (dos horas) más la media hora sin actividad: pasado
 * eso, la visita guardada ya no dice nada de esta.
 */
export const VISITA_VENCIDA_MS = 3 * 60 * 60 * 1000;

export type Decision =
  | { hacer: 'nada'; vigilancia: Vigilancia | null }
  | { hacer: 'terminar'; hasta: number; vigilancia: Vigilancia | null };

export type EstadoParaDecidir = {
  corriendo: boolean;
  /** Si arrancó sola. Las que empezaste vos NO se cierran al salir. */
  porUbicacion: boolean;
};

/**
 * Qué hacer con lo que se vio. Pura: mismos argumentos, misma respuesta.
 *
 * LLEGAR YA NO ARRANCA LA SESIÓN (15/10, a pedido): llegar registra el día y nada
 * más —eso lo hace el vigilante aparte, con `registrarPorSenal`—, y el cronómetro
 * lo arranca la persona con "Iniciar entrenamiento". Lo único que queda acá es
 * cerrar al salir una sesión que haya arrancado sola ANTES del cambio: una que
 * estaba corriendo cuando llegó la actualización.
 *
 * `adentro` en `null` significa NO SÉ —sin permiso, sin señal, sin punto
 * cargado— y nunca se trata como "no estás". Confundirlos apagaría la sesión
 * de alguien que sigue entrenando, cada vez que el GPS se pierde adentro de un
 * subsuelo.
 *
 * `medidoEn` es cuándo se midió el punto, no cuándo lo miramos: un arreglo del
 * GPS puede venir de hace un rato, y esa hora está más cerca de la salida real
 * que `ahora`.
 */
export function decidir(
  adentro: boolean | null,
  medidoEn: number,
  ahora: number,
  vigilancia: Vigilancia | null,
  sesion: EstadoParaDecidir
): Decision {
  if (adentro === null) return { hacer: 'nada', vigilancia };

  // Una visita de hace horas es otra visita. Se compara contra lo MEDIDO, que
  // es del mismo reloj que `ultimoAdentro`.
  if (vigilancia && medidoEn - vigilancia.ultimoAdentro > VISITA_VENCIDA_MS) vigilancia = null;
  const sola = sesion.corriendo && sesion.porUbicacion;

  if (adentro) {
    // Sin una sesión que arrancó sola no hay nada que seguir: sin visita guardada,
    // el vigilante vuelve a mirar cada cinco minutos y no cada cinco segundos.
    if (!sola) return { hacer: 'nada', vigilancia: null };
    // Se anota que sigue acá, para cerrarla con la hora correcta cuando se vaya.
    const v: Vigilancia = vigilancia
      ? { ...vigilancia, ultimoAdentro: Math.max(vigilancia.ultimoAdentro, medidoEn) }
      : { desde: medidoEn, ultimoAdentro: medidoEn, arranco: true };
    return { hacer: 'nada', vigilancia: v };
  }

  // Se fue: se cierra con la última vez que se lo vio adentro, no con ahora.
  if (sola) return { hacer: 'terminar', hasta: vigilancia?.ultimoAdentro ?? ahora, vigilancia: null };
  return { hacer: 'nada', vigilancia: null };
}

/**
 * Marca la visita como ya disparada, para que parar el cronómetro a mano no se
 * deshaga solo mientras seguís en el gimnasio.
 */
/**
 * LO QUE SE GUARDA NO DESMARCA UNA VISITA YA USADA (13/10). La mirada del
 * vigilante lee la visita, espera al GPS (segundos) y recién después guarda: si
 * en el medio se tocó "Terminar" —que la marca como usada— el guardado la pisaba
 * con la foto vieja y la sesión se volvía a prender sola. `enDisco` es lo que
 * hay guardado AHORA, leído justo antes de guardar; "la misma visita" es el
 * mismo `desde`.
 */
export function sinDesmarcar(nueva: Vigilancia | null, enDisco: Vigilancia | null): Vigilancia | null {
  return nueva && enDisco && enDisco.arranco && enDisco.desde === nueva.desde ? { ...nueva, arranco: true } : nueva;
}

export function marcarComoUsada(v: Vigilancia | null): Vigilancia | null {
  return v ? { ...v, arranco: true } : v;
}
