import { plataforma } from '@plataforma';
import { eventos } from '@compartido/eventos';

/**
 * «REGISTRAR REPETICIONES» (21/10, a pedido): al entrenar, un cuadradito al lado del peso para
 * las repeticiones de cada serie. Es de ESTE aparato, como «Mostrar la última vez», y viene
 * apagado: quien no lo prende no ve nada nuevo.
 */
const CLAVE = 'ascent:registrar-reps';
export const REGISTRAR_REPS_CAMBIO = 'registrar-reps';

export async function leerRegistrarReps(): Promise<boolean> {
  return (await plataforma.almacenamiento.leer(CLAVE).catch(() => null)) === 'si';
}

export async function guardarRegistrarReps(si: boolean): Promise<void> {
  await plataforma.almacenamiento.guardar(CLAVE, si ? 'si' : 'no').catch(() => undefined);
  // Con una sesión abierta, el bloque se entera sin volver a montarse.
  eventos.emitir(REGISTRAR_REPS_CAMBIO, si);
}
