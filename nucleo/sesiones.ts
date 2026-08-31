import { TOPE_SESION_SEGUNDOS } from './reglas';
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
