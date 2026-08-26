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
 * ¿Estoy en el gimnasio ahora?
 *
 * En web esto es todo lo que se puede: mirar cuando la app está abierta. El
 * geofencing —que el sistema despierte a la app al llegar— es de la etapa
 * nativa, y por eso `vigilarLlegada` del puerto devuelve `false` acá.
 *
 * Devuelve `null` cuando no se sabe: sin punto cargado, sin permiso, sin
 * señal. Nunca se confunde "no sé" con "no estás".
 */
export async function estoyEnElGimnasio(perfil: Perfil | null): Promise<boolean | null> {
  if (!perfil?.gimnasio_lat || !perfil.gimnasio_lon) return null;
  const punto = await plataforma.ubicacion.puntoActual();
  if (!punto) return null;
  return estaAdentro(
    punto,
    { lat: perfil.gimnasio_lat, lon: perfil.gimnasio_lon },
    perfil.gimnasio_radio,
    punto.precision
  );
}
