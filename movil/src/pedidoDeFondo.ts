import type { OpcionesFondo } from '@compartido/motor/escena';

/**
 * QUÉ FONDO PIDE LA PANTALLA ACTIVA.
 *
 * En la app nativa el motor no vive en Inicio: vive en la raíz
 * (`FondoRaiz`, adentro de `Pestanas`), con un solo contexto de GL para toda
 * la sesión. Inicio solo PIDE: "quiero este cuerpo, con estas opciones".
 *
 * POR QUÉ. Las pestañas montan solo la activa. Con el motor adentro de Inicio,
 * cada vuelta a Inicio creaba un `GLView` nuevo, con un contexto nuevo, y
 * compilaba todos los shaders otra vez: medido, 6 shaders y 3 programas por
 * vuelta, lo mismo que la primera entrada. Inicio es la pantalla que más se
 * abre; era el mismo problema que el arranque de 3 s de la web.
 *
 * `null` = ninguna pantalla pide fondo: la raíz guarda la escena en pausa.
 */
export type Pedido = OpcionesFondo & {
  atmosfera?: boolean;
  /** Cuánto tapa el velo. Sin esto lo decide el rango, como en la web. */
  velo?: number;
};

let actual: Pedido | null = null;
const oyentes = new Set<(p: Pedido | null) => void>();

export function pedirFondo(p: Pedido) {
  actual = p;
  for (const fn of [...oyentes]) fn(actual);
}

export function soltarFondo() {
  actual = null;
  for (const fn of [...oyentes]) fn(actual);
}

/** Avisa con el pedido actual apenas se suscribe, y después en cada cambio. */
export function escucharFondo(fn: (p: Pedido | null) => void): () => void {
  oyentes.add(fn);
  fn(actual);
  return () => {
    oyentes.delete(fn);
  };
}
