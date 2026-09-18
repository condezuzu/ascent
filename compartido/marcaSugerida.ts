import { useEffect, useRef, useState } from 'react';
import { crearCliente, type Cliente } from '@cliente';
import { hoyISO } from '@nucleo/fechas';
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
  const porId = aCatalogo(catalogo);
  return marcasParaProponer({ bloques, marcas: marcas as MarcaGuardada[], catalogo: porId })
    // Lo que ya se preguntó durante la sesión no se vuelve a preguntar al
    // terminar: ver `useMarcaEnElMomento`.
    .filter((s) => !(s.peso <= (preguntadas.get(s.ejercicio) ?? 0)))
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
  const { data: usuario } = await supabase.auth.getUser();
  if (!usuario.user) return false;
  const fila = filaDeMarca(s, reps, hoyISO());
  // REINTENTAR NO DUPLICA (15/9). Sin señal la escritura puede llegar y la
  // respuesta perderse: la app dice "no se guardó", se vuelve a tocar, y la
  // marca quedaba dos veces. Si ya está la misma, esa es la respuesta.
  const { data: ya, error: eMirar } = await supabase
    .from('prs')
    .select('id')
    .eq('user_id', usuario.user.id)
    .eq('ejercicio', fila.ejercicio)
    .eq('peso', fila.peso)
    .eq('reps', fila.reps)
    .eq('fecha', fila.fecha)
    .limit(1);
  if (eMirar) return false;
  if (ya && ya.length > 0) return true;
  const { error } = await supabase.from('prs').insert({ user_id: usuario.user.id, ...fila });
  return !error;
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

  const poner = (ejercicio: string, estado: EstadoDeSugerencia, esNueva?: boolean) =>
    setLista((l) => l.map((x) => (x.ejercicio === ejercicio ? { ...x, estado, esNueva } : x)));

  return {
    lista,
    async guardar(s: Sugerencia, reps: number) {
      poner(s.ejercicio, 'guardando');
      // Se guarda IGUAL aunque no supere: la base se queda con la mejor
      // (`mejores_marcas` ordena por 1RM), así que una marca peor no ensucia
      // el DOTS, y es un dato cierto de lo que la persona levantó. Lo único
      // que cambia es lo que se le dice después.
      const nueva = superaLaMarca(s.peso, reps, s.antes);
      const ok = await guardarSugerencia(supabase, s, reps);
      poner(s.ejercicio, ok ? 'guardada' : 'fallo', ok && nueva);
    },
    descartar(s: Sugerencia) {
      setLista((l) => l.filter((x) => x.ejercicio !== s.ejercicio));
    },
  };
}

/**
 * LO QUE YA SE PREGUNTÓ EN ESTA SESIÓN: ejercicio → el peso más alto por el que
 * se preguntó. Vive en memoria y se vacía al empezar otra sesión. Sirve para dos
 * cosas: no preguntar dos veces por el mismo peso en el momento, y que el
 * resumen del final no repita lo que ya se contestó (o se descartó) al confirmar
 * la serie.
 */
const preguntadas = new Map<string, number>();
let sesionDePreguntadas: string | null = null;

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

  // Otra sesión: lo preguntado en la anterior ya no cuenta.
  if (inicio && inicio !== sesionDePreguntadas) {
    sesionDePreguntadas = inicio;
    preguntadas.clear();
  }

  useEffect(() => {
    const previo = antes.current;
    antes.current = { ejercicio: bloques.ejercicio, hechas: bloques.hechas };
    // Solo una serie NUEVA del mismo bloque: deshacer una, cambiar de
    // ejercicio o cargar la sesión no es "acabo de hacer esto".
    if (!inicio || bloques.ejercicio !== previo.ejercicio || bloques.hechas !== previo.hechas + 1) return;
    const peso = bloques.pesos?.[bloques.hechas - 1];
    const ejercicio = bloques.ejercicio;
    if (!ejercicio || peso === null || peso === undefined) return;
    if (peso <= (preguntadas.get(ejercicio) ?? 0)) return;
    let vivo = true;
    (async () => {
      if (!datos.current) {
        const { data: usuario } = await supabase.auth.getUser();
        const uid = usuario.user?.id;
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
      preguntadas.set(ejercicio, Math.max(preguntadas.get(ejercicio) ?? 0, s.peso));
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
      if (!actual) return;
      setActual({ ...actual, estado: 'guardando' });
      const nueva = superaLaMarca(actual.peso, reps, actual.antes);
      const ok = await guardarSugerencia(supabase, actual, reps);
      if (ok && datos.current) {
        datos.current.marcas.push({ ejercicio: actual.ejercicio, peso: actual.peso, reps, es_real: reps === 1 });
      }
      setActual({ ...actual, estado: ok ? 'guardada' : 'fallo', esNueva: ok && nueva });
    },
    descartar() {
      setActual(null);
    },
  };
}
