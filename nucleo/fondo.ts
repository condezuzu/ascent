/**
 * ¿SE CARGA EL MOTOR DEL FONDO, O NO?
 *
 * POR QUÉ ESTO ES UNA DECISIÓN Y NO UN `if` suelto. Medido: three.js cuesta
 * TRES SEGUNDOS de arranque —la racha aparece a los 3619 ms con motor y a los
 * 635 sin él— y son 74 kB de descarga. O sea que el costo no es bajarlo, es
 * evaluarlo, y por eso no se arregla con menos partículas ni con shaders más
 * simples: montar la escena son 10 ms. El costo está en cargar la biblioteca.
 *
 * En un equipo flojo eso se multiplica.
 *
 * PERO NO SE DECIDE SOLO. Alguien con un teléfono lento puede preferir el
 * fondo igual, y alguien con un equipo bueno puede preferir que la app abra
 * instantánea. La detección automática es un valor por omisión, no un veredicto
 * — por eso son tres estados y no un booleano.
 *
 * Es de ESTE aparato y no de la cuenta: el mismo usuario puede tener un
 * teléfono flojo y una computadora buena, y no quiere la misma respuesta en
 * los dos.
 */

export type PreferenciaFondo = 'auto' | 'siempre' | 'nunca';

export const PREFERENCIAS: PreferenciaFondo[] = ['auto', 'siempre', 'nunca'];

export function esPreferenciaFondo(v: unknown): v is PreferenciaFondo {
  return typeof v === 'string' && (PREFERENCIAS as string[]).includes(v);
}

/**
 * La decisión, aislada de cómo se detecta el equipo y de dónde se guarda la
 * preferencia, para poder probarla sin un navegador.
 *
 * `flojo` en `null` significa NO SÉ —el navegador no da la información— y se
 * trata como equipo bueno: negarle el fondo a alguien por no poder medirlo
 * sería castigar la falta de dato.
 */
export function cargarElMotor(pref: PreferenciaFondo, flojo: boolean | null): boolean {
  if (pref === 'siempre') return true;
  if (pref === 'nunca') return false;
  return flojo !== true;
}

/**
 * POR QUÉ NO SE VE NINGÚN CUERPO.
 *
 * DE DÓNDE SALE ESTO. En Brave la galería quedaba en negro con estrellas y
 * nada más, sin ninguna forma de saber qué había pasado: "lo importante es que
 * la galería no avisa". Y hay cuatro motivos posibles, que se parecen mucho en
 * pantalla —no hay cuerpo— y son cosas completamente distintas.
 *
 * EL ORDEN IMPORTA Y NO ES ARBITRARIO: es el mismo que el del código. Si la
 * preferencia dice que no, el motor ni se importa, así que preguntar por WebGL
 * después sería contar algo que nunca llegó a pasar.
 *
 * LO DE BRAVE, QUE ES EL CASO QUE ORIGINÓ ESTO: su escudo contra huellas
 * digitales le miente a `hardwareConcurrency`, y le puede contestar 2. La app
 * lee eso, concluye "equipo flojo" y decide no cargar three.js. O sea que no
 * es que el motor falle: es que la app decide no encenderlo, por una señal
 * falseada a propósito. Sin este aviso eso es indistinguible de un bug.
 *
 * VIVE ACÁ Y NO EN LA PANTALLA porque es una decisión con reglas, y así se
 * prueba sin navegador. Quién lo muestra es la galería, y solo ella.
 */
export type MotivoSinMotor = 'preferencia' | 'equipo' | 'webgl' | 'monto-mal';

export function porQueNoHayMotor(
  pref: PreferenciaFondo,
  flojo: boolean | null,
  hayWebgl: boolean
): MotivoSinMotor {
  if (pref === 'nunca') return 'preferencia';
  if (!cargarElMotor(pref, flojo)) return 'equipo';
  if (!hayWebgl) return 'webgl';
  // Se pidió, se pudo, hay WebGL, y aun así no hay lienzo: el motor se importó
  // y no llegó a dibujar. Es el único de los cuatro que es un error de verdad.
  return 'monto-mal';
}
