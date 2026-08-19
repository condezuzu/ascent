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
 * El NÚMERO de rango, que es lo que guarda `profiles.rango_actual`. Cada
 * rango dura diez días y en el 8 se queda. La tabla con los nombres vive en
 * `rangos.ts` y sale de acá, para que el nombre no pueda contradecir al
 * número que tiene guardado la base.
 */
export function numeroDeRango(racha: number): number {
  return Math.min(8, Math.floor(Math.max(0, racha) / 10) + 1);
}

// ---------------------------------------------------------------
// Planetas — espejo de public.planeta_de_dia(int)
// ---------------------------------------------------------------

// Rango 4: diez días exactos, un planeta por día, de menor a mayor.
// El planeta ES la barra de progreso: si ves Saturno, estás por subir.
// El orden importa: la base guarda el NOMBRE en logs.planeta_del_dia, así que
// cambiar uno de lugar reescribiría el significado de los días ya guardados.
export const PLANETAS = [
  'Ceres',
  'Plutón',
  'Mercurio',
  'Marte',
  'Venus',
  'Tierra',
  'Neptuno',
  'Urano',
  'Saturno',
  'Júpiter',
] as const;

export function planetaDeDia(racha: number): string | null {
  if (racha >= 30 && racha <= 39) return PLANETAS[racha - 30];
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
  for (const c of configs) {
    if (c.desde <= fecha) return c.dias;
  }
  return []; // antes de la primera configuración no había descansos
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
export const TOPE_SESION_SEGUNDOS = 4 * 60 * 60;

/**
 * Abajo de 5 minutos la sesión cuenta como día pero no como duración (§17.7):
 * empezar y parar sin querer es una duración real que ensucia el promedio.
 */
export const PISO_SESION_SEGUNDOS = 5 * 60;

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
