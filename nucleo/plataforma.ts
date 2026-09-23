// EL CONTRATO DE LOS PUERTOS. Los huecos que la web llena como puede y la app
// nativa llena de verdad.
//
// VIVE EN `nucleo/` Y NO EN `src/`, y la diferencia importa desde que hay dos
// apps: `movil/` necesita el mismo contrato, y tenerlo del lado de Next
// obligaría al proyecto de Expo a importar del árbol de la web — justo la
// dependencia que la migración vino a cortar. Acá es lo que ya son las reglas
// y los textos: un archivo que las dos leen y ninguna posee.
//
// Son TIPOS y nada más: sin implementación, sin imports, sin una sola API del
// navegador nombrada. Por eso puede vivir en el núcleo.
//
// Nada del resto de la app toca `navigator`, `localStorage` ni ninguna API del
// navegador: le pide las cosas a `plataforma`. La sección 35 de `test:db` lo
// comprueba.
//
// Ver spec/etapa-nativa.md §13z.

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

export type PuntoMedido = {
  lat: number;
  lon: number;
  precision: number;
  /** Cuándo se midió de verdad, para distinguir un arreglo fresco de uno viejo. */
  medidoEn: number;
};

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
  /**
   * `null` si el usuario no dio permiso, no hay señal o tardó demasiado.
   *
   * `edadMaxima` en ms: cuánto se acepta reusar un arreglo anterior. Con 0
   * siempre mide de nuevo, que enciende la antena. Ver `estoyEnElGimnasio`,
   * que lo usa en dos pasos para no pagarla cuando no hace falta.
   */
  puntoActual(edadMaxima?: number): Promise<PuntoMedido | null>;
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
 * Apple Health / Health Connect (§13c). En web no existe nada parecido —no es
 * que la API sea peor, es que el navegador no tiene ninguna—, así que el hueco
 * queda vacío de ese lado y se llena del nativo.
 *
 * TODO DEVUELVE `null` PARA "NO SÉ", que NO es lo mismo que `false` ni que
 * `0`. Sin permiso, sin datos o con el reloj sin sincronizar la respuesta
 * honesta es que no se sabe; confundirla con "no entrenaste" o con "cero
 * pasos" haría que la app diera por vacío un día que sí ocurrió. Es la única
 * parte de este puerto que no se puede relajar.
 *
 * `fecha` es siempre YYYY-MM-DD en el huso del usuario, como todas las fechas
 * de la app (`nucleo/fechas.ts`). Nunca un `Date` ni un UTC: el día de Health
 * tiene que cortar donde corta el día de la racha, o un entrenamiento de las
 * nueve de la noche cuenta para el día siguiente.
 */
export type Salud = {
  disponible(): boolean;
  pedirPermiso(): Promise<boolean>;
  entrenoEse(fecha: string): Promise<boolean | null>;
  /** Los pasos de ese día. `null` es "no sé", nunca 0. */
  pasosDe(fecha: string): Promise<number | null>;
  /**
   * Los pasos de los últimos N días, uno por día, de más viejo a más nuevo.
   *
   * NO ES `pasosDe` EN UN BUCLE. Un gráfico de tres meses serían noventa
   * consultas a HealthKit; esto es una sola, con la suma por día hecha del
   * lado de iOS.
   *
   * LOS DÍAS SIN DATO NO VIENEN, y no vienen en 0: un día sin el teléfono
   * encima no es un día sin caminar. Quien dibuja se saltea el hueco.
   *
   * `null` es "no sé" —sin permiso, sin Health, sin plataforma—, que es
   * distinto de una lista vacía.
   */
  pasosPorDia(dias: number): Promise<{ fecha: string; valor: number }[] | null>;
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

/**
 * LA CUENTA DEL DESCANSO, VISIBLE SIN DESBLOQUEAR EL TELÉFONO (§13d).
 *
 * EL PEDIDO QUE LO ORIGINÓ, después de dos días de gimnasio: *"no se ve el
 * descanso fuera de la app"*. El aviso sonoro ya llegaba con la pantalla
 * bloqueada; lo que faltaba era ver CUÁNTO FALTA sin desbloquear nada, doce
 * veces por sesión.
 *
 * EN WEB ES IMPOSIBLE Y NO HAY QUE SEGUIR INTENTÁNDOLO. Con la pantalla
 * apagada, los temporizadores de una pestaña escondida se estrangulan y
 * después se congelan; no existe ninguna API de navegador que dibuje algo en
 * la pantalla de bloqueo. Por eso acá el puerto contesta que no y listo.
 *
 * SE LE PASA LA HORA DE FIN, NO LOS SEGUNDOS QUE FALTAN, y es la decisión que
 * sostiene todo lo demás. El sistema dibuja la cuenta atrás solo a partir de
 * esa fecha: no hay que empujar una actualización por segundo —iOS ni siquiera
 * lo permitiría— y el número no se atrasa cuando la app deja de correr. Es la
 * misma regla de §18.4: el timestamp de fin manda, y esto es una VISTA de ese
 * número, nunca la fuente.
 *
 * NADA DE ESTO TIRA NUNCA. Es un agregado encima del descanso, igual que la
 * notificación: sin permiso, con las actividades apagadas o en un teléfono
 * viejo, el descanso tiene que seguir andando idéntico.
 */
export type EnVivo = {
  disponible(): boolean;
  /** `fin` en milisegundos del reloj del teléfono; `duracion` en segundos. */
  mostrarDescanso(fin: number, duracion: number): Promise<void>;
  esconder(): Promise<void>;
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

/**
 * ¿La app está adelante, y cuándo cambia eso?
 *
 * ES EL PUERTO QUE MÁS COSAS SOSTIENE, y por eso va antes que los otros: el
 * cronómetro de sesión, el descanso entre series, el vigilante del gimnasio y
 * el de la sesión dependen los cuatro de saber cuándo la persona volvió a
 * mirar la pantalla. Sin este puerto, migrar toca las cuatro features
 * centrales a la vez.
 *
 * En web es `document.visibilityState`; en nativo es `AppState` de React
 * Native, que dice lo mismo con otras palabras ('active' / 'background').
 *
 * El aviso NO significa "cambió a visible": significa **"volvé a mirar, puede
 * haber pasado tiempo"**. Los intervalos se suspenden mientras la app está
 * atrás, así que al volver todo lo que se mide contra el reloj está viejo.
 */
export type CicloDeVida = {
  /** ¿Se está viendo AHORA? */
  visible(): boolean;
  /** Avisa cada vez que cambia. Devuelve cómo dejar de escuchar. */
  alCambiar(escuchar: (visible: boolean) => void): () => void;
};



export type Plataforma = {
  /** Sobrevive a cerrar la app. En web, `localStorage`. */
  almacenamiento: Almacenamiento;
  ciclo: CicloDeVida;
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
  enVivo: EnVivo;
  haptica: Haptica;
  pantalla: Pantalla;
};
