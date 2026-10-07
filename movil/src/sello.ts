/**
 * EL SELLO: con qué variables de compilación se armó ESTE JavaScript.
 *
 * PARA QUÉ. Las variables `EXPO_PUBLIC_…` se reemplazan por su valor al
 * empaquetar y desaparecen: mirando el paquete no hay forma de saber con cuáles
 * se armó. El 7/10 la OTA a `telefono` salió sin Diagnóstico aunque el guardián
 * le pasó la variable —la caché del empaquetador reusó el archivo viejo—, y con
 * la caché al revés la de `store` habría salido CON Diagnóstico. Nadie podía
 * verlo sin instalarla.
 *
 * Cada línea deja en el paquete UN texto que dice el valor. El guardián
 * (`revisarPaquete` en `supabase/huella.mjs`) busca esos textos en lo exportado,
 * los compara con lo que declara el perfil del canal en `eas.json`, y se niega a
 * subir si no coinciden.
 *
 * UNA LÍNEA POR VARIABLE Y POR VALOR que aparezca en algún perfil de `eas.json`.
 * `test:db` (sección 168) falla si se agrega una al perfil y no acá.
 *
 * CADA TEXTO TERMINA EN PUNTO Y COMA: en el paquete los textos van pegados uno atrás de
 * otro, y sin un cierre no se sabe dónde termina el valor.
 *
 * TIENE QUE SER ASÍ DE TONTO: una comparación contra un literal y dos textos
 * enteros. Armado con plantillas o con JSON el texto se construye al correr y
 * no queda escrito en el paquete.
 */
export const SELLOS: readonly string[] = [
  process.env.EXPO_PUBLIC_DIAGNOSTICO === '1' ? 'ascent-sello:EXPO_PUBLIC_DIAGNOSTICO=1;' : 'ascent-sello:EXPO_PUBLIC_DIAGNOSTICO=no;',
  process.env.EXPO_PUBLIC_MINIMO === '1' ? 'ascent-sello:EXPO_PUBLIC_MINIMO=1;' : 'ascent-sello:EXPO_PUBLIC_MINIMO=no;',
];
