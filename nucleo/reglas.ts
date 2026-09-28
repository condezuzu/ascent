/**
 * Las reglas que están escritas DOS VECES: acá y en `supabase/schema.sql`.
 *
 * La base es la que manda —es la que guarda el dato y la que no se puede
 * saltear—, pero el cliente necesita las mismas cuentas para pintar la
 * pantalla sin pedir un viaje de red por tecla. Mientras eso siga siendo
 * cierto, la duplicación no se puede eliminar: lo que sí se puede es que no
 * se separen en silencio.
 *
 * `npm run test:db` importa este archivo desde Node y corre las dos
 * implementaciones contra los mismos valores. Si alguna diverge, falla.
 *
 * Por eso **este archivo no importa nada**: Node lo carga tal cual, sin el
 * alias `@/` ni el resolvedor de Next. Si alguien le agrega un import, el
 * test deja de poder cargarlo y la red de seguridad se cae sin hacer ruido.
 */

// ---------------------------------------------------------------
// Rangos — espejo de public.rango_de_racha(int)
// ---------------------------------------------------------------

/**
 * LOS UMBRALES DE RANGO, EN UN SOLO LUGAR (28/9). El día DESDE el que empieza
 * cada rango. Antes cada rango duraba diez días parejos (`/10`); ahora crecen:
 *
 *   Polvo 1-5 (5) · Asteroide 6-15 (10) · Luna 16-30 (15) · Planeta 31-50 (20)
 *   · Sol 51-75 (25) · Galaxia 76-105 (30) · Agujero negro 106+.
 *
 * Son SIETE rangos: el "Sistema" (el viejo 6) se sacó. La base tiene su propia
 * copia de esta tabla en `rango_de_racha`; no se pueden compartir —una es SQL y
 * la otra corre offline en el teléfono— así que `test:db` las compara día por
 * día del 1 al 200 y falla si difieren. Este array es la fuente: el de nombres
 * (`rangos.ts`) y la base salen de acá.
 */
export const DESDE_RANGO = [0, 6, 16, 31, 51, 76, 106] as const;

/**
 * El NÚMERO de rango, que es lo que guarda `profiles.rango_actual`: el rango
 * más alto cuyo umbral ya alcanzó la racha. La tabla con los nombres vive en
 * `rangos.ts` y sale de acá, para que el nombre no pueda contradecir al número
 * que tiene guardado la base.
 */
export function numeroDeRango(racha: number): number {
  // Sin número (un perfil a medio cargar), rango 1: un NaN acá dejaba a
  // `rangoDeRacha` sin rango y a Inicio sin pantalla. En la base no pasa.
  if (!Number.isFinite(racha)) return 1;
  const r = Math.max(0, Math.floor(racha));
  let n = 1;
  for (let i = 0; i < DESDE_RANGO.length; i++) if (r >= DESDE_RANGO[i]) n = i + 1;
  return n;
}

// ---------------------------------------------------------------
// Planetas — espejo de public.planeta_de_dia(int)
// ---------------------------------------------------------------

// Rango 4 (Planeta): días 31-50, CUATRO días por planeta, de menor a mayor.
// El planeta ES la barra de progreso dentro del rango: si ves Saturno, estás
// por subir a Sol. El orden importa: la base guarda el NOMBRE en
// logs.planeta_del_dia, así que cambiar uno de lugar reescribiría el
// significado de los días ya guardados.
//   Ceres 31-34 · Mercurio 35-38 · Marte 39-42 · Venus 43-46 · Saturno 47-50.
export const PLANETAS = ['Ceres', 'Mercurio', 'Marte', 'Venus', 'Saturno'] as const;

export function planetaDeDia(racha: number): string | null {
  if (racha >= 31 && racha <= 50) return PLANETAS[Math.floor((racha - 31) / 4)];
  return null;
}

// ---------------------------------------------------------------
// Descansos — espejo de public.descansos_vigentes(uuid, date)
// ---------------------------------------------------------------

// Configuraciones de descanso fechadas. Cada una rige desde su fecha hasta
// que aparece la siguiente: el pasado se lee con la que estaba vigente
// entonces, nunca con la de hoy.
export type ConfigDescanso = { desde: string; dias: number[] };

