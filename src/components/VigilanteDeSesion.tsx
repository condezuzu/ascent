'use client';

import { useEffect, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { anotar } from '@/lib/bitacora';
import { plataforma } from '@/plataforma';

/**
 * Anota en la bitácora todo lo que le pasa a la sesión.
 *
 * Existe por el peor bug posible en una app de rachas: que te desloguee sola.
 * Llegás al gimnasio, abrís, te pide entrar — y hoy no hay recuperación de
 * contraseña porque el SMTP está apagado, así que quedar deslogueado es quedar
 * afuera. Si pasa allá, tiene que quedar el rastro para poder mirarlo después.
 *
 * Anota tres cosas, y las tres hacen falta para distinguir causas:
 *
 * 1. **Cada refresco de token y cada pérdida de sesión.** Supabase rota el
 *    refresh token en cada refresco: si dos pedidos refrescan a la vez con el
 *    mismo token, el segundo puede morir con `refresh_token_already_used`.
 *    Acá se ve la secuencia.
 * 2. **Cada rebote a /login.** El middleware marca la URL con `?rebote=1`
 *    cuando manda a entrar a alguien que TENÍA cookies. Eso es un deslogueo
 *    que no pidió nadie, y sin la marca no deja rastro ninguno.
 * 3. **Cada vuelta del segundo plano, con cuánto estuvo afuera.** Es
 *    exactamente lo que pasa mientras entrenás: el teléfono en el bolsillo una
 *    hora y media. Si la sesión se muere ahí, se ve acá.
 *
 * No dibuja nada. Va en el layout para ver todas las pantallas.
 */
export default function VigilanteDeSesion() {
  const [supabase] = useState(() => crearCliente());

  useEffect(() => {
    // ---- 2. el rebote ----
    if (window.location.search.includes('rebote=1')) {
      anotar('REBOTE a /login', { desde: window.location.pathname });
    }

    // ---- 1. lo que le pasa a la sesión ----
    const { data: sub } = supabase.auth.onAuthStateChange((evento, sesion) => {
      // `INITIAL_SESSION` sale en cada carga y no dice nada: sería una línea
      // de ruido por pantalla, y la bitácora tiene sesenta.
      if (evento === 'INITIAL_SESSION') return;

      const vence = sesion?.expires_at
        ? new Date(sesion.expires_at * 1000).toLocaleTimeString('es-UY')
        : undefined;

      if (evento === 'SIGNED_OUT') {
        // En mayúsculas porque es lo que hay que buscar primero al abrir la
        // bitácora después de un día raro.
        anotar('SESIÓN PERDIDA', { evento });
      } else {
        anotar('sesión', { evento, vence });
      }
    });

    // ---- 3. la vuelta del segundo plano ----
    let escondidaDesde: number | null = null;
    const alCambiarVisibilidad = async (visible: boolean) => {
      if (!visible) {
        escondidaDesde = Date.now();
        return;
      }
      if (escondidaDesde === null) return;
      const minutos = Math.round((Date.now() - escondidaDesde) / 60000);
      escondidaDesde = null;
      // Menos de un minuto es cambiar de app y volver: no interesa.
      if (minutos < 1) return;
      // Se pregunta por la sesión DESPUÉS de volver, que es el momento en que
      // se sabría si murió mientras tanto.
      const { data, error } = await supabase.auth.getUser();
      anotar('volví de segundo plano', {
        minutosAfuera: minutos,
        sesión: data.user ? 'viva' : error ? `error: ${error.name}` : 'NO HAY',
      });
    };
    const dejarDeMirar = plataforma.ciclo.alCambiar(alCambiarVisibilidad);

    return () => {
      sub.subscription.unsubscribe();
      dejarDeMirar();
    };
  }, [supabase]);

  return null;
}
