import { eventos } from '@compartido/eventos';

/**
 * ABRIR UN DÍA EN EL CALENDARIO DE STATS, para corregirlo (18/10). Lo pide el aviso de la
 * vida con "Sí fui, corregir día". Como `abrirEntrenamiento`: evento para un Stats ya
 * montado y el pedido guardado para uno que se monta recién ahora.
 */
export const ABRIR_DIA = 'ascent:abrir-dia';

let pedido: { fecha: string; en: number } | null = null;

export function pedirDia(fecha: string) {
  pedido = { fecha, en: Date.now() };
  eventos.emitir(ABRIR_DIA, fecha);
}

/** El día que se pidió hace un momento, o null. Se consume al leerlo. */
export function diaRecienPedido(): string | null {
  const p = pedido && Date.now() - pedido.en < 3000 ? pedido.fecha : null;
  pedido = null;
  return p;
}
