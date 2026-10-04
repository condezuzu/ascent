import { DESDE_RANGO, numeroDeRango, planetaDeDia } from './reglas.ts';

// Escalera de rangos. El nombre NUNCA aparece en la interfaz corriente:
// solo en la subida de rango y en Estadísticas ("Rangos").
//
// El NÚMERO de rango, los UMBRALES (`DESDE_RANGO`) y los planetas viven en
// `reglas.ts`, que es lo que también está escrito en SQL. Acá quedan los
// nombres, que son solo del cliente: la base nunca los conoce.
export { PLANETAS, numeroDeRango, planetaDeDia } from './reglas.ts';
export type Rango = {
  n: number;
  nombre: string;
  desde: number; // día de racha en que arranca
};

// SIETE rangos, de duración creciente (5/10/15/20/25/30 días, y el último sin
// techo). El viejo "Sistema" se sacó. Los `desde` salen de `DESDE_RANGO` para
// que no puedan contradecir a `numeroDeRango` ni a la base.
const NOMBRES = ['Polvo', 'Asteroide', 'Luna', 'Planeta', 'Sol', 'Galaxia', 'Agujero negro'];
export const RANGOS: Rango[] = NOMBRES.map((nombre, i) => ({ n: i + 1, nombre, desde: DESDE_RANGO[i] }));

// El rango sale del número, no de recorrer la tabla buscando el `desde`: así
// hay UNA sola regla en el cliente. Lo que guarda la base (`rango_actual`) no
// se lee para dibujar: ver `cuerpoDe`, más abajo.
export function rangoDeRacha(racha: number): Rango {
  return RANGOS[numeroDeRango(racha) - 1];
}

export function siguienteRango(racha: number): Rango | null {
  const actual = rangoDeRacha(racha);
  return RANGOS.find((r) => r.n === actual.n + 1) ?? null;
}

// Progreso 0..1 dentro del rango actual
export function progresoEnRango(racha: number): number {
  const actual = rangoDeRacha(racha);
  const prox = siguienteRango(racha);
  if (!prox) return 1;
  // Acotado por los dos lados: una racha negativa o vacía daba una barra de
  // ancho negativo o NaN.
  const p = (racha - actual.desde) / (prox.desde - actual.desde);
  return Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0;
}

/**
 * EL RANGO QUE SE VE SALE DE LA RACHA, Y DE NINGÚN OTRO LADO (4/10).
 *
 * EL BUG: con racha 43, Stats decía "Planeta" y el fondo dibujaba el Sol. El
 * nombre lo calculaba el cliente con la racha; el fondo, la insignia, los
 * colores y la subida de rango salían de `profiles.rango_actual`, el número que
 * guarda la base con SU tabla. Mientras las dos tablas eran la misma no se
 * notaba. Cuando el cliente cambió la suya y la migración de la base quedó sin
 * aplicar, la app se contradecía sola 100 de cada 131 días, y de racha 70 para
 * arriba la base mandaba un rango 8 que acá ya no existe: cielo vacío, colores
 * de Polvo y sin insignia.
 *
 * LA REGLA: ninguna pantalla lee `rango_actual`. El rango de alguien —propio o
 * ajeno— es `numeroDeRango(su racha)` y el planeta `planetaDeDia(su racha)`.
 * Son el mismo dato mirado dos veces, así que no pueden contradecirse, esté la
 * base en la migración que esté. `test:db` falla si una pantalla vuelve a leer
 * la columna (sección 176).
 */
export function cuerpoDe(racha: number | null | undefined): { rango: number; planeta: string | null } {
  const r = racha ?? 0;
  return { rango: numeroDeRango(r), planeta: planetaDeDia(r) };
}

/**
 * ¿Hay una subida de rango que celebrar? Se compara el rango que se VEÍA —la
 * racha que tenía la pantalla— con el de la racha que devolvió la base al
 * registrar. Antes lo decidía la base (`subio_rango`) con su tabla: con la
 * migración 54 sin aplicar celebraba "Sol" el día 40 y no decía nada el 31.
 *
 * Contra lo que se veía y no contra el día anterior: quien pierde 10 y al
 * registrar vuelve a cruzar el umbral del rango que ya tenía no subió nada.
 * Sin racha vista —el día entró con la pantalla sin cargar— se compara con el
 * día anterior, que es lo que el registro acaba de sumar.
 */
export function subidaDeRango(
  rachaVista: number | null | undefined,
  rachaNueva: number
): { antes: number; despues: number } | null {
  if (!Number.isFinite(rachaNueva)) return null;
  const antes = numeroDeRango(rachaVista ?? rachaNueva - 1);
  const despues = numeroDeRango(rachaNueva);
  return despues > antes ? { antes, despues } : null;
}
