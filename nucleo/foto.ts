/**
 * CÓMO SE PREPARA UNA FOTO ANTES DE SUBIRLA, en números. Lo usan la web
 * (`src/lib/foto.ts`, con canvas) y la app nativa (`movil/src/foto.ts`, con
 * `expo-image-manipulator`): si cada una tuviera los suyos, la misma foto
 * pesaría distinto según desde dónde se subió.
 *
 * El lado largo al que se achica: una foto de progreso mirada en un teléfono
 * no necesita los 4000 px del sensor, y subir doce megas por un subsuelo con
 * mala señal es la forma más segura de que la foto no llegue nunca.
 */
import type { Visibilidad } from './tipos.ts';

/**
 * QUIÉN VE LA FOTO QUE SE ESTÁ POR SUBIR: lo que la persona tocó en ESTA hoja,
 * y si no tocó nada, lo que eligió en Ajustes. `null` es "no tocó".
 *
 * Es una función y no un `useState(porDefecto)` porque de ahí salió el bug
 * (4/10): la hoja quedaba montada, el estado se leía una sola vez y "quién la
 * ve" quedaba en lo último que se había tocado. Una foto salía compartida sin
 * que nadie lo eligiera. Sin dato de Ajustes, privada: es el lado seguro.
 */
export function fotoCompartida(tocado: boolean | null, deAjustes: Visibilidad | null | undefined): boolean {
  return tocado ?? deAjustes === 'amigos';
}

export const LADO_MAXIMO_FOTO = 1600;
export const CALIDAD_FOTO = 0.86;

/** El escalado para que el lado largo quede en `LADO_MAXIMO_FOTO`, nunca agrandar. */
export function medidasParaSubir(ancho: number, alto: number): { ancho: number; alto: number } {
  const escala = Math.min(1, LADO_MAXIMO_FOTO / Math.max(ancho, alto));
  return { ancho: Math.round(ancho * escala), alto: Math.round(alto * escala) };
}

/** Dónde queda en el storage: la carpeta del usuario es lo que mira la política. */
export function rutaDeFoto(uid: string, dia: string, ahora: number): string {
  return `${uid}/${dia}-${ahora}.jpg`;
}
