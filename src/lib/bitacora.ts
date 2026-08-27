import { plataforma } from '@/plataforma';

/**
 * Lo que la app fue haciendo, guardado en el teléfono para mirarlo DESPUÉS.
 *
 * Existe por un problema concreto: el registro por ubicación solo se puede
 * probar caminando hasta un gimnasio, y ahí nadie va a abrir una consola. Si
 * algo no funciona, la única forma de saber por qué es que la app se lo haya
 * anotado sola mientras pasaba.
 *
 * REGLAS DE LO QUE SE ANOTA:
 *
 * - **Distancias, nunca coordenadas.** Para entender por qué no disparó, lo
 *   que sirve es "estabas a 140 m con 60 m de precisión y el radio es 100",
 *   no dónde estabas. Y además así esto no es un rastro de ubicación guardado
 *   en el teléfono.
 * - **Acotada.** Sesenta líneas y se van cayendo las viejas. Un registro que
 *   crece para siempre se convierte en un problema propio.
 * - **No puede romper nada.** Anotar es siempre lo menos importante que está
 *   pasando: si falla, falla callado y la app sigue.
 *
 * NO ES una herramienta de producción ni tiene tests: es un banco de trabajo
 * para las dos semanas de uso propio. Cuando la app tenga usuarios de verdad,
 * esto se saca o se convierte en otra cosa.
 */

const CLAVE = 'ascent:bitacora';
const TOPE = 60;

export type Anotacion = {
  t: number;
  que: string;
  datos?: Record<string, string | number | boolean | null | undefined>;
};

export async function anotar(que: string, datos?: Anotacion['datos']) {
  try {
    const lista = await leerBitacora();
    // Las viejas se caen solas por el frente.
    const nueva = [...lista, { t: Date.now(), que, datos }].slice(-TOPE);
    await plataforma.almacenamiento.guardar(CLAVE, JSON.stringify(nueva));
  } catch {
    // Anotar no puede romper nada. Si el almacenamiento está lleno o
    // deshabilitado, se pierde la línea y ya.
  }
}

export async function leerBitacora(): Promise<Anotacion[]> {
  try {
    const crudo = await plataforma.almacenamiento.leer(CLAVE);
    if (!crudo) return [];
    const lista = JSON.parse(crudo);
    if (!Array.isArray(lista)) return [];
    return lista.filter((a) => typeof a?.t === 'number' && typeof a?.que === 'string');
  } catch {
    return [];
  }
}

export async function borrarBitacora() {
  await plataforma.almacenamiento.borrar(CLAVE);
}

/** Una línea por anotación, en texto plano, para leer o copiar y mandar. */
export function comoTexto(lista: Anotacion[], locale = 'es-UY'): string {
  if (lista.length === 0) return '';
  return lista
    .map((a) => {
      const hora = new Date(a.t).toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const dia = new Date(a.t).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
      const datos = Object.entries(a.datos ?? {})
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      return `${dia} ${hora}  ${a.que}${datos ? '  ' + datos : ''}`;
    })
    .join('\n');
}
