import { useEffect, useState } from 'react';
import { crearCliente, type Cliente } from '@cliente';
import { hoyISO } from '@nucleo/fechas';
import {
  filaDeMarca,
  marcasParaProponer,
  type EjercicioParaMarca,
  type MarcaGuardada,
  type Sugerencia,
} from '@nucleo/marcaSugerida';

/**
 * "¿LO GUARDO COMO MARCA?", del lado de la red. La regla de qué se propone es
 * `nucleo/marcaSugerida.ts`; esto pide lo que hace falta para decidir y guarda
 * la respuesta. Lo usan el resumen de la web y el de la app nativa.
 *
 * SIN SEÑAL NO SE PREGUNTA NADA. Al terminar en el subsuelo, las marcas no se
 * pueden leer; preguntar sin saber si ya había una mejor sería proponer una
 * marca que quizás no lo es.
 */
export async function buscarSugerencias(
  supabase: Cliente,
  bloques: unknown
): Promise<(Sugerencia & { nombre: string })[]> {
  if (!Array.isArray(bloques) || bloques.length === 0) return [];
  const { data: usuario } = await supabase.auth.getUser();
  const uid = usuario.user?.id;
  if (!uid) return [];
  // CON `user_id`: la tabla de marcas deja leer las de los amigos, así que sin
  // el filtro una marca ajena de 140 escondería tu 102.
  const [{ data: marcas, error: e1 }, { data: catalogo, error: e2 }] = await Promise.all([
    supabase.from('prs').select('ejercicio, peso, reps, es_real').eq('user_id', uid),
    supabase.from('ejercicios').select('*'),
  ]);
  if (e1 || e2 || !marcas || !catalogo) return [];
  const porId = new Map<string, EjercicioParaMarca & { nombre: string }>(
    (catalogo as { id: string; nombre: string; carga?: string; cuenta_dots?: boolean }[]).map((e) => [
      e.id,
      { nombre: e.nombre, carga: e.carga, cuenta_dots: e.cuenta_dots },
    ])
  );
  return marcasParaProponer({ bloques, marcas: marcas as MarcaGuardada[], catalogo: porId }).map((s) => ({
    ...s,
    nombre: porId.get(s.ejercicio)?.nombre ?? s.ejercicio,
  }));
}

export async function guardarSugerencia(supabase: Cliente, s: Sugerencia, reps: number): Promise<boolean> {
  const { data: usuario } = await supabase.auth.getUser();
  if (!usuario.user) return false;
  const { error } = await supabase.from('prs').insert({ user_id: usuario.user.id, ...filaDeMarca(s, reps, hoyISO()) });
  return !error;
}

export type EstadoDeSugerencia = 'preguntando' | 'guardando' | 'guardada' | 'fallo';

/**
 * Lo que dibuja cada resumen (web y nativo): las sugerencias y qué pasó con
 * cada una. "No" la saca de la lista y no vuelve: se pregunta una vez.
 */
export function usarSugerenciasDeMarca(bloques: unknown) {
  const [supabase] = useState(() => crearCliente());
  const [lista, setLista] = useState<(Sugerencia & { nombre: string; estado: EstadoDeSugerencia })[]>([]);

  useEffect(() => {
    let vivo = true;
    buscarSugerencias(supabase, bloques).then((s) => {
      if (vivo) setLista(s.map((x) => ({ ...x, estado: 'preguntando' as const })));
    });
    return () => {
      vivo = false;
    };
  }, [supabase, bloques]);

  const poner = (ejercicio: string, estado: EstadoDeSugerencia) =>
    setLista((l) => l.map((x) => (x.ejercicio === ejercicio ? { ...x, estado } : x)));

  return {
    lista,
    async guardar(s: Sugerencia, reps: number) {
      poner(s.ejercicio, 'guardando');
      poner(s.ejercicio, (await guardarSugerencia(supabase, s, reps)) ? 'guardada' : 'fallo');
    },
    descartar(s: Sugerencia) {
      setLista((l) => l.filter((x) => x.ejercicio !== s.ejercicio));
    },
  };
}
