import { plataforma } from '@plataforma';
import { eventos } from '@compartido/eventos';

/**
 * «MOSTRAR LA ÚLTIMA VEZ» al entrenar (20/10, a pedido): debajo del ejercicio, lo que se hizo
 * la última sesión que lo tuvo. Es de ESTE aparato, como el sonido del descanso, y viene
 * apagado. Reemplaza a «Repeticiones de la última vez», del mismo día: quien la prendió la
 * sigue teniendo prendida.
 */
const CLAVE = 'ascent:mostrar-ultima-vez';
const CLAVE_VIEJA = 'ascent:reps-ultima-vez';
export const MOSTRAR_ULTIMA_VEZ_CAMBIO = 'mostrar-ultima-vez';

export async function leerMostrarUltimaVez(): Promise<boolean> {
  const leer = (c: string) => plataforma.almacenamiento.leer(c).catch(() => null);
  return ((await leer(CLAVE)) ?? (await leer(CLAVE_VIEJA))) === 'si';
}

export async function guardarMostrarUltimaVez(si: boolean): Promise<void> {
  await plataforma.almacenamiento.guardar(CLAVE, si ? 'si' : 'no').catch(() => undefined);
  // Con una sesión abierta, el bloque se entera sin volver a montarse.
  eventos.emitir(MOSTRAR_ULTIMA_VEZ_CAMBIO, si);
}
