import { T } from '@nucleo/textos';
import { diaDeLaSesion, hayQuePreguntarPorLaRutina, rutinaConLoHecho } from '@nucleo/rutina';
import { nombreNuevo, type Rutina } from '@nucleo/rutinas';
import { cargarMisRutinas, guardarRutina, rutinaActivaDelTelefono } from '@compartido/rutinas';
import { supabase } from './supabase';

type BloqueGuardado = { ejercicio?: string | null; series?: number | null; minutos?: number | null };

export type PreguntaDeRutina = { rutinas: Rutina[]; actual: Rutina; dia: number; hecho: ReturnType<typeof diaDeLaSesion> };

/**
 * AL TERMINAR, SI SE HIZO OTRO DÍA QUE EL DE LA RUTINA GUARDADA (16/10, a pedido). Qué
 * preguntar, o `null` si no hay nada: sin rutina guardada, sin señal, o con los mismos
 * ejercicios. La ventana es `VentanaRutina` (19/10: ya no una alerta del sistema).
 */
export async function rutinaParaPreguntar(bloques: BloqueGuardado[]): Promise<PreguntaDeRutina | null> {
  const dia = new Date().getDay();
  const hecho = diaDeLaSesion(bloques);
  // Primero la copia del teléfono, que no gasta red: casi siempre no hay nada que preguntar.
  const activa = await rutinaActivaDelTelefono();
  if (!activa || !hayQuePreguntarPorLaRutina(activa.dias[dia], hecho)) return null;
  // El nombre va en la pregunta, y guardar pide señal: sin ella no se pregunta.
  const rutinas = await cargarMisRutinas(supabase);
  const actual = rutinas?.find((r) => r.activa);
  if (!rutinas || !actual || !hayQuePreguntarPorLaRutina(actual.dias[dia], hecho)) return null;
  return { rutinas, actual, dia, hecho };
}

/**
 * Reemplazar el día de la rutina que se está usando, o crear una nueva —copia de la activa
 * con este día puesto, sin tocar la que estaba—. `false` si no se pudo guardar.
 */
export async function guardarDiaDeRutina({ rutinas, actual, dia, hecho }: PreguntaDeRutina, como: 'esta' | 'nueva'): Promise<boolean> {
  const dias = rutinaConLoHecho(actual.dias, dia, hecho);
  const id =
    como === 'esta'
      ? await guardarRutina(supabase, { id: actual.id, nombre: actual.nombre, dias, activa: true })
      : await guardarRutina(supabase, { id: null, nombre: nombreNuevo(rutinas.map((r) => r.nombre), T.rutina.nombreBase), dias });
  return !!id;
}
