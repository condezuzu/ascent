'use client';

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearCliente } from '@/lib/supabase/client';
import { plataforma } from '@/plataforma';

/**
 * LA VERSIÓN DE LA BASE, preguntada una vez por carga de la app.
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
let enCurso: Promise<number | null> | null = null;

async function preguntar(supabase: SupabaseClient): Promise<number | null> {
  const { data, error } = await supabase.rpc('version_del_esquema');
  if (!error && typeof data === 'number') return data;
  if (!NO_EXISTE(error)) return null; // la red, no la base: no se sabe
  // El puente para las bases de antes de la 37.
  const puente = await supabase.rpc('ultimo_peso', { p_ejercicio: '' });
  if (!puente.error) return 36;
  return NO_EXISTE(puente.error) ? 0 : null;
}

export async function versionDelEsquema(supabase: SupabaseClient): Promise<number | null> {
  if (memo !== null) return memo;
  if (!enCurso) {
    enCurso = (async () => {
      const guardada = Number(await plataforma.almacenamiento.leer(CLAVE));
      const conocida = Number.isFinite(guardada) && guardada > 0 ? guardada : null;
      const v = await preguntar(supabase);
      if (v === null) return conocida;
      memo = v;
      if (v !== conocida) await plataforma.almacenamiento.guardar(CLAVE, String(v));
      return v;
    })().finally(() => {
      enCurso = null;
    });
  }
  return enCurso;
}

/** La versión para una pantalla. `null` mientras se averigua. */
export function usarVersionDelEsquema(): number | null {
  const [version, setVersion] = useState<number | null>(memo);
  useEffect(() => {
    let vivo = true;
    versionDelEsquema(crearCliente()).then((v) => {
      if (vivo) setVersion(v);
    });
    return () => {
      vivo = false;
    };
  }, []);
  return version;
}
