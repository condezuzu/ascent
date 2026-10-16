import { useEffect, useRef, useState } from 'react';
import { anotarPreguntada, deshacerPreguntada, guardarMarcaUnaVez, preguntadasDe, yaSePregunto } from '@compartido/guardarMarca';
import { crearCliente, type Cliente } from '@cliente';
import { hoyISO } from '@nucleo/fechas';
import { miId } from '@compartido/quienSoy';
import {
  filaDeMarca,
  superaLaMarca,
  marcaDeSerie,
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
  const uid = await miId(supabase);
  if (!uid) return [];
  // CON `user_id`: la tabla de marcas deja leer las de los amigos, así que sin
  // el filtro una marca ajena de 140 escondería tu 102.
  const [{ data: marcas, error: e1 }, { data: catalogo, error: e2 }] = await Promise.all([
    supabase.from('prs').select('ejercicio, peso, reps, es_real').eq('user_id', uid),
    supabase.from('ejercicios').select('*'),
  ]);
  if (e1 || e2 || !marcas || !catalogo) return [];
  const porId = aCatalogo(catalogo);
  return marcasParaProponer({ bloques, marcas: marcas as MarcaGuardada[], catalogo: porId })
    // Lo que ya se preguntó durante la sesión no se vuelve a preguntar al
    // terminar: ver `useMarcaEnElMomento`.
    .filter((s) => !yaSePregunto(s.ejercicio, s.peso))
    .map((s) => ({ ...s, nombre: porId.get(s.ejercicio)?.nombre ?? s.ejercicio }));
}

function aCatalogo(catalogo: unknown[]) {
  return new Map<string, EjercicioParaMarca & { nombre: string }>(
    (catalogo as { id: string; nombre: string; carga?: string; cuenta_dots?: boolean }[]).map((e) => [
      e.id,
      { nombre: e.nombre, carga: e.carga, cuenta_dots: e.cuenta_dots },
    ])
  );
}

export async function guardarSugerencia(supabase: Cliente, s: Sugerencia, reps: number): Promise<boolean> {
  const uid = await miId(supabase);
  if (!uid) return false;
  return guardarMarcaUnaVez(supabase, uid, filaDeMarca(s, reps, hoyISO()));
}

export type EstadoDeSugerencia = 'preguntando' | 'guardando' | 'guardada' | 'fallo';

/**
 * Lo que dibuja cada resumen (web y nativo): las sugerencias y qué pasó con
 * cada una. "No" la saca de la lista y no vuelve: se pregunta una vez.
 */
export function useSugerenciasDeMarca(bloques: unknown) {
  const [supabase] = useState(() => crearCliente());
  // `esNueva` se calcula al confirmar, con las repeticiones que eligió la
  // persona: es EL número que decide, y hasta ese momento no se sabe.
  const [lista, setLista] = useState<
    (Sugerencia & { nombre: string; estado: EstadoDeSugerencia; esNueva?: boolean })[]
  >([]);

  useEffect(() => {
    let vivo = true;
    buscarSugerencias(supabase, bloques).then((s) => {
      if (vivo) setLista(s.map((x) => ({ ...x, estado: 'preguntando' as const })));
    });
    return () => {
      vivo = false;
    };
  }, [supabase, bloques]);

  const enVuelo = useRef(new Set<string>());
  const poner = (ejercicio: string, estado: EstadoDeSugerencia, esNueva?: boolean) =>
    setLista((l) => l.map((x) => (x.ejercicio === ejercicio ? { ...x, estado, esNueva } : x)));

  return {
    lista,
    async guardar(s: Sugerencia, reps: number) {
      // Dos toques seguidos en la misma sugerencia no guardan dos veces.
      if (enVuelo.current.has(s.ejercicio)) return;
      enVuelo.current.add(s.ejercicio);
      poner(s.ejercicio, 'guardando');
      // Se guarda IGUAL aunque no supere: la base se queda con la mejor
      // (`mejores_marcas` ordena por 1RM), así que una marca peor no ensucia
      // el DOTS, y es un dato cierto de lo que la persona levantó. Lo único
      // que cambia es lo que se le dice después.
      const nueva = superaLaMarca(s.peso, reps, s.antes);
      const ok = await guardarSugerencia(supabase, s, reps).catch(() => false);
      enVuelo.current.delete(s.ejercicio);
      poner(s.ejercicio, ok ? 'guardada' : 'fallo', ok && nueva);
    },
    descartar(s: Sugerencia) {
      setLista((l) => l.filter((x) => x.ejercicio !== s.ejercicio));
    },
  };
}

export type MarcaEnElMomento = Sugerencia & { nombre: string; estado: EstadoDeSugerencia; esNueva?: boolean };

