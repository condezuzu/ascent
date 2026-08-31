import { plataforma } from '@/plataforma';
import type { Perfil } from '@nucleo/tipos';

// Caché del perfil en el propio teléfono. Sirve para que al volver a entrar
// la pantalla salga con la racha y la paleta correctas al instante, en vez
// de esperar a la red. La base sigue siendo la autoridad: esto se pisa apenas
// llega la respuesta de verdad.
//
// No se guarda nada sensible: ni peso, ni fotos, ni datos de amigos.
const CLAVE = 'ascent:perfil';

export function guardarPerfilCache(p: Perfil) {
  return plataforma.almacenamiento.guardar(
    CLAVE,
    JSON.stringify({
        id: p.id,
        username: p.username,
        avatar_url: p.avatar_url,
        racha_actual: p.racha_actual,
        mejor_racha: p.mejor_racha,
        rango_actual: p.rango_actual,
        racha_base: p.racha_base,
        perdida_fecha: p.perdida_fecha,
        dias_descanso: p.dias_descanso,
        // lo usa la franja para saber con cuánto arranca el descanso
        duracion_descanso: p.duracion_descanso,
      dia_pendiente: p.dia_pendiente,
    })
  );
}

export async function leerPerfilCache(idEsperado?: string): Promise<Perfil | null> {
  const crudo = await plataforma.almacenamiento.leer(CLAVE);
  if (!crudo) return null;
  try {
    const p = JSON.parse(crudo) as Perfil;
    // si la caché es de otra cuenta, no sirve
    if (idEsperado && p.id !== idEsperado) return null;
    return p;
  } catch {
    return null;
  }
}

export function borrarPerfilCache() {
  return plataforma.almacenamiento.borrar(CLAVE);
}
