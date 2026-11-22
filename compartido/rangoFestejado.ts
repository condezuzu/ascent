import { plataforma } from '@plataforma';

// EL ÚLTIMO RANGO QUE ESTE TELÉFONO FESTEJÓ O MOSTRÓ, por cuenta (21/11): contra esto se sabe si hay una subida
// que nadie vio (ver `subidaSinVer` en `nucleo/rangos.ts`). Con su dueño en la clave, como la guía: en un
// teléfono con dos cuentas no se pisan.
const claveDe = (uid: string) => `ascent:rango-festejado:${uid}`;
// Lo recién guardado se lee de acá: la escritura al teléfono tarda, y una lectura que le ganara repetía la ceremonia.
const recien = new Map<string, number>();

export async function leerRangoFestejado(uid: string): Promise<number | null> {
  const r = recien.get(uid);
  if (r !== undefined) return r;
  const n = Number(await plataforma.almacenamiento.leer(claveDe(uid)).catch(() => null));
  return Number.isInteger(n) && n >= 1 ? n : null;
}

export async function guardarRangoFestejado(uid: string, rango: number): Promise<void> {
  recien.set(uid, rango);
  await plataforma.almacenamiento.guardar(claveDe(uid), String(rango)).catch(() => undefined);
}
