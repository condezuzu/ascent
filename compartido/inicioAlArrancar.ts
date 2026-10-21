import type { Cliente } from '@cliente';
import { hoyISO } from '@nucleo/fechas';
import { pedirInicio, type RespuestaDeInicio } from '@compartido/inicio';

/**
 * LOS DATOS DE INICIO AL ABRIR LA APP, PEDIDOS MIENTRAS CORRE LA ENTRADA (21/10, bug: Inicio se
 * montaba con el zoom, se veía con la ruedita debajo del logo y recién ahí pedía sus datos). La
 * raíz los pide apenas sabe la sesión, la entrada espera a que lleguen antes del zoom, e Inicio
 * se monta después y los toma, una sola vez. La carga siguiente de Inicio vuelve a pedir.
 */
export type SesionDeHoy = { inicio: string; fin: string | null; bloques?: unknown[] | null };
export type DatosAlArrancar = { uid: string; inicio: RespuestaDeInicio; deHoy: SesionDeHoy[] };

let pedido: { uid: string; promesa: Promise<DatosAlArrancar> } | null = null;
let listo: DatosAlArrancar | null = null;

/** Las sesiones terminadas de hoy: los minutos y el resumen de Inicio. */
export function pedirSesionesDeHoy(supabase: Cliente, uid: string) {
  return supabase
    .from('sesiones')
    .select('inicio, fin, bloques, logs!inner(fecha)')
    .eq('user_id', uid)
    .eq('estado', 'terminada')
    .eq('logs.fecha', hoyISO());
}

export function precargarInicio(supabase: Cliente, uid: string): Promise<DatosAlArrancar> {
  if (pedido?.uid === uid) return pedido.promesa;
  listo = null;
  const promesa: Promise<DatosAlArrancar> = Promise.all([pedirInicio(supabase), pedirSesionesDeHoy(supabase, uid)])
    .then(([inicio, { data }]) => ({ uid, inicio, deHoy: (data ?? []) as SesionDeHoy[] }))
    .catch(() => ({ uid, inicio: { tipo: 'falla' } as RespuestaDeInicio, deHoy: [] }))
    .then((d) => {
      if (pedido?.promesa === promesa) listo = d;
      return d;
    });
  pedido = { uid, promesa };
  return promesa;
}

/** Lo que ya llegó, para el primer dibujo de Inicio (sin la ruedita). No lo consume. */
export function precargaLista(): DatosAlArrancar | null {
  return listo;
}

/** La toma Inicio una sola vez; la carga siguiente vuelve a pedir. */
export function tomarPrecarga(uid: string): Promise<DatosAlArrancar> | null {
  const p = pedido?.uid === uid ? pedido.promesa : null;
  pedido = null;
  listo = null;
  return p;
}
