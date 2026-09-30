import { useCallback, useEffect, useRef } from 'react';

/**
 * VOLVER A PEDIR LOS DATOS CUANDO LAS URL FIRMADAS ESTÁN POR VENCER.
 *
 * Las fotos se sirven con URL firmadas que viven una hora (`createSignedUrl(...,
 * 3600)`). Si te quedás en una pantalla más de una hora, vencen y las fotos dan
 * 403 —se ven ROTAS—, y las ve cualquiera: tu ranking, tu perfil, el de un amigo,
 * un día abierto. Esto las vuelve a pedir cuando faltan diez minutos para la hora:
 *
 *  - **al volver la app al frente**, por el PUERTO DE CICLO DE VIDA (`alCambiar`):
 *    visibilidad/foco en web, `AppState` en nativo. Así las APIs del navegador
 *    quedan detrás del puerto y no en la pantalla (lo exige `test:db` §35).
 *  - **y con un chequeo cada cinco minutos**, por si nunca soltás la pantalla.
 *
 * La guarda de 50 min (las URL viven 60) evita re-bajar todo en cada vuelta
 * corta: solo recarga cuando de verdad están por vencer.
 *
 * Devuelve un `recargar` que envuelve a `cargar` y ANOTA el momento. Usalo para
 * TODAS las cargas de la pantalla —la inicial y la de volver a la pestaña—, no
 * solo las que dispara este hook: así el reloj de "hace cuánto se pidieron"
 * siempre está al día y no se recarga de gusto.
 */

/** Cada cuánto se mira si están por vencer. */
const CHEQUEO_MS = 5 * 60 * 1000;
/** A partir de cuándo se consideran por vencer (viven 3600 s = 60 min). */
const POR_VENCER_MS = 50 * 60 * 1000;

export function useRefrescoDeFirmadas(
  cargar: () => void | Promise<void>,
  alCambiar: (escuchar: (visible: boolean) => void) => () => void
): () => Promise<void> {
  // Todo por refs para que `recargar` sea estable entre renders (el efecto no se
  // rearma y el intervalo no se reinicia en cada dibujo).
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;
  const alCambiarRef = useRef(alCambiar);
  alCambiarRef.current = alCambiar;
  const ultima = useRef(0);

  const recargar = useCallback(async () => {
    await cargarRef.current();
    ultima.current = Date.now();
  }, []);

  useEffect(() => {
    const siPorVencer = () => {
      if (Date.now() - ultima.current > POR_VENCER_MS) recargar();
    };
    const soltar = alCambiarRef.current((visible) => {
      if (visible) siPorVencer();
    });
    const reloj = setInterval(siPorVencer, CHEQUEO_MS);
    return () => {
      soltar();
      clearInterval(reloj);
    };
  }, [recargar]);

  return recargar;
}
