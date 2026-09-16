import type { NivelDeEquipo } from '@/lib/bienvenida';

/**
 * QUÉ TAN BUENO ES ESTE APARATO. Se mide una vez por sesión y de ahí sale
 * cuánto se le puede pedir: partículas, densidad de píxeles, estrellas.
 *
 * VIVE ACÁ Y NO EN EL MOTOR (16/9) porque la pantalla de entrada lo necesita
 * ANTES de cargar three.js —justamente para decidir cuánto va a dibujar—, y
 * pedirlo desde `motor/escena.ts` arrastraría la biblioteca entera a la
 * primera pantalla, que es lo único que no puede pasar ahí.
 *
 * Es una estimación y no un veredicto: `hardwareConcurrency` y `deviceMemory`
 * son lo único que el navegador cuenta, y `deviceMemory` no existe en iOS. Por
 * eso ante la duda se asume equipo del medio y no equipo malo: castigar por
 * falta de dato deja sin fondo a un teléfono bueno.
 */
let cache: NivelDeEquipo | null = null;

export function nivelEquipo(): NivelDeEquipo {
  if (cache) return cache;
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return 'medio';
  const nucleos = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  const pantallaChica = Math.min(window.innerWidth, window.innerHeight) < 400;
  if (nucleos <= 4 || mem <= 2) cache = 'bajo';
  else if (nucleos <= 8 || mem <= 4 || pantallaChica) cache = 'medio';
  else cache = 'alto';
  return cache;
}
