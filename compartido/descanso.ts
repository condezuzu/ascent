import { DESCANSO_MAXIMO, DESCANSO_MINIMO, DESCANSO_PREDETERMINADO } from '@nucleo/reglas';
import { plataforma } from '@plataforma';
import { T } from '@nucleo/textos';

const CLAVE = 'ascent:descanso';

export type DescansoVivo = { fin: number; duracion: number };

/**
 * El descanso en curso vive en el teléfono, no en la base (§18.3): no hay
 * ningún dato que valga guardar y son quince o veinte descansos por sesión,
 * en un gimnasio con dos rayas de señal. Tiene que arrancar al instante y sin
 * red.
 *
 * Se guarda el timestamp de FIN, no el de inicio ni los segundos restantes:
 * así `restante = fin - ahora` sobrevive a que se apague la pantalla, a que la
 * app pase a segundo plano y a que se cierre entera (§18.4).
 *
 * Acá el reloj del teléfono alcanza, a diferencia de la sesión: las dos puntas
 * de la cuenta salen del mismo reloj, así que el desfasaje se cancela solo, y
 * no hay nada que ganar haciendo trampa —descansar de más no es un premio—.
 */
export async function leerDescanso(): Promise<DescansoVivo | null> {
  const crudo = await plataforma.almacenamiento.leer(CLAVE);
  if (!crudo) return null;
  try {
    const d = JSON.parse(crudo) as DescansoVivo;
    if (typeof d?.fin !== 'number' || typeof d?.duracion !== 'number') return null;
    return d;
  } catch {
    // basura de otra versión: nada de esto puede tumbar la pantalla principal
    return null;
  }
}

/**
 * Devuelve el descanso EN EL ACTO y guarda de fondo. Es a propósito: quien
 * toca "serie hecha" tiene que ver la cuenta atrás ya, y lo guardado solo
 * sirve para que sobreviva a cerrar la app. Si la escritura falla o tarda, el
 * descanso corre igual.
 */
export function guardarDescanso(duracion: number): DescansoVivo {
  const d = { fin: Date.now() + duracion * 1000, duracion };
  void plataforma.almacenamiento.guardar(CLAVE, JSON.stringify(d));
  void avisarAlTerminar(d);
  return d;
}

const AVISO = 'descanso';

/**
 * EL AVISO CON LA PANTALLA BLOQUEADA (§13d, la prioridad de la etapa nativa).
 *
 * Se programa ACÁ, donde se guarda el descanso, y no en cada botón: empezar
 * (el `+`), descansar suelto, cambiar la duración y saltar pasan todos por
 * estas tres funciones, así que ninguno puede dejar un aviso viejo sonando ni
 * uno nuevo sin programar.
 *
 * Solo donde el aviso llega con la pantalla bloqueada —la app nativa—. En web
 * eso no existe, y la pantalla del descanso ya vibra y suena con la app
 * adelante: programar también ahí sería avisar dos veces.
 *
 * Sigue sin ser la fuente de la verdad (§18.4): la cuenta sale de `fin`. Si el
 * sistema no entrega la notificación, el número al volver sigue bien.
 */
async function avisarAlTerminar(d: DescansoVivo | null) {
  // LA CUENTA A LA VISTA (§13d) VA ACÁ MISMO, y no en otra función, por lo
  // mismo que el aviso: empezar, descansar suelto, cambiar la duración y
  // saltar pasan todos por este punto. Puesto en cada botón, el primero que
  // alguien agregue sin acordarse deja una cuenta colgada en la pantalla
  // bloqueada, que es de las cosas más difíciles de notar que se rompió.
  //
  // NO SE ESPERA A QUE TERMINE: encender una Live Activity puede tardar, y lo
  // que no puede tardar es que el descanso arranque. Es un agregado encima, y
  // si falla no se entera nadie más que la pantalla de bloqueo.
  void enVivoAlTerminar(d);

  if (!plataforma.avisos.conPantallaBloqueada()) return;
  const faltan = d ? restante(d.fin) : 0;
  if (faltan <= 0) return plataforma.avisos.cancelar(AVISO);
  // Con la app adelante el aviso lo da la pantalla del descanso: el callback
  // no hace nada más.
  await plataforma.avisos.programar(AVISO, faltan, () => {});
}

