import { plataforma } from '@plataforma';
import { eventos } from '@compartido/eventos';

/**
 * «REGISTRAR RIR» (12/11, a pedido): al entrenar, un botón «RIR» que abre «Rep. en Reserva» con 0 a 4+
 * para la serie que viene. Es de ESTE aparato, como «Registrar repeticiones», y viene apagado: es de gente
 * con experiencia, y quien no lo prende no ve nada nuevo.
 */
const CLAVE = 'ascent:registrar-rir';
export const REGISTRAR_RIR_CAMBIO = 'registrar-rir';

export async function leerRegistrarRir(): Promise<boolean> {
  return (await plataforma.almacenamiento.leer(CLAVE).catch(() => null)) === 'si';
}

export async function guardarRegistrarRir(si: boolean): Promise<void> {
  await plataforma.almacenamiento.guardar(CLAVE, si ? 'si' : 'no').catch(() => undefined);
  // Con una sesión abierta, el bloque se entera sin volver a montarse.
  eventos.emitir(REGISTRAR_RIR_CAMBIO, si);
}
