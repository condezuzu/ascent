import { plataforma } from '@plataforma';
import { T, TEXTOS_ES, usarTextos } from '@nucleo/textos';
import { EN } from '@nucleo/textos-en';
import { eventos } from '@compartido/eventos';

/**
 * EL IDIOMA DE LA APP (14/10/2026). El teléfono en español → español; en
 * cualquier otro idioma → inglés. Y en Ajustes se puede fijar a mano.
 *
 * El del aparato sale de `Intl`, que está en Hermes: no hace falta un módulo
 * nativo, así que esto viaja por OTA. Lo elegido a mano es de ESTE teléfono,
 * no de la cuenta, como el sonido del descanso.
 */
export type Idioma = 'es' | 'en';
export type PreferenciaIdioma = 'auto' | Idioma;

const CLAVE = 'ascent:idioma';
/** Se avisa al elegir otro idioma: la raíz vuelve a dibujar todo. */
export const IDIOMA_CAMBIO = 'ascent:idioma-cambio';

export function idiomaDelAparato(locale?: string): Idioma {
  let l = locale;
  if (l === undefined) {
    try {
      l = Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
      l = 'es';
    }
  }
  return (l ?? 'es').toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function idiomaElegido(p: PreferenciaIdioma, aparato: Idioma = idiomaDelAparato()): Idioma {
  return p === 'auto' ? aparato : p;
}

/** Cambia los textos de `T`. Lo que ya está en pantalla lo vuelve a dibujar quien escucha `IDIOMA_CAMBIO`. */
export function aplicarIdioma(i: Idioma): boolean {
  if (T.idioma === i) return false;
  usarTextos(i === 'en' ? EN : TEXTOS_ES);
  return true;
}

export async function leerPreferenciaIdioma(): Promise<PreferenciaIdioma> {
  const v = await plataforma.almacenamiento.leer(CLAVE).catch(() => null);
  return v === 'es' || v === 'en' ? v : 'auto';
}

export async function fijarPreferenciaIdioma(p: PreferenciaIdioma): Promise<void> {
  await plataforma.almacenamiento.guardar(CLAVE, p).catch(() => undefined);
  if (aplicarIdioma(idiomaElegido(p))) eventos.emitir(IDIOMA_CAMBIO);
}

/** Al arrancar, después del del aparato: si se eligió otro a mano, se aplica y se avisa. */
export async function aplicarLoElegido(): Promise<void> {
  if (aplicarIdioma(idiomaElegido(await leerPreferenciaIdioma()))) eventos.emitir(IDIOMA_CAMBIO);
}
