import { createContext } from 'react';
import type { OpcionesFondo } from '@compartido/motor/escena';

/**
 * QUÉ FONDO PIDE LA PANTALLA ACTIVA.
 *
 * En la app nativa el motor no vive en Inicio: vive en la raíz (`FondoRaiz`),
 * con un solo contexto de GL para toda la sesión. Las pantallas solo PIDEN:
 * "quiero este cuerpo, con estas opciones".
 *
 * POR QUÉ. Con el motor adentro de Inicio, cada vuelta a Inicio creaba un
 * `GLView` nuevo, con un contexto nuevo, y compilaba todos los shaders otra
 * vez: medido, 6 shaders y 3 programas por vuelta. Inicio es la pantalla que
 * más se abre.
 *
 * ─────────────────────────────────────────────────────────────────────
 * ES UNA PILA, Y NO UN SOLO CASILLERO (24/9)
 *
 * Antes había una sola variable: pedir la pisaba y soltar la vaciaba. Eso
 * alcanzaba cuando las pestañas montaban solo la activa, y dejó de alcanzar el
 * 23/9, cuando se arregló el titileo dejándolas TODAS montadas. Dos bugs
 * salieron de ahí, y el humano encontró los dos:
 *
 *   - VOLVER DEL PERFIL DEJABA EL ESPACIO SIN EL CUERPO. El perfil pedía su
 *     fondo encima del de Inicio; al cerrarse, soltaba y vaciaba el casillero.
 *     Inicio seguía montado, su efecto no se volvía a correr, y nadie pedía
 *     nada: quedaba la escena en pausa.
 *   - Y VOLVER A INICIO DESDE OTRA PESTAÑA, lo mismo con otra cara: Ranking,
 *     Álbum, Stats y Ajustes piden `soloEstrellas`, o sea cielo SIN cuerpo. El
 *     último que hubiera pedido ganaba para siempre.
 *
 * Con una pila, soltar no vacía: DESTAPA lo que había debajo. Que es lo que
 * hace una pantalla apilada cuando se cierra.
 *
 * PEDIR DE NUEVO CON EL MISMO `id` ACTUALIZA EN EL LUGAR, no sube a la cima:
 * que Inicio cambie de planeta mientras mirás tu perfil no tiene por qué
 * robarle el fondo al perfil.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Y SOLO PIDE LA QUE SE VE (`ContextoVisible`)
 *
 * La pila sola no alcanzaba: con las cinco pestañas montadas, las cinco
 * pedían. Cada carril de `Pestanas` envuelve a su pantalla diciéndole si está
 * a la vista, y `FondoEspacial` suelta su pedido mientras no lo esté. Así la
 * pila tiene, como mucho, la pestaña visible y lo que haya apilado encima.
 *
 * `null` = nadie pide fondo: la raíz guarda la escena en pausa.
 */
export type Pedido = OpcionesFondo & {
  atmosfera?: boolean;
  /** Cuánto tapa el velo. Sin esto lo decide el rango, como en la web. */
  velo?: number;
};

type Entrada = { id: string; pedido: Pedido };

let pila: Entrada[] = [];
const oyentes = new Set<(p: Pedido | null) => void>();

/** El de más arriba: la pantalla más nueva de las que están pidiendo. */
function arriba(): Pedido | null {
  return pila.length ? pila[pila.length - 1].pedido : null;
}

function avisar() {
  const p = arriba();
  for (const fn of [...oyentes]) fn(p);
}

export function pedirFondo(id: string, p: Pedido) {
  const i = pila.findIndex((e) => e.id === id);
  // En el lugar si ya estaba: ver "pedir de nuevo con el mismo id", arriba.
  if (i >= 0) pila[i] = { id, pedido: p };
  else pila.push({ id, pedido: p });
  avisar();
}

export function soltarFondo(id: string) {
  const antes = pila.length;
  pila = pila.filter((e) => e.id !== id);
  if (pila.length !== antes) avisar();
}

/** Avisa con el pedido actual apenas se suscribe, y después en cada cambio. */
export function escucharFondo(fn: (p: Pedido | null) => void): () => void {
  oyentes.add(fn);
  fn(arriba());
  return () => {
    oyentes.delete(fn);
  };
}

/**
 * SI LA PANTALLA QUE PIDE ESTÁ A LA VISTA.
 *
 * Por omisión `true`: una pantalla que nadie envuelve —el perfil apilado, una
 * hoja— está a la vista por definición. Lo pone `Pestanas`, que es el único
 * lugar donde hay pantallas montadas y escondidas al mismo tiempo.
 */
export const ContextoVisible = createContext(true);
