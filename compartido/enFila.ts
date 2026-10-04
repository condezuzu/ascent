/**
 * ESCRITURAS DE UN MISMO VALOR, EN FILA (4/10).
 *
 * Los días de descanso se guardan mandando el CONJUNTO entero. Dos toques
 * seguidos mandaban dos escrituras sueltas: si llegaban cruzadas quedaba
 * guardado el conjunto viejo, y si fallaba la primera la pantalla volvía a
 * "antes del primer toque" con la base ya en lo del segundo. Pantalla y base
 * quedaban distintas sin ningún aviso, hasta volver a entrar.
 *
 * Acá cada pedido espera al anterior, manda LO ÚLTIMO QUE SE PIDIÓ —no lo que
 * había cuando se tocó— y, si la base dice que no, la pantalla vuelve a lo
 * último que la base SÍ aceptó.
 */
export function escritorEnFila<T>({
  guardado,
  escribir,
  iguales,
  pintar,
  alFallar,
}: {
  /** Lo que la base tiene al empezar. */
  guardado: T;
  escribir: (valor: T) => Promise<boolean>;
  iguales: (a: T, b: T) => boolean;
  /** Lo que tiene que verse. */
  pintar: (valor: T) => void;
  alFallar: () => void;
}) {
  let deseado = guardado;
  let enBase = guardado;
  let enVuelo = 0;
  let fila: Promise<void> = Promise.resolve();

  return {
    /** Lo último que se pidió: el próximo cambio sale de acá, no de la pantalla. */
    deseado: () => deseado,
    /**
     * Lo que llega de afuera (una recarga del perfil). Con algo en vuelo no se
     * le cree: puede haber salido antes del toque y llegar después.
     */
    alDia(valor: T) {
      if (enVuelo > 0) return;
      deseado = valor;
      enBase = valor;
    },
    pedir(valor: T): Promise<void> {
      deseado = valor;
      enVuelo++;
      fila = fila.then(async () => {
        try {
          const pedido = deseado;
          // Ya quedó así (lo mandó el anterior) o el anterior falló y se volvió atrás.
          if (iguales(pedido, enBase)) return;
          if (await escribir(pedido).catch(() => false)) {
            enBase = pedido;
            // Una recarga vieja pudo haber pisado la pantalla mientras tanto.
            pintar(deseado);
          } else {
            deseado = enBase;
            pintar(enBase);
            alFallar();
          }
        } finally {
          enVuelo--;
        }
      });
      return fila;
    },
  };
}
