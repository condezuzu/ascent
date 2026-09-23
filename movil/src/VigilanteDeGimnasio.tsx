import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DIA_CAMBIO,
  mirarElGimnasio,
  registrarPorSenal,
  SUBIO_RANGO,
} from '@compartido/gimnasio';
import { decidir } from '@nucleo/llegada';
import { guardarVigilancia, leerVigilancia } from '@compartido/sesionCache';
import { perfilVivo } from '@compartido/perfilVivo';
import { useSesion } from '@compartido/useSesion';
import { ESPERA_LLEGADA_MS } from '@nucleo/reglas';
import { anotar } from '@compartido/bitacora';
import { hoyISO } from '@nucleo/fechas';
import { eventos } from '@compartido/eventos';
import { plataforma } from '@plataforma';
import type { Perfil, ResultadoRegistro } from '@nucleo/tipos';
import { supabase } from './supabase';

/**
 * La sesión la cerró la salida del gimnasio, no un toque. Lleva el
 * `CierreDeSesion` de `@compartido/useSesion` como dato.
 */
export const CERRO_SOLA = 'ascent:sesion-cerro-sola';

/**
 * EL QUE MIRA SI LLEGASTE AL GIMNASIO, versión nativa (§13).
 *
 * ES EL MISMO VIGILANTE QUE LA WEB —`src/components/VigilanteDeGimnasio.tsx`—
 * con las mismas reglas, que no están acá: `decidir()` vive en
 * `nucleo/llegada.ts` y la decide igual en las dos apps. Lo que cambia es lo
 * de abajo, y es todo lo que esta app tiene de más.
 *
 * LO QUE ACÁ SÍ SE PUEDE Y EN WEB NO. La web mira **solo con la app a la
 * vista**: el navegador no despierta a nadie, así que con el teléfono en el
 * bolsillo no corre nada. Acá se registra una zona en el sistema operativo y
 * es el TELÉFONO el que levanta a la app al entrar, con la pantalla bloqueada.
 * Ese camino no pasa por este componente —cuando ocurre no hay React— y vive
 * en `llegadaDeFondo.ts`. Este se ocupa del resto.
 *
 * LOS DOS SE NECESITAN, y no es redundancia:
 *  - El de fondo registra **el día** y anota **la hora de llegada**. Es lo que
 *    arregla "fui al gimnasio y el día no entró".
 *  - Este arranca y cierra **la sesión**, que necesita los siete minutos de
 *    espera de §13 y mirar si seguís adentro — dos cosas que no entran en los
 *    treinta segundos que da un despertar en segundo plano.
 * Cuando la app se abre después de un despertar, este lee la visita que dejó
 * el otro y arranca la sesión **fechada en la llegada**, no en el momento en
 * que sacaste el teléfono.
 *
 * NO DIBUJA NADA. En la web este componente muestra el resumen del final;
 * acá el resumen ya lo dibuja Inicio con su propio estado, así que en vez de
 * una segunda copia se emite `CERRO_SOLA` y lo muestra el que ya sabe.
 *
 * VIENE EN DOS PARTES por lo mismo que la web: el de afuera averigua si hay un
 * punto marcado, el de adentro usa `useSesion` y solo se monta si lo hay. Un
 * hook no se puede llamar bajo condición, así que la condición es el montaje.
 */
export default function VigilanteDeGimnasio() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!vivo || !uid) return;
      const p = await perfilVivo(supabase, uid);
      if (vivo && p) setPerfil(p);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (!perfil?.gimnasio_lat) return null;
  return <Mirando perfil={perfil} />;
}

