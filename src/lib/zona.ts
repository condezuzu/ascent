import type { SupabaseClient } from '@supabase/supabase-js';
import { plataforma } from '@/plataforma';

const CLAVE = 'ascent:zona';

/**
 * La zona horaria del teléfono, para que el día corte donde está el usuario.
 *
 * Se manda la ZONA, nunca la fecha: una zona el servidor la puede verificar
 * contra `pg_timezone_names`, una fecha es un número que el cliente inventa.
 * Esa es toda la diferencia entre esto y el agujero que había antes.
 *
 * Es automático y transparente: no hay campo en Ajustes, el usuario nunca la
 * ve y nunca la elige. Si viaja, la app se entera sola.
 */
export function zonaDelTelefono(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    // navegador viejo o sin datos de zona: el servidor se queda con la última
    // que le llegó, que es mejor que romper la pantalla
    return null;
  }
}

/**
 * Avisa al servidor si la zona cambió. Solo escribe cuando cambió de verdad:
 * es una llamada por viaje, no una por arranque de la app.
 */
export async function sincronizarZona(supabase: SupabaseClient) {
  const zona = zonaDelTelefono();
  if (!zona) return;
  // Sin lo guardado se manda igual: el RPC no hace nada si no cambió.
  if ((await plataforma.almacenamiento.leer(CLAVE)) === zona) return;
  const { error } = await supabase.rpc('fijar_zona', { p_zona: zona });
  if (error) return;
  await plataforma.almacenamiento.guardar(CLAVE, zona);
}
