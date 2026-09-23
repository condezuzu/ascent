import { plataforma } from '@/plataforma';
import { cargarElMotor, esPreferenciaFondo, type PreferenciaFondo } from '@nucleo/fondo';

/**
 * Detectar el equipo y recordar lo que la persona eligió.
 *
 * La DECISIÓN vive en `nucleo/fondo.ts`, que se puede probar sin navegador.
 * Acá está lo que solo se puede hacer con el navegador delante.
 */

const CLAVE = 'ascent:fondo';

/**
 * ¿Es un equipo flojo?
 *
 * Dos señales, las únicas que se pueden leer SIN cargar nada — que es la
 * gracia: preguntarle al motor cuánto puede es tarde, porque para preguntarle
 * hay que haberlo cargado, y cargarlo es justo lo que cuesta.
 *
 * `deviceMemory` solo existe en Chrome y Android; `hardwareConcurrency` está
 * en todos lados menos en Safari viejo. Si ninguna contesta, la respuesta es
 * `null` —no sé— y NO "flojo": dejar sin fondo a alguien por no poder medirlo
 * sería castigar la falta de dato.
 *
 * Los umbrales: 4 núcleos o menos, o 4 GB o menos. Es el corte de gama baja de
 * 2020 para acá — un teléfono así existe y es exactamente el de la anécdota
 * que originó esto.
 */
export function equipoFlojo(): boolean | null {
  if (typeof navigator === 'undefined') return null;
  const n = navigator as Navigator & { deviceMemory?: number };
  const memoria = typeof n.deviceMemory === 'number' ? n.deviceMemory : null;
  const nucleos = typeof n.hardwareConcurrency === 'number' ? n.hardwareConcurrency : null;
  if (memoria === null && nucleos === null) return null;
  if (memoria !== null && memoria <= 4) return true;
  if (nucleos !== null && nucleos <= 4) return true;
  return false;
}

export async function leerPreferenciaFondo(): Promise<PreferenciaFondo> {
  const v = await plataforma.almacenamiento.leer(CLAVE);
  return esPreferenciaFondo(v) ? v : 'auto';
}

export function guardarPreferenciaFondo(p: PreferenciaFondo) {
  return plataforma.almacenamiento.guardar(CLAVE, p);
}

/** Lo que hay que saber antes de decidir si se importa three.js. */
export async function hayQueCargarElMotor(): Promise<boolean> {
  return cargarElMotor(await leerPreferenciaFondo(), equipoFlojo());
}

/**
 * ¿ESTE NAVEGADOR DA WEBGL?
 *
 * Se pregunta con un lienzo suelto de un píxel y se suelta enseguida: pedirle
 * el contexto al lienzo del fondo lo dejaría tomado, y un lienzo solo entrega
 * un tipo de contexto por vez.
 *
 * SE SUELTA A MANO con `WEBGL_lose_context`. Un navegador permite unos pocos
 * contextos vivos a la vez y el recolector tarda lo suyo; sin esto, preguntar
 * varias veces se come el cupo del motor de verdad.
 *
 * SOLO LA USA LA GALERÍA, para explicar por qué no se ve ningún cuerpo. La app
 * no pregunta esto nunca: no le sirve de nada saberlo, porque igual no tiene
 * un plan B que ofrecer.
 */
export function hayWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}
