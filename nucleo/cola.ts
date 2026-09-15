/**
 * QUÉ QUEDA EN LA COLA DESPUÉS DE UNA PASADA.
 *
 * EL BUG QUE HACÍA NECESARIO ESTO. Encolar esperaba a que la cola terminara de
 * mandar —con red, desde el subsuelo— antes de devolver, y cada toque del
 * gimnasio esperaba a encolar antes de mover el número. El `+` de 2,5 kg
 * tardaba lo que tardara la red. La salida es no esperar: encolar guarda y
 * vuelve, y la cola manda por detrás.
 *
 * PERO ENTONCES SE PUEDE ENCOLAR EN MEDIO DE UNA PASADA, y la pasada terminaba
 * con `guardar(lo que no entró)`: pisaba lo que se había agregado mientras
 * mandaba. Una serie tocada justo en ese medio segundo se perdía sin error.
 *
 * La regla: al terminar se vuelve a leer la cola y se sacan SOLO los pendientes
 * que esta pasada mandó (o descartó), comparados por contenido. Lo que se
 * agregó después se queda, y lo que reemplazó a uno mandado —el mismo id con
 * otro valor, "las series son 4" en vez de "son 3"— también, porque no es lo
 * que se mandó.
 *
 * NO IMPORTA NADA: se prueba con node pelado.
 */

export function quedanTrasPasada<T>(ahora: T[], sacados: T[]): T[] {
  const firma = (x: T) => JSON.stringify(x);
  const fuera = new Map<string, number>();
  for (const s of sacados) fuera.set(firma(s), (fuera.get(firma(s)) ?? 0) + 1);
  return ahora.filter((p) => {
    const f = firma(p);
    const n = fuera.get(f) ?? 0;
    if (n === 0) return true;
    fuera.set(f, n - 1);
    return false;
  });
}

/**
 * CUÁNTO ESPERAR PARA VOLVER A INTENTAR, cuando la pasada cortó por la red.
 *
 * EL BUG (15/9). Sin señal, lo encolado esperaba al próximo toque o a que la
 * app volviera al frente. Si la red volvía y no se tocaba nada —se deja el
 * teléfono en el banco—, las series se quedaban en el teléfono, y una sesión
 * sin actividad subida la cierra la base a las dos horas SIN DURACIÓN.
 *
 * Ahora la cola se reintenta sola mientras le quede algo. Rápido al principio,
 * porque en el gimnasio la señal va y viene en segundos; y cada vez más
 * espaciado, porque en un subsuelo sin señal preguntar cada cinco segundos
 * durante una hora es gastar batería para nada.
 *
 * SIN LIBRERÍA DE CONECTIVIDAD, a propósito: saber que "hay red" no garantiza
 * que la base conteste, y reintentar es la única prueba que vale en los dos.
 */
export const REINTENTO_PRIMERO_MS = 5_000;
export const REINTENTO_TOPE_MS = 60_000;

export function siguienteReintento(anterior: number | null): number {
  if (anterior === null || !Number.isFinite(anterior) || anterior < REINTENTO_PRIMERO_MS) return REINTENTO_PRIMERO_MS;
  return Math.min(REINTENTO_TOPE_MS, anterior * 2);
}
