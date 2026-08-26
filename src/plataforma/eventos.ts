// Avisos entre partes de la app que no se conocen entre sí.
//
// NO tiene implementación por plataforma, y esa es la gracia: antes esto
// viajaba por `window.dispatchEvent`, que en Expo no existe. Un emisor en
// memoria hace exactamente lo mismo —los oyentes viven en el mismo proceso—,
// así que en vez de un puerto con dos implementaciones el problema desaparece.
//
// Vive igual en `plataforma/` porque el motivo de que exista es la migración.

type Oyente = () => void;

const oyentes = new Map<string, Set<Oyente>>();

export type Eventos = {
  emitir(nombre: string): void;
  /** Devuelve la función para dejar de escuchar. */
  escuchar(nombre: string, fn: Oyente): () => void;
};

export const eventos: Eventos = {
  emitir(nombre) {
    // La garantía es: **los que estaban escuchando cuando se emitió reciben el
    // aviso**, pase lo que pase con las suscripciones mientras corre. Por eso
    // se recorre una copia.
    //
    // Sin ella el comportamiento depende de un detalle de `Set`: borrar un
    // elemento que la iteración todavía no visitó hace que no se visite, así
    // que un oyente podría dejar sin aviso a otro según el orden en que se
    // suscribieron. Con la copia, el orden no cambia nada.
    for (const fn of [...(oyentes.get(nombre) ?? [])]) fn();
  },

  escuchar(nombre, fn) {
    const suyos = oyentes.get(nombre) ?? new Set<Oyente>();
    suyos.add(fn);
    oyentes.set(nombre, suyos);
    return () => {
      suyos.delete(fn);
      if (suyos.size === 0) oyentes.delete(nombre);
    };
  },
};
