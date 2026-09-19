import { plataforma } from '@plataforma';
import type { Perfil } from '@nucleo/tipos';
import { olvidarPerfilVivo } from '@compartido/perfilVivo';

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
  // Y también lo que esté viajando. Cruzarse de cuenta no puede pasar —el
  // `uid` se compara— pero volver a entrar con la MISMA cuenta sí: ahí la
  // promesa vieja calzaría. Soltarla es una línea y ahorra pensarlo.
  olvidarPerfilVivo();
  // Lo de Inicio también: es de esta cuenta.
  void plataforma.almacenamiento.borrar(CLAVE_INICIO);
  return plataforma.almacenamiento.borrar(CLAVE);
}

// ---------------------------------------------------------------
// LO QUE INICIO DIBUJA, ENTERO (19/9).
//
// Con solo el perfil en caché, Inicio no sabía si el gimnasio estaba marcado
// ni los días de la semana: mostrarla sola hacía aparecer "Marca tu gimnasio"
// un instante, y por eso Inicio pasó a esperar la red (~250 ms más en cada
// apertura). Con esto la caché alcanza para dibujar Inicio COMPLETO al
// instante, y la red lo corrige en el lugar si algo cambió.
//
// Del gimnasio se guarda SI ESTÁ MARCADO, nunca dónde: las coordenadas no
// salen de la base.
// ---------------------------------------------------------------
const CLAVE_INICIO = 'ascent:inicio';

export type InicioCacheado = {
  uid: string;
  logs: import('@nucleo/tipos').Log[];
  descansos: import('@nucleo/descansos').ConfigDescanso[];
  impulsos: import('@compartido/inicio').DatosDeInicio['impulsos'];
  /** La línea de marcas ya armada ("SQ 140 · BP 100 · …"), o null. */
  marcas: string | null;
  tieneGimnasio: boolean;
};

export function guardarInicioCache(d: InicioCacheado) {
  return plataforma.almacenamiento.guardar(CLAVE_INICIO, JSON.stringify(d));
}

export async function leerInicioCache(uid: string): Promise<InicioCacheado | null> {
  const crudo = await plataforma.almacenamiento.leer(CLAVE_INICIO);
  if (!crudo) return null;
  try {
    const d = JSON.parse(crudo) as InicioCacheado;
    // de otra cuenta, o de una versión que no la tenía entera: no sirve
    if (d?.uid !== uid || !Array.isArray(d.logs) || !Array.isArray(d.descansos) || typeof d.tieneGimnasio !== 'boolean') return null;
    return d;
  } catch {
    return null;
  }
}

export function borrarInicioCache() {
  return plataforma.almacenamiento.borrar(CLAVE_INICIO);
}
