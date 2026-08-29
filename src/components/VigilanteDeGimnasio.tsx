'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { mirarElGimnasio, registrarPorSenal } from '@/lib/gimnasio';
import { decidir } from '@/lib/llegada';
import { guardarVigilancia, leerVigilancia } from '@/lib/sesionCache';
import { usarSesion, type CierreDeSesion } from '@/lib/usarSesion';
import { ESPERA_LLEGADA_MS } from '@/lib/reglas';
import { anotar } from '@/lib/bitacora';
import { hoyISO } from '@/lib/fechas';
import { eventos } from '@/plataforma/eventos';
import { plataforma } from '@/plataforma';
import ResumenSesion from './ResumenSesion';
import type { Perfil } from '@/lib/tipos';

/** Aviso de que el día de hoy cambió, para que la pantalla que lo muestre se refresque. */
export const DIA_CAMBIO = 'ascent:dia-cambio';

/**
 * EL QUE MIRA SI LLEGASTE AL GIMNASIO (§13).
 *
 * POR QUÉ ES UN COMPONENTE DEL ARMAZÓN Y NO PARTE DE INICIO. Vivía adentro de
 * la pantalla principal, así que solo miraba estando en esa pestaña: abrías la
 * app en Stats o en el Álbum y el automático no existía. No hay ninguna razón
 * para que dependa de en qué pestaña estás — llegar al gimnasio no es un
 * asunto de una pantalla.
 *
 * LO QUE SIGUE SIENDO CIERTO, y no se puede tapar en web: mira solo con la app
 * A LA VISTA. El navegador no despierta a nadie. Con la pantalla apagada y el
 * teléfono en el bolsillo, acá no corre nada, y por eso se anota cuándo se
 * detiene: "no arrancó el cronómetro" con la app guardada y con la app abierta
 * son dos problemas distintos con arreglos opuestos.
 *
 * El geofencing de verdad —que el sistema operativo despierte a la app al
 * entrar en la zona— es de la etapa nativa (spec/etapa-nativa.md §13).
 *
 * NO DIBUJA NADA salvo el resumen del final: cuando la sesión la cierra la
 * salida del gimnasio, ese resumen tiene que aparecer estés donde estés, y
 * quien sabe que se cerró es este.
 */
export default function VigilanteDeGimnasio() {
  const [supabase] = useState(() => crearCliente());
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cierre, setCierre] = useState<CierreDeSesion | null>(null);

  const sesion = usarSesion();
  const sesionRef = useRef(sesion);
  sesionRef.current = sesion;
  const perfilRef = useRef(perfil);
  perfilRef.current = perfil;

  const ultimaMirada = useRef(0);
  const mirando = useRef(false);
  // Qué día se registró ya por acá. Evita un RPC por mirada mientras estás en
  // el gimnasio: `registrar_dia` es idempotente, pero pedirlo cada dos minutos
  // durante una hora es un viaje de red por nada.
  const diaRegistrado = useRef<string | null>(null);

  // Solo lo que hace falta para mirar: el punto y el radio. No se trae el
  // perfil entero porque este componente vive en TODAS las pantallas y no
  // tiene por qué pagar una consulta grande en cada una.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const user = await miUsuario(supabase);
      if (!vivo || !user) return;
      const { data } = await supabase
        .from('profiles')
        .select('id, gimnasio_lat, gimnasio_lon, gimnasio_radio')
        .eq('id', user.id)
        .maybeSingle();
      if (vivo && data) setPerfil(data as Perfil);
    })();
    return () => {
      vivo = false;
    };
  }, [supabase]);

  const mirarYActuar = useCallback(
    async (perfilAhora: Perfil) => {
      const s = sesionRef.current;
      const vigilancia = await leerVigilancia();

      // El GPS no es gratis. Si ya sabemos que está en el gimnasio, o si hay
      // una sesión que puede tener que cerrarse, hay algo que hacer pronto y
      // vale mirar seguido. Si está en cualquier otro lado, mirar de nuevo en
      // dos minutos no puede decir nada nuevo: para cambiar de respuesta
      // tendría que haber caminado hasta el gimnasio.
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
        // registrarlo?" es no en los dos casos.
        if (r.registrado || r.yaEstaba) diaRegistrado.current = hoyISO();
        if (r.registrado) eventos.emitir(DIA_CAMBIO);
      }

      const decision = decidir(adentro, medidoEn, Date.now(), vigilancia, {
        corriendo: s.estado.corriendo,
        porUbicacion: s.estado.porUbicacion,
      });

      if (decision.hacer === 'arrancar') {
        await anotar('arranco la sesión', {
          llegada: new Date(decision.desde).toLocaleTimeString(),
        });
        const salio = await s.empezar({ desde: decision.desde, origen: 'ubicacion' });
        // La visita se da por usada SOLO si el arranque llegó. Muchos
        // gimnasios son un subsuelo sin señal: si se marcara igual, un fallo
        // de red de un segundo dejaría a ese día sin sesión para siempre,
        // porque no vuelve a intentar hasta la próxima visita.
        await guardarVigilancia(
          salio ? decision.vigilancia : { ...decision.vigilancia, arranco: false }
        );
        if (!salio) await anotar('no pude arrancar, reintento', {});
        else eventos.emitir(DIA_CAMBIO);
      } else if (decision.hacer === 'terminar') {
        await anotar('cierro la sesión', {
          salida: new Date(decision.hasta).toLocaleTimeString(),
        });
        const cerro = await s.terminar({ hasta: decision.hasta });
        if (cerro && !cerro.deshizoElDia) setCierre(cerro);
        // La visita se borra SOLO si el cierre llegó: adentro tiene la hora de
        // salida, que es lo único que sabe cuándo se fue de verdad.
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
    },
    [supabase]
  );

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
      // siempre y el automático deja de andar hasta recargar la app.
      mirando.current = false;
    }
  }, [mirarYActuar]);

  /**
   * Cuándo mirar: al abrir, al volver a la pantalla, y cada dos minutos
   * mientras la app esté a la vista — con el freno de `mirarYActuar`, que es
   * el que decide si esa mirada se paga o no.
   */
  useEffect(() => {
    if (!perfil?.gimnasio_lat) return;
    let id: ReturnType<typeof setInterval> | undefined;

    const arrancar = () => {
      clearInterval(id);
      const aLaVista = plataforma.ciclo.visible();
      // SE ANOTA CUÁNDO ARRANCA Y CUÁNDO SE DETIENE. Sin esta línea, "no
      // arrancó el cronómetro" tiene dos causas que se ven idénticas en la
      // bitácora —la app guardada en el bolsillo, o abierta y la lógica
      // fallando— y son arreglos opuestos: en la primera, bajar los siete
      // minutos no cambia absolutamente nada.
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
  }, [perfil?.gimnasio_lat, vigilar]);

  if (!cierre) return null;
  return (
    <ResumenSesion
      minutos={cierre.minutos}
      series={cierre.series}
      porUbicacion={cierre.porUbicacion}
      alCerrar={() => setCierre(null)}
    />
  );
}
