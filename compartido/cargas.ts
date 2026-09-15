import { plataforma } from '@plataforma';
import { cargaValida, type Carga } from '@nucleo/carga';

/**
 * CON QUÉ HACÉS CADA EJERCICIO, en este teléfono.
 *
 * La verdad está en la base (`cargas_elegidas`, migración 38), que es de la
 * cuenta. Esto es la copia para el gimnasio sin señal: si contestaste la
 * pregunta de las zancadas, la próxima vez no se puede volver a preguntar solo
 * porque en el subsuelo no llega la respuesta de la base.
 */
const CLAVE = 'ascent:cargas-elegidas';

export async function leerCargasElegidas(): Promise<Record<string, Carga>> {
  try {
    const crudo = await plataforma.almacenamiento.leer(CLAVE);
    const obj = crudo ? JSON.parse(crudo) : {};
    if (!obj || typeof obj !== 'object') return {};
    return Object.fromEntries(
      Object.entries(obj).flatMap(([k, v]) => {
        const c = cargaValida(v);
        return c ? [[k, c]] : [];
      })
    );
  } catch {
    return {};
  }
}

export async function recordarCarga(ejercicio: string, carga: Carga) {
  try {
    const actuales = await leerCargasElegidas();
    if (actuales[ejercicio] === carga) return;
    await plataforma.almacenamiento.guardar(CLAVE, JSON.stringify({ ...actuales, [ejercicio]: carga }));
  } catch {
    // Sin almacenamiento se vuelve a preguntar, que es molesto pero no rompe.
  }
}
