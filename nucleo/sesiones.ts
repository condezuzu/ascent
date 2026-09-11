import { TOPE_SESION_SEGUNDOS } from './reglas.ts';
import { T } from './textos.ts';

export type SesionViva = {
  corriendo: boolean;
  id?: string;
  inicio?: string;
  ahora: string;
  tope_segundos?: number;
};

export type ResumenSesiones = {
  validas: number;
  total_segundos: number;
  promedio_segundos: number | null;
  abandonadas: number;
  cortas: number;
};

/**
 * Cuánto va corriendo la sesión, SIEMPRE calculado desde el inicio guardado.
 *
 * Nunca se acumulan ticks (§17.5): una PWA suspende `setInterval` cuando se
 * apaga la pantalla, y un contador que suma ticks se queda congelado ahí. Con
 * esta cuenta, perder diez minutos de ticks no importa: la próxima pintada ya
 * muestra el número correcto.
 *
 * `desfasaje` corrige el reloj del teléfono contra el del servidor. Solo
 * afecta lo que se ve: la duración que se guarda la calcula el servidor.
 */
export function transcurrido(inicio: string, desfasaje: number): number {
  return Math.max(0, Math.floor((Date.now() - desfasaje - Date.parse(inicio)) / 1000));
}

/**
 * Diferencia entre el reloj del teléfono y el del servidor, en milisegundos.
 * Se saca una sola vez, cuando el RPC devuelve su propio `ahora`.
 */
export function desfasajeDelReloj(ahoraDelServidor: string): number {
  return Date.now() - Date.parse(ahoraDelServidor);
}

/** Cuánto falta para que se cierre sola. Negativo si ya se pasó. */
export function faltaParaElTope(segundos: number): number {
  return TOPE_SESION_SEGUNDOS - segundos;
}

/** El cronómetro corriendo: "1:24:07". Los segundos son la prueba de que anda. */
export function cronoLindo(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  const dosCifras = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${dosCifras(m)}:${dosCifras(s)}` : `${m}:${dosCifras(s)}`;
}

/**
 * Una duración ya guardada: "1 h 24 min". Sin segundos — a nadie le importan
 * los segundos de un entrenamiento de la semana pasada.
 */
export function duracionLinda(segundos: number): string {
  const total = Math.round(segundos / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return T.fechas.minutos(m);
  if (m === 0) return T.fechas.horas(h);
  return T.fechas.horasYMinutos(h, m);
}

/**
 * Lo que el teléfono guarda de la sesión en curso. `bloques` es OPACO acá: el
 * núcleo no necesita conocer su forma para saber que hay que conservarlo.
 */
export type CacheDeSesion = {
  inicio: string;
  desfasaje: number;
  porUbicacion?: boolean;
  series?: number;
  id?: string | null;
  bloques?: unknown;
};

export type QueHacerConLaCache =
  | { accion: 'mantener' }
  | { accion: 'borrar' }
  | { accion: 'guardar'; cache: CacheDeSesion };

/**
 * QUÉ QUEDA GUARDADO CUANDO VUELVE `mi_sesion`.
 *
 * Acá vivían los dos bugs del contador de series, y son distintos aunque se
 * veían parecido.
 *
 * UNO: "si mando la app al fondo, se resetean". El `mi_sesion` de vuelta
 * REESCRIBÍA la caché entera con lo que dice el servidor —inicio, desfasaje,
 * origen, series, id— y `bloques` no está en esa lista porque el servidor no
 * lo manda así. Cada confirmación borraba los bloques de la caché sin tocar lo
 * que había en pantalla, así que no se notaba nada... hasta la próxima vez que
 * la pantalla se montaba, que leía la caché y encontraba el bloque vacío. Y
 * peor: hay DOS instancias del hook —la pantalla y el vigilante del
 * gimnasio—, o sea que pasaba dos veces por carga.
 *
 * DOS: "a veces se resetean solas". `const { data } = await rpc(...)` tiraba
 * el error, y sin error un fallo de red se ve EXACTAMENTE igual que "no hay
 * sesión": `data` en null. En un subsuelo con mala señal —o sea, en el
 * gimnasio— eso borraba la sesión entera. La pregunta que no se pudo hacer no
 * es una respuesta.
 *
 * LA REGLA: solo se borra lo que el servidor dijo que no está, y solo se pisa
 * lo que el servidor sabe. Lo que vive únicamente en el teléfono se conserva
 * mientras sea de la MISMA sesión.
 */
export function cacheTrasConfirmar(
  previo: CacheDeSesion | null,
  delServidor: CacheDeSesion | null,
  huboError: boolean
): QueHacerConLaCache {
  // No se pudo preguntar: no se toca nada. Es la diferencia entre "no hay
  // sesión" y "no sé si hay sesión".
  if (huboError) return { accion: 'mantener' };
  if (!delServidor) return { accion: 'borrar' };
  // Los bloques son del teléfono y de ESTA sesión. Si el id cambió, la sesión
  // es otra y arrastrarlos sería mostrar las series de la de ayer.
  const mismaSesion =
    previo != null && previo.id != null && delServidor.id != null && previo.id === delServidor.id;
  return {
    accion: 'guardar',
    cache: mismaSesion && previo.bloques !== undefined
      ? { ...delServidor, bloques: previo.bloques }
      : delServidor,
  };
}