function Mirando({ perfil }: { perfil: Perfil }) {
  const sesion = useSesion();
  const sesionRef = useRef(sesion);
  sesionRef.current = sesion;
  const perfilRef = useRef(perfil);
  perfilRef.current = perfil;

  const ultimaMirada = useRef(0);
  const mirando = useRef(false);
  const diaRegistrado = useRef<string | null>(null);

  const mirarYActuar = useCallback(async (perfilAhora: Perfil) => {
    const s = sesionRef.current;
    const vigilancia = await leerVigilancia();

    // El GPS no es gratis. Si ya sabemos que está en el gimnasio, o si hay una
    // sesión que puede tener que cerrarse, hay algo que hacer pronto y vale
    // mirar seguido. Si está en cualquier otro lado, mirar de nuevo en dos
    // minutos no puede decir nada nuevo.
    const hayAlgoQueHacer = !!vigilancia || s.estado.porUbicacion;
    const CADA = hayAlgoQueHacer ? 0 : 5 * 60 * 1000;
    if (Date.now() - ultimaMirada.current < CADA) return;
    ultimaMirada.current = Date.now();

    const { adentro, medidoEn, metros, precision } = await mirarElGimnasio(perfilAhora);

    // Todo esto queda anotado en el teléfono porque el único lugar donde se
    // puede probar es caminando hasta un gimnasio, y ahí nadie abre una
    // consola. Se mira después, desde Ajustes.
    await anotar('miré', {
      adentro: adentro === null ? 'no sé' : adentro,
      metros,
      precision,
      radio: perfilAhora.gimnasio_radio,
      edadDelPunto: Math.round((Date.now() - medidoEn) / 1000) + 's',
    });

    if (adentro && diaRegistrado.current !== hoyISO()) {
      const r = await registrarPorSenal(supabase, 'ubicacion');
      await anotar('registré el día', { entró: r.registrado, yaEstaba: r.yaEstaba });
      // Se marca también cuando YA estaba: la respuesta a "¿hace falta
      // registrarlo?" es no en los dos casos. Y con el despertar en segundo
      // plano el caso normal pasa a ser justo ese, porque el día ya entró.
      if (r.registrado || r.yaEstaba) diaRegistrado.current = hoyISO();
      if (r.registrado) {
        eventos.emitir(DIA_CAMBIO);
        const reg = r.data as ResultadoRegistro | undefined;
        if (reg?.subio_rango) eventos.emitir(SUBIO_RANGO, reg);
      }
    }

    const decision = decidir(adentro, medidoEn, Date.now(), vigilancia, {
      corriendo: s.estado.corriendo,
      porUbicacion: s.estado.porUbicacion,
    });

    if (decision.hacer === 'arrancar') {
      await anotar('arranco la sesión', { llegada: new Date(decision.desde).toLocaleTimeString() });
      const salio = await s.empezar({ desde: decision.desde, origen: 'ubicacion' });
      // La visita se da por usada SOLO si el arranque llegó. Muchos gimnasios
      // son un subsuelo sin señal: si se marcara igual, un fallo de red de un
      // segundo dejaría a ese día sin sesión para siempre.
      await guardarVigilancia(salio ? decision.vigilancia : { ...decision.vigilancia, arranco: false });
      if (!salio) await anotar('no pude arrancar, reintento', {});
      else eventos.emitir(DIA_CAMBIO);
    } else if (decision.hacer === 'terminar') {
      await anotar('cierro la sesión', { salida: new Date(decision.hasta).toLocaleTimeString() });
      const cerro = await s.terminar({ hasta: decision.hasta });
      if (cerro && !cerro.deshizoElDia) eventos.emitir(CERRO_SOLA, cerro);
      // La visita se borra SOLO si el cierre llegó: `ultimoAdentro` tiene la
      // hora de salida, que es lo único que sabe cuándo se fue de verdad.
      await guardarVigilancia(cerro ? null : vigilancia);
      if (!cerro) await anotar('no pude cerrar, reintento', {});
      else eventos.emitir(DIA_CAMBIO);
    } else {
      await guardarVigilancia(decision.vigilancia);
    }

    if (decision.hacer === 'nada' && decision.vigilancia && !decision.vigilancia.arranco) {
      const faltan = Math.max(
        0,
        Math.round((ESPERA_LLEGADA_MS - (Date.now() - decision.vigilancia.desde)) / 1000)
      );
      await anotar('esperando', { faltanSegundos: faltan });
    }
  }, []);

  const vigilar = useCallback(async () => {
    const perfilAhora = perfilRef.current;
    if (!perfilAhora?.gimnasio_lat) return;

    // UNA SOLA MIRADA A LA VEZ. El intervalo es de dos minutos pero leer el
    // GPS puede tardar segundos, y volver a la pantalla dispara otra mirada al
    // instante. Dos en paralelo pueden decidir las dos "arrancar", y la
    // segunda `iniciar_sesion` se comería a la primera.
    if (mirando.current) return;
    mirando.current = true;
    try {
      await mirarYActuar(perfilAhora);
    } finally {
      // En `finally`: si algo tira, sin esto el vigilante queda trabado para
      // siempre y el automático deja de andar hasta reabrir la app.
      mirando.current = false;
    }
  }, [mirarYActuar]);

  /**
   * LA ZONA EN EL SISTEMA OPERATIVO. Esto es §13 entero: a partir de acá el
   * teléfono despierta a la app al llegar, aunque esté cerrada.
   *
   * SE PIDE UNA VEZ POR PUNTO y se vuelve a pedir al cambiarlo:
   * `startGeofencing` reemplaza la zona anterior de la misma tarea, así que
   * remarcar el punto en Ajustes mueve el círculo sin dejar el viejo dando
   * vueltas.
   *
   * QUE DEVUELVA `false` ES NORMAL y no rompe nada: pasa sin el permiso de
   * "siempre", que iOS pide aparte y se puede negar. Ahí la app queda haciendo
   * exactamente lo que hace la web —mirar mientras esté abierta—, que es el
   * piso con el que esto se diseñó (§13: la app anda entera sin el permiso).
   *
   * NO SE SUELTA AL DESMONTAR. La zona tiene que sobrevivir a que la app se
   * cierre: soltarla en la limpieza del efecto sería apagar la única parte de
   * esto que funciona con la app cerrada. Se suelta al borrar el punto
   * (`ajustes/Gimnasio.tsx`) y al salir de la cuenta, que son los dos momentos
   * en que deja de tener sentido.
   */
  useEffect(() => {
    let vivo = true;
    const centro = { lat: perfil.gimnasio_lat as number, lon: perfil.gimnasio_lon as number };
    (async () => {
      const quedo = await plataforma.ubicacion.vigilarLlegada(centro, perfil.gimnasio_radio, () => {
        // El sistema avisó estando la app viva: mirar YA, sin esperar los dos
        // minutos del intervalo. El día ya lo registró `llegadaDeFondo`.
        ultimaMirada.current = 0;
        void vigilar();
      });
      if (!vivo) return;
      await anotar(
        quedo ? 'zona registrada en el sistema' : 'sin permiso de siempre: solo con la app abierta',
        {}
      );
    })();
    return () => {
      vivo = false;
    };
  }, [perfil.gimnasio_lat, perfil.gimnasio_lon, perfil.gimnasio_radio, vigilar]);

  /**
   * Cuándo mirar: al abrir, al volver a la pantalla, y cada dos minutos
   * mientras la app esté a la vista.
   *
   * EL INTERVALO SIGUE SIENDO DE APP ABIERTA, también acá: un `setInterval` no
   * corre con la app guardada en ningún lado. Lo que cambió es que ya no hace
   * falta que corra para que el día entre — de eso se ocupa el sistema.
   */
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;

    const arrancar = () => {
      clearInterval(id);
      const aLaVista = plataforma.ciclo.visible();
      // SE ANOTA CUÁNDO ARRANCA Y CUÁNDO SE DETIENE: "no arrancó el
      // cronómetro" con la app guardada y con la app abierta son dos problemas
      // distintos con arreglos opuestos.
      anotar(aLaVista ? 'vigilante: mirando' : 'vigilante: detenido (app escondida)', {});
      if (!aLaVista) return;
      vigilar();
      id = setInterval(vigilar, 2 * 60 * 1000);
    };

    arrancar();
    const dejarDeMirar = plataforma.ciclo.alCambiar(arrancar);
    return () => {
      clearInterval(id);
      dejarDeMirar();
    };
  }, [vigilar]);

  return null;
}