/**
 * "¿LO GUARDO COMO MARCA?", AL CONFIRMAR LA SERIE (18/9). La regla es
 * `marcaDeSerie` del núcleo —las mismas que al terminar—; esto mira el bloque en
 * curso y, cada vez que se confirma una serie CON PESO, pregunta si esa serie
 * puede ser marca. Una a la vez: la de la última serie.
 *
 * Las marcas y el catálogo se piden UNA vez, con la primera serie con peso, y se
 * tienen en memoria el resto de la sesión: pedirlos en cada `+` sería un viaje a
 * la red por toque, en el lugar de la app donde menos señal hay. Al guardar una,
 * se suma a esa memoria: la serie siguiente se compara contra la nueva.
 *
 * SIN SEÑAL NO SE PREGUNTA, igual que al terminar: sin las marcas no se sabe si
 * ya había una mejor.
 */
export function useMarcaEnElMomento(
  bloques: { ejercicio: string | null; hechas: number; pesos?: (number | null)[]; carga?: string },
  inicio: string | null
) {
  const [supabase] = useState(() => crearCliente());
  const [actual, setActual] = useState<MarcaEnElMomento | null>(null);
  const datos = useRef<{ marcas: MarcaGuardada[]; catalogo: ReturnType<typeof aCatalogo> } | null>(null);
  const antes = useRef({ ejercicio: bloques.ejercicio, hechas: bloques.hechas });

  preguntadasDe(inicio);
  // Lo que había anotado ANTES de preguntar, para reponerlo si no se pudo guardar.
  const antesDePreguntar = useRef<number | undefined>(undefined);
  // Dos toques en el mismo botón no guardan dos veces.
  const guardando = useRef(false);

  useEffect(() => {
    const previo = antes.current;
    antes.current = { ejercicio: bloques.ejercicio, hechas: bloques.hechas };
    // Solo una serie NUEVA del mismo bloque: deshacer una, cambiar de
    // ejercicio o cargar la sesión no es "acabo de hacer esto".
    if (!inicio || bloques.ejercicio !== previo.ejercicio || bloques.hechas !== previo.hechas + 1) return;
    const peso = bloques.pesos?.[bloques.hechas - 1];
    const ejercicio = bloques.ejercicio;
    if (!ejercicio || peso === null || peso === undefined) return;
    if (yaSePregunto(ejercicio, peso)) return;
    let vivo = true;
    (async () => {
      if (!datos.current) {
        const uid = await miId(supabase);
        if (!uid) return;
        // CON `user_id`: la tabla de marcas deja leer las de los amigos.
        const [{ data: marcas, error: e1 }, { data: catalogo, error: e2 }] = await Promise.all([
          supabase.from('prs').select('ejercicio, peso, reps, es_real').eq('user_id', uid),
          supabase.from('ejercicios').select('*'),
        ]);
        if (e1 || e2 || !marcas || !catalogo) return;
        datos.current = { marcas: marcas as MarcaGuardada[], catalogo: aCatalogo(catalogo) };
      }
      const d = datos.current;
      const s = marcaDeSerie({ ejercicio, peso, carga: bloques.carga, marcas: d.marcas, catalogo: d.catalogo });
      if (!vivo || !s) return;
      antesDePreguntar.current = anotarPreguntada(ejercicio, s.peso);
      setActual({ ...s, nombre: d.catalogo.get(ejercicio)?.nombre ?? ejercicio, estado: 'preguntando' });
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, inicio, bloques.ejercicio, bloques.hechas, bloques.pesos, bloques.carga]);

  // Guardada, se va sola a los pocos segundos: ya dijo lo que tenía que decir.
  useEffect(() => {
    if (actual?.estado !== 'guardada' && actual?.estado !== 'fallo') return;
    const t = setTimeout(() => setActual(null), 4500);
    return () => clearTimeout(t);
  }, [actual?.estado]);

  return {
    actual,
    async guardar(reps: number) {
      if (!actual || guardando.current) return;
      guardando.current = true;
      setActual({ ...actual, estado: 'guardando' });
      const nueva = superaLaMarca(actual.peso, reps, actual.antes);
      const ok = await guardarSugerencia(supabase, actual, reps).catch(() => false);
      guardando.current = false;
      if (ok && datos.current) {
        datos.current.marcas.push({ ejercicio: actual.ejercicio, peso: actual.peso, reps, es_real: reps === 1 });
      }
      // No se guardó: se da por NO preguntada, y el resumen del final la vuelve a ofrecer.
      if (!ok) deshacerPreguntada(actual.ejercicio, antesDePreguntar.current);
      setActual({ ...actual, estado: ok ? 'guardada' : 'fallo', esNueva: ok && nueva });
    },
    descartar() {
      setActual(null);
    },
  };
}
