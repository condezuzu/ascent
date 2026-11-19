import { eventos } from '@compartido/eventos';

// El enlace de Moss puede llegar antes de que Stats esté montada: queda pendiente hasta que la tome.
export const RECIBIR_MOSS = 'ascent:recibir-moss';
let pendiente: { codigo: string | null } | null = null;

/** Lo piden las rutas `vincular`: abrir Moss en Stats; con el código de un uso de Moss, para vincular. */
export function pedirRecibirMoss(codigo: string | null) {
  pendiente = { codigo };
  eventos.emitir(RECIBIR_MOSS);
}

/** Las pestañas lo miran al montarse (la app abierta en frío por el enlace) para ir a Stats. */
export function hayRecibirMoss(): boolean {
  return pendiente !== null;
}

/** Stats lo toma una sola vez, al montarse o cuando llega el pedido. */
export function tomarRecibirMoss(): { codigo: string | null } | null {
  const habia = pendiente;
  pendiente = null;
  return habia;
}
