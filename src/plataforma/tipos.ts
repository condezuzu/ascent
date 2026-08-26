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

export type PuntoMedido = { lat: number; lon: number; precision: number };

/**
 * Dónde está el teléfono (§13).
 *
 * La diferencia entre web y nativo no es de precisión sino de QUIÉN pregunta:
 * en web la app tiene que estar abierta para mirar, en nativo se registra una
 * zona en el sistema operativo y es el teléfono el que despierta a la app al
 * entrar. Por eso `vigilarLlegada` devuelve `false` en web en vez de tirar:
 * quien llama decide sin tener que preguntar antes si se puede.
 */
export type Ubicacion = {
  disponible(): boolean;
  /** `null` si el usuario no dio permiso, no hay señal o tardó demasiado. */
  puntoActual(): Promise<PuntoMedido | null>;
  /** `true` si quedó vigilando de verdad. En web siempre `false`. */
  vigilarLlegada(centro: { lat: number; lon: number }, radio: number, alLlegar: () => void): Promise<boolean>;
  dejarDeVigilar(): Promise<void>;
};

/**
 * El aviso sonoro del descanso (§13b).
 *
 * Lo que la web NO puede es declarar la categoría de audio del sistema... o no
 * podía: Safari implementa la Audio Session API y ahí se puede pedir
 * `transient`, definido como "un ping de notificación que suena por encima de
 * la reproducción y quizá la atenúa", que es exactamente esto. En nativo se
 * declara la categoría de verdad —ambient en iOS, foco transitorio con ducking
 * en Android— y además suena con la app cerrada.
 *
 * `preparar()` va con el GESTO que abre el descanso: los navegadores no dejan
 * crear audio sin uno, y tres minutos después ya no hay gesto.
 */
export type Audio = {
  preparar(): Promise<void>;
  avisar(): Promise<void>;
  soltar(): Promise<void>;
  /** Si el aviso puede sonar sin apagar lo que ya está sonando. */
  respetaLaMusica(): boolean;
};

/**
 * Apple Health / Health Connect (§13c). En web no existe nada parecido, así
 * que el hueco queda vacío hasta la versión nativa.
 *
 * `entrenoEse` devuelve `null` para "no sé", que NO es lo mismo que `false`:
 * confundirlos haría que la app diera por no entrenado un día que sí lo fue.
 */
export type Salud = {
  disponible(): boolean;
  pedirPermiso(): Promise<boolean>;
  entrenoEse(fecha: string): Promise<boolean | null>;
};

/**
 * Avisos programados (§13b). La diferencia entre web y nativo es si llegan con
 * la app cerrada: en web es un `setTimeout` con la app adelante, en nativo una
 * notificación local que suena con la pantalla bloqueada.
 *
 * Nunca son la fuente de la verdad: el descanso se calcula siempre contra el
 * timestamp de fin guardado (§18.4) y esto es un aviso encima de eso.
 */
export type Avisos = {
  conPantallaBloqueada(): boolean;
  permiso(): Promise<boolean>;
  programar(id: string, enSegundos: number, alSonar: () => void): Promise<void>;
  cancelar(id: string): Promise<void>;
};

/** Que la pantalla no se apague sola mientras corre el descanso (§18). */
export type Pantalla = {
  disponible(): boolean;
  /** `false` si no se pudo: es una comodidad, no un requisito. */
  mantenerDespierta(): Promise<boolean>;
  soltar(): Promise<void>;
};

/** Vibración. Android sí, iPhone no: WebKit nunca implementó la API (§18.7). */
export type Haptica = {
  disponible(): boolean;
  pulso(): boolean;
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
  ubicacion: Ubicacion;
  audio: Audio;
  salud: Salud;
  avisos: Avisos;
  haptica: Haptica;
  pantalla: Pantalla;
};
