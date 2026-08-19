// Qué parte de la guía ya vio el usuario. Vive en el teléfono y no en la
// base: es preferencia de este aparato, no un dato de la cuenta, y no vale
// una consulta de red antes de poder pintar la pantalla.
//
// Va atada al id de usuario por la misma razón que la caché del perfil: en un
// teléfono prestado, el que entra después tiene que ver la guía igual.

const CLAVE = 'ascent:guia';

export type Globo = 'leaderboard' | 'stats' | 'album';

type Guia = { uid: string; recorrido: boolean; globos: Globo[] };

function leer(uid: string): Guia {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) {
      const g = JSON.parse(crudo) as Guia;
      if (g.uid === uid) return { uid, recorrido: !!g.recorrido, globos: g.globos ?? [] };
    }
  } catch {
    // sin localStorage (modo privado, cuota llena): la guía se muestra siempre
  }
  return { uid, recorrido: false, globos: [] };
}

function escribir(g: Guia) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(g));
  } catch {
    // nada que hacer: no poder recordarlo es mejor que romper la pantalla
  }
}

export function faltaElRecorrido(uid: string): boolean {
  return !leer(uid).recorrido;
}

export function marcarRecorridoVisto(uid: string) {
  escribir({ ...leer(uid), recorrido: true });
}

export function faltaElGlobo(uid: string, cual: Globo): boolean {
  return !leer(uid).globos.includes(cual);
}

export function marcarGloboVisto(uid: string, cual: Globo) {
  const g = leer(uid);
  if (g.globos.includes(cual)) return;
  escribir({ ...g, globos: [...g.globos, cual] });
}

/** Desde Ajustes: vuelve a mostrar el recorrido y los tres globos. */
export function reiniciarGuia(uid: string) {
  escribir({ uid, recorrido: false, globos: [] });
}
