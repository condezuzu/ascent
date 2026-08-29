import { plataforma } from '@/plataforma';

// Qué parte de la guía ya vio el usuario. Vive en el teléfono y no en la base:
// es preferencia de este aparato, no un dato de la cuenta.
//
// Va atada al id de usuario por la misma razón que la caché del perfil: en un
// teléfono prestado, el que entra después tiene que ver la guía igual.

const CLAVE = 'ascent:guia';

// Cada globo se muestra UNA vez y no vuelve. Agregar uno acá no rompe nada:
// el que ya usó la app lo va a ver la próxima vez que pase por esa pantalla,
// que es justo lo que se quiere para una parte nueva.
export type Globo = 'leaderboard' | 'stats' | 'album' | 'series';

type Guia = { uid: string; recorrido: boolean; globos: Globo[] };

async function leer(uid: string): Promise<Guia> {
  const crudo = await plataforma.almacenamiento.leer(CLAVE);
  if (crudo) {
    try {
      const g = JSON.parse(crudo) as Guia;
      if (g.uid === uid) return { uid, recorrido: !!g.recorrido, globos: g.globos ?? [] };
    } catch {
      // basura de otra versión: se muestra la guía, que es el estado seguro
    }
  }
  return { uid, recorrido: false, globos: [] };
}

const escribir = (g: Guia) => plataforma.almacenamiento.guardar(CLAVE, JSON.stringify(g));

export async function faltaElRecorrido(uid: string): Promise<boolean> {
  return !(await leer(uid)).recorrido;
}

export async function marcarRecorridoVisto(uid: string) {
  await escribir({ ...(await leer(uid)), recorrido: true });
}

export async function faltaElGlobo(uid: string, cual: Globo): Promise<boolean> {
  return !(await leer(uid)).globos.includes(cual);
}

export async function marcarGloboVisto(uid: string, cual: Globo) {
  const g = await leer(uid);
  if (g.globos.includes(cual)) return;
  await escribir({ ...g, globos: [...g.globos, cual] });
}

/** Desde Ajustes: vuelve a mostrar el recorrido y los tres globos. */
export async function reiniciarGuia(uid: string) {
  await escribir({ uid, recorrido: false, globos: [] });
}
