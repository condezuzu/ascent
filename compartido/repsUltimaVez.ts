import { plataforma } from '@plataforma';
import { eventos } from '@compartido/eventos';

/**
 * MOSTRAR LAS REPETICIONES DE LA ÚLTIMA VEZ al entrenar (20/10, a pedido). Es de ESTE
 * aparato, como el peso por serie, y viene apagado. Salen de la última marca de ese
 * ejercicio: las series no guardan repeticiones (`repsDeLaUltimaVez`, en nucleo/rutina.ts).
 */
const CLAVE = 'ascent:reps-ultima-vez';
export const REPS_ULTIMA_VEZ_CAMBIO = 'reps-ultima-vez';

export async function leerRepsUltimaVez(): Promise<boolean> {
  return (await plataforma.almacenamiento.leer(CLAVE).catch(() => null)) === 'si';
}

export async function guardarRepsUltimaVez(si: boolean): Promise<void> {
  await plataforma.almacenamiento.guardar(CLAVE, si ? 'si' : 'no').catch(() => undefined);
  // Con una sesión abierta, el bloque se entera sin volver a montarse.
  eventos.emitir(REPS_ULTIMA_VEZ_CAMBIO, si);
}
