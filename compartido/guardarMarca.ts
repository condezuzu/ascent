import type { Cliente } from '@cliente';

export type FilaDeMarca = { ejercicio: string; peso: number; reps: number; es_real: boolean; fecha: string };

/**
 * GUARDAR UNA MARCA SIN DUPLICARLA. Todos los que anotan una marca pasan por acá.
 *
 * REINTENTAR NO DUPLICA (15/9, y 13/10 para la que se anota a mano). Sin señal
 * la escritura puede llegar y la respuesta perderse: la app dice "no se guardó",
 * se vuelve a tocar, y la marca quedaba dos veces (`prs` no tiene `unique`). Se
 * mira antes: si ya está la misma —mismo ejercicio, peso, repeticiones y día—,
 * esa es la respuesta.
 *
 * `false` si no se pudo mirar o no se pudo guardar.
 */
export async function guardarMarcaUnaVez(supabase: Cliente, uid: string, fila: FilaDeMarca): Promise<boolean> {
  const { data: ya, error: eMirar } = await supabase
    .from('prs')
    .select('id')
    .eq('user_id', uid)
    .eq('ejercicio', fila.ejercicio)
    .eq('peso', fila.peso)
    .eq('reps', fila.reps)
    .eq('fecha', fila.fecha)
    .limit(1);
  if (eMirar) return false;
  if (ya && ya.length > 0) return true;
  const { error } = await supabase.from('prs').insert({ user_id: uid, ...fila });
  return !error;
}

/**
 * LO QUE YA SE PREGUNTÓ EN ESTA SESIÓN: ejercicio → el peso más alto por el que
 * se preguntó "¿lo guardo como marca?". Vive en memoria y se vacía al empezar
 * otra sesión. Sirve para no preguntar dos veces por el mismo peso en el
 * momento, y para que el resumen del final no repita lo ya contestado.
 *
 * SE ANOTA AL PREGUNTAR Y SE DESHACE SI NO SE PUDO GUARDAR (13/10). Antes
 * quedaba anotado igual: la persona aceptaba, la señal fallaba, el cartel de
 * "no se guardó" se iba solo a los cuatro segundos, y el resumen del final —que
 * es cuando hay señal— ya no la ofrecía. La marca se perdía sin que nadie
 * dijera que no.
 */
const preguntadas = new Map<string, number>();
let sesionDePreguntadas: string | null = null;

/** Otra sesión: lo preguntado en la anterior ya no cuenta. */
export function preguntadasDe(inicio: string | null): void {
  if (inicio && inicio !== sesionDePreguntadas) {
    sesionDePreguntadas = inicio;
    preguntadas.clear();
  }
}

export function yaSePregunto(ejercicio: string, peso: number): boolean {
  return peso <= (preguntadas.get(ejercicio) ?? 0);
}

/** Anota que se preguntó, y devuelve lo que había antes: es lo que `deshacerPreguntada` repone. */
export function anotarPreguntada(ejercicio: string, peso: number): number | undefined {
  const antes = preguntadas.get(ejercicio);
  preguntadas.set(ejercicio, Math.max(antes ?? 0, peso));
  return antes;
}

export function deshacerPreguntada(ejercicio: string, antes: number | undefined): void {
  if (antes === undefined) preguntadas.delete(ejercicio);
  else preguntadas.set(ejercicio, antes);
}
