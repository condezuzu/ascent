// Los huecos que la web llena como puede y la versión nativa llena de verdad.
//
// Nada del resto de la app toca `navigator`, `localStorage` ni ninguna API del
// navegador: le pide las cosas a `plataforma`. Al pasar a Expo se agrega
// `nativo/` y se cambia una línea en `index.ts`; ningún componente se entera.
//
// Ver spec/etapa-nativa.md.

/**
 * Guardar cosas chicas en el propio teléfono.
 *
 * **La API es asíncrona aunque en web sea sincrónica por debajo.** En Expo no
 * hay `localStorage`: hay AsyncStorage, y es asíncrono. Si el contrato fuera
 * sincrónico ahora, al migrar cambiarían las firmas de todo lo que lo usa y de
 * todos sus llamadores — el refactor más grande de la migración, hecho justo
 * cuando además hay que pelear con el resto de Expo.
 *
 * No cuesta nada hacerlo ya: se comprobó uno por uno que **todos** los sitios
 * que leen están adentro de un efecto o de un handler async, así que esperar
 * un tick no agrega ningún parpadeo.
 *
 * Ninguna implementación tira: si el almacenamiento está lleno, deshabilitado
 * o con basura de otra versión, `leer` devuelve `null` y `guardar` no hace
 * nada. Todo lo que se guarda acá es una conveniencia, nunca la fuente de la
 * verdad — esa es la base.
 */
export type Almacenamiento = {
  leer(clave: string): Promise<string | null>;
  guardar(clave: string, valor: string): Promise<void>;
  borrar(clave: string): Promise<void>;
};

export type Plataforma = {
  /** Sobrevive a cerrar la app. En web, `localStorage`. */
  almacenamiento: Almacenamiento;
  /**
   * MUERE al cerrar la app. En web es `sessionStorage`, que además sobrevive a
   * recargar la pestaña; en nativo no hay equivalente y va un mapa en memoria,
   * que muere igual porque ahí no existe el recargar.
   *
   * Es la misma interfaz con OTRA vida útil, y la diferencia importa: acá va
   * la duración de descanso elegida con un preset, que vale para lo que queda
   * de esta sesión y mañana tiene que arrancar de nuevo en el predeterminado
   * (§18.5). Guardarla en el persistente sería recordar para siempre los 90
   * segundos de los accesorios de ayer.
   */
  efimero: Almacenamiento;
};
