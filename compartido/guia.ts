import { plataforma } from '@plataforma';
import { pasoAlAbrir } from '@nucleo/recorrido';

// Qué parte de la guía ya vio el usuario. Vive en el teléfono y no en la base:
// es preferencia de este aparato, no un dato de la cuenta.
//
// Va atada al id de usuario por la misma razón que la caché del perfil: en un
// teléfono prestado, el que entra después tiene que ver la guía igual.

const CLAVE = 'ascent:guia';

/**
 * LOS GLOBITOS DE LA PRIMERA VEZ (15/10): seis, cada uno saliendo de lo que explica,
 * y ninguno más. Reemplazan al recorrido de seis pasos, que se sacó con la entrada
 * nueva. `series` es el del + de siempre (mismo nombre: quien ya lo cerró no lo ve
 * de nuevo).
 */
export type Globo = 'elegir' | 'series' | 'descanso' | 'amigos' | 'album' | 'rutina';

/**
 * LAS CUENTAS DE ANTES NO VEN LOS GLOBITOS NUEVOS: ya conocen la app. Se decide por
 * la fecha de alta de la cuenta, que es la misma en cualquier aparato (un globo
 * visto se guarda en el teléfono; una cuenta vieja en un teléfono nuevo los vería
 * todos). "Volver a ver la guía" los muestra igual (`deNuevo`).
 */
export const GLOBOS_DESDE = '2026-10-15T00:00:00Z';

type Guia = { uid: string; recorrido: boolean; paso?: number; globos: string[]; deNuevo?: boolean };

// UNA CLAVE POR CUENTA (13/10). Era una sola con un dueño: en un teléfono con
// dos cuentas que se alternan, cada una pisaba lo de la otra y a quien ya la
// había terminado la guía le volvía a arrancar en cada ida y vuelta. La clave
// vieja se sigue leyendo, para no mostrársela de nuevo a quien ya la vio.
const claveDe = (uid: string) => `${CLAVE}:${uid}`;

async function leer(uid: string): Promise<Guia> {
  const crudo = (await plataforma.almacenamiento.leer(claveDe(uid))) ?? (await plataforma.almacenamiento.leer(CLAVE));
  if (crudo) {
    try {
      const g = JSON.parse(crudo) as Guia;
      if (g.uid === uid) return { uid, recorrido: !!g.recorrido, paso: g.paso, globos: g.globos ?? [], deNuevo: !!g.deNuevo };
    } catch {
      // basura de otra versión: se muestra la guía, que es el estado seguro
    }
  }
  return { uid, recorrido: false, globos: [] };
}

const escribir = (g: Guia) => plataforma.almacenamiento.guardar(claveDe(g.uid), JSON.stringify(g));

/** En qué paso del recorrido va; `null` si ya se vio. Ver `pasoAlAbrir`. */
export async function leerPasoDelRecorrido(uid: string): Promise<number | null> {
  return pasoAlAbrir(await leer(uid));
}

/**
 * ¿Falta mostrar este globo? `creadaEl` es la fecha de alta de la cuenta (la de la
 * sesión): una cuenta de antes de `GLOBOS_DESDE` no los ve, salvo que haya pedido
 * ver la guía de nuevo.
 */
export async function faltaElGlobo(uid: string, cual: Globo, creadaEl?: string | null): Promise<boolean> {
  const g = await leer(uid);
  if (g.globos.includes(cual)) return false;
  if (g.deNuevo) return true;
  return !creadaEl || creadaEl >= GLOBOS_DESDE;
}

// DE A UNA (ronda 9, 16/10): el primer + cierra el del + y el descanso que arranca
// se da por visto en el mismo instante. Las dos leían la guía antes de que la otra
// guardara, y la segunda pisaba a la primera: el del + volvía en la sesión siguiente.
let enCola: Promise<unknown> = Promise.resolve();
function deAUna<T>(hacer: () => Promise<T>): Promise<T> {
  const paso = enCola.then(hacer);
  enCola = paso.catch(() => undefined);
  return paso;
}

export function marcarGloboVisto(uid: string, cual: Globo) {
  return deAUna(async () => {
    const g = await leer(uid);
    if (g.globos.includes(cual)) return;
    await escribir({ ...g, globos: [...g.globos, cual] });
  });
}

/** Al elegir el nombre: la guía empieza de cero (los seis globitos, cada uno en su momento). */
export function reiniciarGuia(uid: string) {
  return deAUna(() => escribir({ uid, recorrido: true, paso: 0, globos: [] }));
}

/** Desde Ajustes, "Volver a ver la guía": los globitos vuelven, también para una cuenta de antes. */
export const GUIA_DE_NUEVO = 'ascent:guia-de-nuevo';
export function verLaGuiaDeNuevo(uid: string) {
  return deAUna(() => escribir({ uid, recorrido: true, paso: 0, globos: [], deNuevo: true }));
}
