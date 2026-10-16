/**
 * EL CARTEL QUE BAJA DE ARRIBA (14/10/2026): te quieren agregar, o quieren
 * unirse a tu entrenamiento. Foto, nombre y dos botones, como un desafío de
 * ajedrez. Cada pedido se muestra UNA vez —también si llegó con la app cerrada
 * y recién ahora se abre—; si no se contesta ahí, sigue en Ranking o en Inicio.
 */
export type Novedad = {
  tipo: 'amistad' | 'union';
  /** El id del pedido (de `friendships` o de `entrenos_compartidos`). */
  id: string;
  otro: { id: string; username: string; avatar_url: string | null };
};

export const CLAVE_NOVEDADES = 'ascent:novedades-vistas';

/** Los pedidos de unirse que Inicio dibuja como tarjeta: el que está en el cartel de arriba, no (15/10). */
export function tarjetasDeInicio<P extends { id: string }>(pedidos: P[], enCartel: { tipo: string; id: string } | null): P[] {
  return enCartel?.tipo === 'union' ? pedidos.filter((p) => p.id !== enCartel.id) : pedidos;
}
/** Con cuántos pedidos vistos se queda: los más viejos ya no vuelven. */
const TOPE = 200;

type Vistas = { uid: string; ids: string[] };

function leer(crudo: string | null): Vistas | null {
  try {
    const v = JSON.parse(crudo ?? 'null') as Vistas | null;
    return v && typeof v.uid === 'string' && Array.isArray(v.ids) ? v : null;
  } catch {
    return null;
  }
}

/** La primera que esta cuenta no vio. Lo visto por OTRA cuenta en el mismo teléfono no cuenta. */
export function cualMostrar(novedades: Novedad[], crudo: string | null, uid: string): Novedad | null {
  const v = leer(crudo);
  const vistas = new Set(v?.uid === uid ? v.ids : []);
  return novedades.find((n) => !vistas.has(`${n.tipo}:${n.id}`)) ?? null;
}

export function conVista(crudo: string | null, uid: string, n: Novedad): string {
  const v = leer(crudo);
  const ids = v?.uid === uid ? v.ids.filter((x) => x !== `${n.tipo}:${n.id}`) : [];
  return JSON.stringify({ uid, ids: [...ids, `${n.tipo}:${n.id}`].slice(-TOPE) });
}
