import type { SupabaseClient } from '@supabase/supabase-js';
import { plataforma } from '@/plataforma';
import { estaAdentro } from '@/lib/geo';
import type { OrigenDia, Perfil } from '@/lib/tipos';

/**
 * Registrar el día por una señal que no es un toque (§13).
 *
 * Ubicación y salud entran las dos por acá. Si cada una escribiera su propio
 * camino habría dos lógicas de "¿ya estaba registrado?, ¿pido la foto?,
 * ¿aviso?", y se irían separando. El `origen` queda en el log para poder saber
 * después qué días entraron solos.
 */
export async function registrarPorSenal(
  supabase: SupabaseClient,
  origen: Exclude<OrigenDia, 'manual'>
) {
  const { data, error } = await supabase.rpc('registrar_dia', {
    p_es_descanso: false,
    p_peso: null,
    p_origen: origen,
  });
  // 23505 = el día ya estaba. No es un error: es el caso normal de abrir la
  // app dos veces en el gimnasio, y no tiene que ensuciar nada.
  if (error) return { registrado: false, yaEstaba: error.code === '23505' };
  return { registrado: !(data as { bloqueado?: boolean })?.bloqueado, yaEstaba: false, data };
}

/**
 * Marcar el punto del gimnasio: se lee el GPS y se guarda dónde estás AHORA.
 *
 * Vive acá y no adentro de la pantalla de Ajustes porque se marca desde dos
 * lugares — Ajustes y el momento en que recién registraste el día, que es
 * cuando es probable que estés parado ahí — y si cada uno tuviera su copia,
 * arreglar uno dejaría el otro roto.
 *
 * Devuelve la precisión en metros, o qué falló. Nunca se marca un punto que
 * no sea el de ahora: un punto puesto desde el sillón de casa es PEOR que no
 * tener punto, porque registra días que no ocurrieron.
 */
export type ResultadoMarcar =
  | { ok: true; lat: number; lon: number; precision: number }
  | { ok: false; motivo: 'sin-gps' | 'sin-permiso' | 'no-se-guardo' };

export async function marcarPunto(
  supabase: SupabaseClient,
  userId: string
): Promise<ResultadoMarcar> {
  if (!plataforma.ubicacion.disponible()) return { ok: false, motivo: 'sin-gps' };

  const punto = await plataforma.ubicacion.puntoActual();
  // No se distingue "denegó" de "no hay señal" a propósito: el navegador
  // tampoco lo dice, e inventar el motivo manda a la persona a resolver el
  // problema equivocado.
  if (!punto) return { ok: false, motivo: 'sin-permiso' };

  const lat = Number(punto.lat.toFixed(6));
  const lon = Number(punto.lon.toFixed(6));
  const { error } = await supabase
    .from('profiles')
    .update({ gimnasio_lat: lat, gimnasio_lon: lon })
    .eq('id', userId);
  if (error) return { ok: false, motivo: 'no-se-guardo' };

  return { ok: true, lat, lon, precision: punto.precision };
}

/**
 * ¿Estoy en el gimnasio ahora?
 *
 * En web esto es todo lo que se puede: mirar cuando la app está abierta. El
 * geofencing —que el sistema despierte a la app al llegar— es de la etapa
 * nativa, y por eso `vigilarLlegada` del puerto devuelve `false` acá.
 *
 * Devuelve `null` cuando no se sabe: sin punto cargado, sin permiso, sin
 * señal. Nunca se confunde "no sé" con "no estás".
 */
const CINCO_MINUTOS = 5 * 60 * 1000;

/**
 * Lo mismo que `estoyEnElGimnasio`, pero diciendo además CUÁNDO se midió el
 * punto que contestó.
 *
 * Importa para la hora de llegada: un arreglo del GPS puede venir de hace
 * cinco minutos, y esa hora está más cerca de cuándo llegó la persona que el
 * momento en que se nos ocurrió preguntar. Sin esto, la llegada se atrasaría
 * hasta cinco minutos cada vez.
 */
export async function mirarElGimnasio(
  perfil: Perfil | null
): Promise<{ adentro: boolean | null; medidoEn: number }> {
  const ahora = Date.now();
  if (!perfil?.gimnasio_lat || !perfil.gimnasio_lon) return { adentro: null, medidoEn: ahora };
  const centro = { lat: perfil.gimnasio_lat, lon: perfil.gimnasio_lon };
  const adentro = (p: { lat: number; lon: number; precision: number }) =>
    estaAdentro(p, centro, perfil.gimnasio_radio, p.precision);

  const cacheado = await plataforma.ubicacion.puntoActual(CINCO_MINUTOS);
  if (!cacheado) return { adentro: null, medidoEn: ahora };
  if (adentro(cacheado)) return { adentro: true, medidoEn: cacheado.medidoEn };

  const viejo = ahora - cacheado.medidoEn > 30000;
  if (!viejo) return { adentro: false, medidoEn: cacheado.medidoEn };

  const fresco = await plataforma.ubicacion.puntoActual(0);
  if (!fresco) return { adentro: null, medidoEn: ahora };
  return { adentro: adentro(fresco), medidoEn: fresco.medidoEn };
}

export async function estoyEnElGimnasio(perfil: Perfil | null): Promise<boolean | null> {
  if (!perfil?.gimnasio_lat || !perfil.gimnasio_lon) return null;
  const centro = { lat: perfil.gimnasio_lat, lon: perfil.gimnasio_lon };
  const adentro = (p: { lat: number; lon: number; precision: number }) =>
    estaAdentro(p, centro, perfil.gimnasio_radio, p.precision);

  // Primero se acepta un arreglo de hasta cinco minutos, que suele ser
  // instantáneo y no enciende la antena.
  const cacheado = await plataforma.ubicacion.puntoActual(CINCO_MINUTOS);
  if (!cacheado) return null;

  // Un arreglo viejo que dice que ESTÁS en el gimnasio alcanza: estuviste ahí
  // hace un rato, o sea que fuiste.
  if (adentro(cacheado)) return true;

  // Pero uno viejo que dice que NO estás no sirve para descartar: podés haber
  // salido de casa hace cuatro minutos y estar llegando justo ahora. Ahí sí se
  // paga la lectura fresca — y solo ahí.
  const viejo = Date.now() - cacheado.medidoEn > 30000;
  if (!viejo) return false;

  const fresco = await plataforma.ubicacion.puntoActual(0);
  return fresco ? adentro(fresco) : null;
}