async function enVivoAlTerminar(d: DescansoVivo | null) {
  if (!plataforma.enVivo.disponible()) return;
  // Un descanso ya terminado se apaga igual que uno saltado: pasa al bajar la
  // duración por debajo de lo que ya descansaste.
  if (!d || restante(d.fin) <= 0) return plataforma.enVivo.esconder();
  await plataforma.enVivo.mostrarDescanso(d.fin, d.duracion);
}

/**
 * CAMBIAR LA DURACIÓN SIN REINICIAR LA CUENTA.
 *
 * Estabas en 3 minutos, llevas 1:10 descansando y pasás a 2: lo que queda es
 * 0:50, no 2:00. La versión anterior reiniciaba, o sea que cambiar de idea
 * costaba el tiempo ya descansado y la app te hacía esperar de nuevo por
 * haberla corregido.
 *
 * Si ya descansaste MÁS que la duración nueva, el descanso está terminado:
 * `fin` queda en el pasado y `restante` devuelve cero, que es exactamente lo
 * que hay que mostrar.
 */
export function cambiarDuracion(vivo: DescansoVivo, duracion: number): DescansoVivo {
  const inicio = vivo.fin - vivo.duracion * 1000;
  const d = { fin: inicio + duracion * 1000, duracion };
  void plataforma.almacenamiento.guardar(CLAVE, JSON.stringify(d));
  // Bajar a 2 con 2:30 encima deja el descanso terminado: ahí se cancela.
  void avisarAlTerminar(d);
  return d;
}

export function borrarDescanso() {
  void avisarAlTerminar(null);
  return plataforma.almacenamiento.borrar(CLAVE);
}

/** Segundos que faltan. Nunca negativo: cero es cero. */
export function restante(fin: number): number {
  return Math.max(0, Math.ceil((fin - Date.now()) / 1000));
}

/** "2:30". Siempre con minutos, aunque falten segundos: es una cuenta atrás. */
export function cuentaAtras(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Para etiquetas y presets: "60 s", "90 s", "3 min".
 *
 * Abajo de dos minutos se dice en segundos y no en minutos: en una fila de
 * presets, "1:30" se lee como un reloj y "90 s" se lee como una opción. Es la
 * diferencia entre elegir y tener que interpretar.
 */
export function duracionCorta(segundos: number): string {
  if (segundos < 120) return T.fechas.segundos(segundos);
  if (segundos % 60 === 0) return T.fechas.minutos(segundos / 60);
  return cuentaAtras(segundos);
}

/** Lo que venga de la base, acotado a lo que la columna acepta. */
export function duracionValida(valor: unknown): number {
  const n = Number(valor);
  if (!Number.isFinite(n)) return DESCANSO_PREDETERMINADO;
  return Math.min(DESCANSO_MAXIMO, Math.max(DESCANSO_MINIMO, Math.round(n)));
}

/**
 * Vibra si el teléfono puede. En iPhone NO puede: WebKit nunca implementó la
 * Vibration API (§18.7). Devuelve si vibró, para no prometer en la interfaz
 * algo que no va a pasar.
 *
 * El patrón es doble a propósito: un pulso solo se confunde con cualquier
 * notificación.
 */
export function vibrar(): boolean {
  return plataforma.haptica.pulso();
}

export function puedeVibrar(): boolean {
  return plataforma.haptica.disponible();
}

const CLAVE_SONIDO = 'ascent:descanso-sonido';

/**
 * Si el aviso suena, además de vibrar. **Apagado por defecto**: sonar sin
 * avisar en un gimnasio es peor que no sonar (§18.7).
 *
 * Va en el teléfono y no en `profiles` a propósito: es una preferencia del
 * TELÉFONO, no de la cuenta. El mismo usuario puede querer sonido en casa y
 * no en el gimnasio, y eso no viaja con la sesión.
 */
export async function leerSonido(): Promise<boolean> {
  return (await plataforma.almacenamiento.leer(CLAVE_SONIDO)) === '1';
}

export function guardarSonido(prendido: boolean) {
  return plataforma.almacenamiento.guardar(CLAVE_SONIDO, prendido ? '1' : '0');
}
