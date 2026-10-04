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

/**
 * LO QUE SE GUARDA, Y NADA MÁS. La copia decía ser un `Perfil` entero y
 * guardaba diez campos: leer uno de los que no están compilaba y daba
 * `undefined` sin un solo error. Así, en la web, quien usa libras veía y cargaba
 * los pesos en kilos mientras Inicio se dibujaba con la copia (4/10): la unidad
 * no estaba en la lista.
 *
 * Ahora la lista es una, de ella sale el tipo, y leer un campo que no está no
 * compila. `duracion_descanso` la usa la franja para saber con cuánto arranca
 * el descanso; `unidad_peso`, todo lo que muestra o recibe un peso.
 *
 * `visibilidad_default` NO va, a propósito. La copia puede estar vieja —la
 * preferencia se cambió en otro aparato— y la hoja de la foto decide quién la
 * ve al abrirse: con una copia que dijera "amigos" saldría compartida una foto
 * que Ajustes ya dice privada. Sin el dato, la hoja cae en privada, que es el
 * lado seguro, hasta que llegue el perfil de verdad.
 *
 * Del gimnasio se guarda SI ESTÁ MARCADO (`tieneGimnasio`) y nunca dónde: las
 * coordenadas no salen de la base. Ranking de la nativa leía `gimnasio_lat` de
 * esta copia, que nunca lo tuvo, y su aviso no aparecía jamás.
 */
const CAMPOS_GUARDADOS = [
  'id',
  'username',
  'avatar_url',
  'racha_actual',
  'mejor_racha',
  'racha_base',
  'perdida_fecha',
  'dias_descanso',
  'duracion_descanso',
  'dia_pendiente',
  'unidad_peso',
] as const satisfies readonly (keyof Perfil)[];

export type PerfilGuardado = Pick<Perfil, (typeof CAMPOS_GUARDADOS)[number]> & { tieneGimnasio: boolean };

export function guardarPerfilCache(p: Perfil) {
  const copia = { ...Object.fromEntries(CAMPOS_GUARDADOS.map((c) => [c, p[c]])), tieneGimnasio: p.gimnasio_lat != null };
  return plataforma.almacenamiento.guardar(CLAVE, JSON.stringify(copia));
}

export async function leerPerfilCache(idEsperado?: string): Promise<PerfilGuardado | null> {
  const crudo = await plataforma.almacenamiento.leer(CLAVE);
  if (!crudo) return null;
  try {
    const p = JSON.parse(crudo) as PerfilGuardado;
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
