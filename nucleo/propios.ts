import { T } from './textos.ts';

/**
 * LOS EJERCICIOS PROPIOS DE OTRA PERSONA (migración 80, 15/10): no se ven. Su id
 * llega igual —en su rutina, en lo que está haciendo en vivo— y sin nombre. Se
 * dice qué es en lugar de mostrar el id o unos puntos suspensivos para siempre.
 */
export const esPropio = (id: string): boolean => id.startsWith('propio_');

/** El nombre a mostrar: el que se sabe, o "Ejercicio propio" si es un propio ajeno. */
export function nombreVisible(id: string, nombre: string | null | undefined, sinNombre: string = id): string {
  if (nombre) return nombre;
  return esPropio(id) ? T.ejercicios.propioAjeno : sinNombre;
}
