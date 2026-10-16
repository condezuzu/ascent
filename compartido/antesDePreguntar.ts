import type { Cliente } from '@cliente';
import { quedaDeLaSesion, vaciar } from '@compartido/cola';
import { leerSesionCache } from '@compartido/sesionCache';

/**
 * ANTES DE PREGUNTARLE A LA BASE ALGO QUE LA HAGA JUZGAR LA SESIÓN
 * (`mi_sesion`, `resumen_sesiones`): sube lo pendiente y dice si quedó algo de
 * la sesión de este teléfono sin subir. Con `false` NO se pregunta: la base
 * cerraría la sesión con la última actividad que le llegó. Ver `quedaDeLaSesion`.
 *
 * Abrir Stats a mitad del entrenamiento, en un subsuelo, alcanzaba para eso.
 */
export async function subioLoDeLaSesion(supabase: Cliente): Promise<boolean> {
  await vaciar(supabase);
  return !(await quedaDeLaSesion((await leerSesionCache())?.id));
}
