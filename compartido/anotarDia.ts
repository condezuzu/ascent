// SOLO TIPOS POR ALIAS: `test:db` carga este archivo con node para correrlo
// contra la base de prueba, y node no resuelve `@cliente` ni `@nucleo`.
import type { Cliente } from '@cliente';
import type { OrigenDia } from '@nucleo/tipos';

/**
 * EL DÍA NO ENTRA SIN QUE ANTES SE REVISE LA PÉRDIDA (4/10).
 *
 * EL BUG: LA RACHA SE CAÍA A 1. Gastar una vida o restar 10 lo hace
 * `verificar_perdida`, que corría solo al abrir Inicio. Si el día de hoy entraba
 * antes —el registro por ubicación con la app cerrada, la sesión que arranca
 * sola al llegar, marcar hoy desde el calendario— la base contaba hacia atrás
 * desde hoy, se topaba con el hueco de ayer y dejaba la racha en 1. Y la
 * revisión, al llegar después, veía que hoy ya tenía día y no hacía nada.
 *
 * La base lo cuida sola desde la migración 59, con un disparador antes del
 * insert. Esto es lo mismo del lado del cliente, para la base que todavía no la
 * tiene; con la 59 aplicada es una llamada de más que no cambia nada.
 *
 * SI LA REVISIÓN FALLA, EL DÍA NO SE ANOTA. Anotarlo igual es justo el bug. Un
 * día sin anotar se registra en el próximo intento; una racha caída a 1 no
 * vuelve.
 */
export const SIN_REVISAR = { code: 'sin-revisar', message: 'no se pudo revisar la pérdida antes de anotar el día' } as const;

export async function revisarPerdidaAntes(supabase: Cliente): Promise<boolean> {
  const { error } = await supabase.rpc('verificar_perdida');
  return !error;
}

/** `registrar_dia`, con la revisión adelante. Todo el que registra el día pasa por acá. */
export async function anotarElDia(
  supabase: Cliente,
  origen: OrigenDia
): Promise<{ data: unknown; error: { code?: string; message: string } | null }> {
  if (!(await revisarPerdidaAntes(supabase))) return { data: null, error: SIN_REVISAR };
  return supabase.rpc('registrar_dia', { p_origen: origen });
}
