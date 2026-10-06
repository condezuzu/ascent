'use client';

import { useEffect, useState } from 'react';
// El tipo del cliente lo pone cada app: la web y la nativa traen cada una su
// copia de supabase-js, y para TypeScript son dos clases distintas.
import type { Cliente } from '@cliente';
import { crearCliente } from '@cliente';
import { plataforma } from '@plataforma';
import { eventos } from '@compartido/eventos';

/**
 * LA VERSIÓN DE LA BASE. Se pregunta al arrancar, al volver al frente y cuando
 * lo sabido venció (ver `VIGENCIA_MS`).
 *
 * DE DÓNDE SALE: `version_del_esquema()`, que cada migración reescribe con su
 * número desde la 37. Para una base que todavía no tiene esa función hay un
 * puente: si existe `ultimo_peso`, corrió la 36. Más atrás no hace falta
 * mirar: todo lo que se esconde empieza en la 35 y la 36 la implica.
 *
 * SIN SEÑAL NO SE ESCONDE LO QUE YA ESTABA. La última versión que se supo se
 * guarda en el aparato: en el subsuelo del gimnasio, un error de red no puede
 * hacer desaparecer el campo de peso a mitad de la sesión. Una versión solo
 * sube, así que usar la guardada nunca muestra algo que antes no se podía.
 */

const CLAVE = 'ascent:version-esquema';
const NO_EXISTE = (e: { code?: string } | null) => e?.code === 'PGRST202';

let memo: number | null = null;
let sabidaEn = 0;
let enCurso: Promise<number | null> | null = null;
let mirandoElFrente = false;

/**
 * CUÁNTO VALE LO QUE SE SABE (6/10). La versión se preguntaba una vez y quedaba
 * en memoria mientras viviera la app, y en un teléfono eso son días: la app
 * vuelve del fondo, no arranca. El día de la aprobación la base pasó de la 53 a
 * la 61 y el teléfono siguió creyendo 53 —sin "día N", sin peso corporal—
 * hasta que alguien la cerrara a mano. Ahora lo sabido vence: pasado este rato
 * se pregunta de nuevo, y también cada vez que la app vuelve al frente.
 */
export const VIGENCIA_MS = 10 * 60 * 1000;
/** Se emite cuando la versión cambió: las pantallas que la muestran se redibujan. */
export const ESQUEMA_CAMBIO = 'ascent:esquema-cambio';

async function preguntar(supabase: Cliente): Promise<number | null> {
  const { data, error } = await supabase.rpc('version_del_esquema');
  if (!error && typeof data === 'number') return data;
  if (!NO_EXISTE(error)) return null; // la red, no la base: no se sabe
  // El puente para las bases de antes de la 37.
  const puente = await supabase.rpc('ultimo_peso', { p_ejercicio: '' });
  if (!puente.error) return 36;
  return NO_EXISTE(puente.error) ? 0 : null;
}

/**
 * Pregunta de verdad. Una sola a la vez. Si no se puede (la red), queda lo que
 * se sabía: una versión solo sube, así que lo viejo nunca muestra de más.
 */
function refrescar(supabase: Cliente, ahora: number): Promise<number | null> {
  if (!enCurso) {
    enCurso = (async () => {
      const guardada = Number(await plataforma.almacenamiento.leer(CLAVE));
      const conocida = Number.isFinite(guardada) && guardada > 0 ? guardada : null;
      const v = await preguntar(supabase);
      if (v === null) return memo ?? conocida;
      sabidaEn = ahora;
      const cambio = v !== memo;
      memo = v;
      if (v !== conocida) await plataforma.almacenamiento.guardar(CLAVE, String(v));
      if (cambio) eventos.emitir(ESQUEMA_CAMBIO, v);
      return v;
    })().finally(() => {
      enCurso = null;
    });
  }
  return enCurso;
}

export async function versionDelEsquema(supabase: Cliente, ahora: number = Date.now()): Promise<number | null> {
  // AL VOLVER AL FRENTE se pregunta de nuevo. Se engancha una sola vez, acá,
  // para que valga también donde no hay ninguna pantalla que use el hook.
  if (!mirandoElFrente) {
    mirandoElFrente = true;
    plataforma.ciclo.alCambiar((visible) => {
      if (visible && memo !== null) void refrescar(supabase, Date.now());
    });
  }
  if (memo === null) return refrescar(supabase, ahora);
  // VENCIDA NO ES DESCONOCIDA: se contesta con lo que se sabe y se pregunta por
  // atrás. Esto se llama en el camino del "+" de la sesión, y ahí no se puede
  // esperar a la red por un dato que casi nunca cambia.
  if (ahora - sabidaEn > VIGENCIA_MS) void refrescar(supabase, ahora);
  return memo;
}

/** La versión para una pantalla. `null` mientras se averigua. */
export function useVersionDelEsquema(): number | null {
  const [version, setVersion] = useState<number | null>(memo);
  useEffect(() => {
    let vivo = true;
    versionDelEsquema(crearCliente()).then((v) => {
      if (vivo) setVersion(v);
    });
    // Si cambia con la pantalla abierta —la app volvió al frente después de una
    // migración—, se entera sin que nadie la cierre.
    const dejar = eventos.escuchar(ESQUEMA_CAMBIO, (v) => {
      if (vivo && typeof v === 'number') setVersion(v);
    });
    return () => {
      vivo = false;
      dejar();
    };
  }, []);
  return version;
}
