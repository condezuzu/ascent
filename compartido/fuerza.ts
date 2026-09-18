import type { Cliente } from '@cliente';
import type { FilaFuerza, MiFuerza } from '@nucleo/tipos';
import { esEjercicioEstandar, ubicar, type SexoEstandar } from '@nucleo/estandares';

/**
 * LA FUERZA DE STATS, pedida una sola vez para las dos apps.
 *
 * Vivía adentro de `SeccionFuerza` de la web; se sacó acá al portar Stats a la
 * app nativa (18/9). Copiada, se separa.
 *
 * `null` si `mi_fuerza` no contestó: mientras la base no tenga la migración la
 * función no existe, y es preferible no mostrar la sección a mostrarla rota en
 * medio de Stats.
 */
export async function cargarFuerza(supabase: Cliente): Promise<{ mia: MiFuerza; ranking: FilaFuerza[] } | null> {
  const [{ data: f }, { data: r }] = await Promise.all([supabase.rpc('mi_fuerza'), supabase.rpc('ranking_fuerza')]);
  if (!f) return null;
  return { mia: f as MiFuerza, ranking: (r ?? []) as FilaFuerza[] };
}

/**
 * Dónde cae cada marca entre la gente del mismo sexo y peso corporal (§16.8).
 *
 * SOLO POR EJERCICIO. El total no lleva categoría: sumar los umbrales de los
 * tres no da el umbral del total, y en las colas se rompe (ver `estandares.ts`
 * y spec/trampas.md). Para el total ya está el DOTS. Y por ejercicio es además
 * lo accionable: "top 25% en peso muerto" dice qué entrenar, un agregado no.
 */
export function filasDondeEstoy(sexo: SexoEstandar, pesoCorporal: number, marcas: MiFuerza['marcas']) {
  return marcas
    .filter((m) => esEjercicioEstandar(m.ejercicio))
    .map((m) => ({
      ejercicio: m.ejercicio,
      nombre: m.nombre,
      u: ubicar(m.ejercicio as Parameters<typeof ubicar>[0], sexo, pesoCorporal, m.kg),
    }));
}
