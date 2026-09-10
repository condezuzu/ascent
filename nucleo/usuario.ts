/**
 * EL NOMBRE DE USUARIO: la regla, en un solo lugar.
 *
 * Estaba escrita TRES veces —la pantalla de onboarding, la de Ajustes y el
 * `check` de la base— y ahora son dos: esta y la de la base, que no se puede
 * evitar y no debería. La base es la que no puede confiar en el cliente; esto
 * es para poder decir qué está mal ANTES de mandar, en vez de mostrar el error
 * técnico de un constraint violado.
 *
 * Que fueran tres copias no era teórico: la app nativa iba a ser la cuarta.
 *
 * LAS DOS TIENEN QUE DECIR LO MISMO, y hay un test que lo comprueba leyendo el
 * `check` de `schema.sql` y comparándolo con esta constante. Si alguien
 * cambia una sola, falla.
 */

/** Letras, números y guion bajo. De 3 a 20. Es el mismo patrón que la base. */
export const PATRON_USUARIO = '^[a-zA-Z0-9_]{3,20}$';

/**
 * `true` si el nombre sirve. Espera el nombre YA recortado: quién recorta es
 * decisión de la pantalla —el que escribió un espacio de más no cometió un
 * error, se le fue el dedo— y esta función solo juzga el resultado.
 */
export function nombreValido(nombre: string): boolean {
  return new RegExp(PATRON_USUARIO).test(nombre);
}
