import type { Cliente } from '@cliente';
import { hoyISO } from '@nucleo/fechas';
import { pedirInicio, type RespuestaDeInicio } from '@compartido/inicio';
import { cargarRutinaParaVer, catalogoDeRutina, type CatalogoDeRutina } from '@compartido/rutinas';
import type { DiaDeSemana } from '@nucleo/rutinas';
import { plataforma } from '@plataforma';

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

// LO DEMÁS DE INICIO, TAMBIÉN DEBAJO DEL LOGO (28/10): la fila «Hoy» de la rutina y los pasos se
// pedían recién al montarse Inicio y entraban a la vista. La entrada no los espera: si llegan
// antes, Inicio nace con ellos; si no, los pide como siempre.
export type FilaPrecargada = { dias: DiaDeSemana[] | null; catalogo: CatalogoDeRutina };
let fila: FilaPrecargada | null = null;
let pasos: { fecha: string; n: number | null } | null = null;

function precargarLoDemas(supabase: Cliente, uid: string) {
  fila = null;
  void Promise.all([cargarRutinaParaVer(supabase, uid, true), catalogoDeRutina(supabase)])
    .then(([vista, catalogo]) => {
      fila = { dias: vista?.dias ?? null, catalogo };
    })
    .catch(() => undefined);
  const hoy = hoyISO();
  // Adentro de la promesa: si Salud no está (o revienta), no se lleva puesta la precarga.
  void Promise.resolve()
    .then(() => plataforma.salud.pasosDe(hoy))
    .then((n) => {
      pasos = { fecha: hoy, n };
    })
    .catch(() => undefined);
}

export function filaPrecargada(): FilaPrecargada | null {
  return fila;
}

/** `undefined` si todavía no llegaron (o son de otro día). */
export function pasosPrecargados(): number | null | undefined {
  return pasos?.fecha === hoyISO() ? pasos.n : undefined;
}

export function precargarInicio(supabase: Cliente, uid: string): Promise<DatosAlArrancar> {
  if (pedido?.uid === uid) return pedido.promesa;
  precargarLoDemas(supabase, uid);
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
