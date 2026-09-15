import { plataforma } from '@/plataforma';
import { pasoValido } from '@nucleo/recorrido';

// Qué parte de la guía ya vio el usuario. Vive en el teléfono y no en la base:
// es preferencia de este aparato, no un dato de la cuenta.
//
// Va atada al id de usuario por la misma razón que la caché del perfil: en un
// teléfono prestado, el que entra después tiene que ver la guía igual.

const CLAVE = 'ascent:guia';

// Cada globo se muestra UNA vez y no vuelve. Agregar uno acá no rompe nada:
// el que ya usó la app lo va a ver la próxima vez que pase por esa pantalla,
// que es justo lo que se quiere para una parte nueva.
//
// Stats, Álbum, Ranking y Ajustes ya no tienen globo: los presenta el recorrido,
// una línea por pantalla. Quedan los dos que explican algo que el recorrido no
// muestra: contar series adentro de una sesión, y las fotos privadas del perfil.
export type Globo = 'series' | 'perfil';

type Guia = { uid: string; recorrido: boolean; paso?: number; globos: Globo[] };

async function leer(uid: string): Promise<Guia> {
  const crudo = await plataforma.almacenamiento.leer(CLAVE);
  if (crudo) {
    try {
      const g = JSON.parse(crudo) as Guia;
      if (g.uid === uid) return { uid, recorrido: !!g.recorrido, paso: g.paso, globos: g.globos ?? [] };
    } catch {
      // basura de otra versión: se muestra la guía, que es el estado seguro
    }
  }
  return { uid, recorrido: false, globos: [] };
}

const escribir = (g: Guia) => plataforma.almacenamiento.guardar(CLAVE, JSON.stringify(g));

/** En qué paso del recorrido va; `null` si ya se vio o se saltó. */
export async function leerPasoDelRecorrido(uid: string): Promise<number | null> {
  const g = await leer(uid);
  return g.recorrido ? null : pasoValido(g.paso);
}

export async function guardarPasoDelRecorrido(uid: string, paso: number) {
  await escribir({ ...(await leer(uid)), paso });
}

export async function marcarRecorridoVisto(uid: string) {
  await escribir({ ...(await leer(uid)), recorrido: true, paso: 0 });
}

export async function faltaElGlobo(uid: string, cual: Globo): Promise<boolean> {
  return !(await leer(uid)).globos.includes(cual);
}

export async function marcarGloboVisto(uid: string, cual: Globo) {
  const g = await leer(uid);
  if (g.globos.includes(cual)) return;
  await escribir({ ...g, globos: [...g.globos, cual] });
}

/** Desde Ajustes: vuelve a mostrar el recorrido y todos los globos. */
export async function reiniciarGuia(uid: string) {
  await escribir({ uid, recorrido: false, paso: 0, globos: [] });
}