/** Las configuraciones tienen que venir ordenadas de más nueva a más vieja. */
export function descansosVigentes(configs: ConfigDescanso[], fecha: string): number[] {
  // LA MÁS NUEVA QUE YA REGÍA, sin importar en qué orden lleguen (15/9). Antes
  // se quedaba con la PRIMERA de la lista que cumpliera, y eso solo es la más
  // nueva si la lista viene de más nueva a más vieja: una consulta sin ese
  // `order` mostraba los descansos de la configuración más vieja.
  let vigente: ConfigDescanso | null = null;
  for (const c of configs) {
    if (c.desde <= fecha && (!vigente || c.desde > vigente.desde)) vigente = c;
  }
  return vigente ? vigente.dias : []; // antes de la primera no había descansos
}

// ---------------------------------------------------------------
// Fuerza — espejo de public.un_rm(numeric, int, boolean)
// ---------------------------------------------------------------

/**
 * El 1RM de una marca. Real: el peso tal cual. Estimado: Epley.
 *
 * El caso de UNA repetición se saca a mano: Epley crudo devuelve
 * peso × 31/30, un 3% de más, porque la fórmula está pensada para extrapolar
 * desde varias repeticiones. Una repetición ya ES el 1RM, y sin este corte el
 * mismo levantamiento daba distinto según cómo lo hubieran cargado.
 */
export function unRM(peso: number, reps: number, esReal: boolean): number {
  if (esReal || reps === 1) return peso;
  return peso * (1 + reps / 30);
}

// ---------------------------------------------------------------
// Sesiones — espejo de public.tope_sesion() y public.piso_sesion()
// ---------------------------------------------------------------

/**
 * A las 4 horas la sesión se cierra sola y queda SIN duración (§17.3).
 *
 * Acá el número se usa solo para avisar en pantalla; el corte de verdad lo
 * hace el servidor contra el `inicio` guardado, porque el reloj del teléfono
 * se puede atrasar a propósito.
 */
export const TOPE_SESION_SEGUNDOS = 2 * 60 * 60;

/**
 * Media hora sin actividad y la sesión se cierra sola, fechada en la última
 * actividad (migración 37). El tope de arriba queda solo para las sesiones en
 * las que nunca se tocó nada: ahí no hay última actividad que usar.
 *
 * Media hora y no menos: como el cierre se fecha en la última actividad, la
 * ventana no cambia la duración guardada, solo cuánto se tarda en enterarse.
 */
export const VENTANA_INACTIVIDAD_SEGUNDOS = 30 * 60;

/**
 * Abajo de 5 minutos la sesión cuenta como día pero no como duración (§17.7):
 * empezar y parar sin querer es una duración real que ensucia el promedio.
 */
export const PISO_SESION_SEGUNDOS = 5 * 60;

/**
 * Cuánto hay que quedarse en el gimnasio antes de que la sesión arranque sola
 * (§13). Siete minutos: uno llega, se cambia, saluda — no empieza a entrenar
 * apenas cruza la puerta.
 *
 * Alargarlo no cuesta precisión, porque el inicio se cuenta desde la llegada y
 * no desde el disparo. Lo único que cuesta es tardar más en ver el cronómetro
 * andando. Acortarlo sí cuesta: es lo que filtra al que pasa caminando por la
 * puerta camino a otro lado.
 */
export const ESPERA_LLEGADA_MS = 7 * 60 * 1000;

// ---------------------------------------------------------------
// Descanso entre series — espejo del check de profiles.duracion_descanso
// ---------------------------------------------------------------

/** Tres minutos. Es el `default` de la columna, no un número suelto acá. */
export const DESCANSO_PREDETERMINADO = 180;

/** Los límites que acepta la columna. El campo no puede ofrecer más que esto. */
export const DESCANSO_MINIMO = 15;
export const DESCANSO_MAXIMO = 600;

/**
 * Los presets, en segundos. El descanso cambia mucho según el ejercicio —90
 * segundos para accesorios, 3 a 5 minutos para levantamientos pesados—, así
 * que elegir con un toque es la interacción principal, no un atajo (§18.5).
 *
 * Son constantes del cliente y no filas: cinco números iguales para todos.
 */
export const PRESETS_DESCANSO = [60, 90, 120, 180, 300];
