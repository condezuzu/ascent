import { plataforma } from '@plataforma';
import { eventos } from '@compartido/eventos';
import {
  CALIDAD_CAMBIO,
  CLAVE_CALIDAD,
  CLAVE_CALIDAD_MEDIDA,
  ESPERA_ANTES_DE_MEDIR_MS,
  SEGUNDOS_DE_MEDICION,
  calidadEfectiva,
  preferenciaValida,
  trasMedir,
  veredictoDeMedicion,
  type Calidad,
  type PreferenciaDeCalidad,
} from '@nucleo/calidad';
import { anotar } from './cajaNegra';
import { medirCuadros } from './medirCuadros';

/**
 * LA CALIDAD DEL FONDO EN ESTE TELÉFONO: lo que eligió la persona, lo que midió
 * la app, y el vigilante que mide. Las reglas están en `nucleo/calidad.ts`.
 *
 * ARRANCA EN "ALTA" hasta que se lee lo guardado: es un instante, y arrancar en
 * baja le mostraría el fondo borroso un momento a quien no le corresponde.
 */
let preferencia: PreferenciaDeCalidad = 'auto';
let medidaBaja = false;
let leido: Promise<void> | null = null;
let vigilando = false;

export function calidadAhora(): Calidad {
  return calidadEfectiva(preferencia, medidaBaja);
}
export function preferenciaAhora(): PreferenciaDeCalidad {
  return preferencia;
}
/** Si en automático la app ya la bajó sola. Para decirlo en Ajustes. */
export function bajoSola(): boolean {
  return preferencia === 'auto' && medidaBaja;
}

export function leerCalidad(): Promise<void> {
  if (!leido) {
    leido = (async () => {
      const antes = calidadAhora();
      try {
        preferencia = preferenciaValida(await plataforma.almacenamiento.leer(CLAVE_CALIDAD));
        medidaBaja = (await plataforma.almacenamiento.leer(CLAVE_CALIDAD_MEDIDA)) === 'baja';
      } catch {
        // Sin almacenamiento queda en automático y alta.
      }
      if (calidadAhora() !== antes) eventos.emitir(CALIDAD_CAMBIO);
    })();
  }
  return leido;
}

/** Lo elige la persona, en Ajustes. Volver a "automático" olvida lo medido: se mide de nuevo. */
export async function fijarCalidad(nueva: PreferenciaDeCalidad) {
  const antes = calidadAhora();
  preferencia = nueva;
  if (nueva === 'auto') medidaBaja = false;
  eventos.emitir(CALIDAD_CAMBIO);
  try {
    await plataforma.almacenamiento.guardar(CLAVE_CALIDAD, nueva);
    if (nueva === 'auto') await plataforma.almacenamiento.borrar(CLAVE_CALIDAD_MEDIDA);
  } catch {
    // Vale para esta vez aunque no quede guardado.
  }
  if (nueva === 'auto' && calidadAhora() === antes) void vigilarCalidad();
}

const esperar = (ms: number) => new Promise<void>((listo) => setTimeout(listo, ms));

/**
 * EL VIGILANTE: en automático, y mientras no haya bajado, mide de a ratos con
 * la app adelante. Con dos mediciones malas seguidas baja la calidad y lo
 * deja guardado: en ese teléfono ya arranca en baja la próxima vez.
 *
 * NO SUBE SOLA. Un teléfono que no dio ayer no da hoy, y andar cambiando el
 * fondo de nítido a borroso según el momento es peor que cualquiera de los dos.
 * Para volver a alta está Ajustes.
 */
export async function vigilarCalidad(): Promise<void> {
  if (vigilando) return;
  vigilando = true;
  try {
    await leerCalidad();
    let malas = 0;
    // Hasta diez mediciones por arranque: si en un minuto y medio anduvo bien, anda bien.
    for (let i = 0; i < 10; i++) {
      if (preferencia !== 'auto' || medidaBaja) return;
      await esperar(ESPERA_ANTES_DE_MEDIR_MS);
      if (preferencia !== 'auto' || medidaBaja) return;
      if (!plataforma.ciclo.visible()) continue;
      const m = await medirCuadros(SEGUNDOS_DE_MEDICION, 'calidad');
      const visible = plataforma.ciclo.visible();
      const paso = trasMedir(malas, visible ? veredictoDeMedicion(m) : null);
      malas = paso.malas;
      if (!paso.bajar) continue;
      medidaBaja = true;
      anotar(`calidad: bajó sola (${m?.fps ?? '?'} cuadros por segundo)`);
      eventos.emitir(CALIDAD_CAMBIO);
      try {
        await plataforma.almacenamiento.guardar(CLAVE_CALIDAD_MEDIDA, 'baja');
      } catch {
        // Se vuelve a medir la próxima vez.
      }
      return;
    }
  } finally {
    vigilando = false;
  }
}
