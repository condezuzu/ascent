// ---------------------------------------------------------------
// EL VOCABULARIO: las palabras que la base acepta
// ---------------------------------------------------------------
//
// Cada una de estas listas es la copia en el cliente de un `check (... in
// (...))` del schema. Están acá, en un solo lugar y como VALORES —no solo como
// tipos—, por dos razones:
//
//   1. Los tipos se derivan de las listas, así que no pueden separarse entre
//      sí. Antes cada union estaba escrita a mano en su lugar.
//   2. Una lista de valores se puede comparar contra la base en un test. Los
//      tipos se borran al compilar y no se pueden comprobar contra nada.
//
// La sección 33 de `test:db` le PREGUNTA a Postgres qué acepta cada check y lo
// compara contra esto. Es la única forma de que no vuelva a pasar lo de 'M'
// contra 'm': el cliente filtraba por una letra que la base nunca guardó, la
// sección entera no se dibujaba, y no había error ni test en rojo que lo
// dijera. Ver spec/trampas.md.
//
// Si agregás un `check (... in (...))` nuevo al schema, agregalo también acá y
// a la lista de la sección 33.

/** `profiles.sexo` y nada más. El `null` NO está en el check: es la columna. */
export const SEXOS = ['m', 'f'] as const;

/** `profiles.visibilidad_default` y `photos.visibilidad`, el mismo par. */
export const VISIBILIDADES = ['privada', 'amigos'] as const;

/** `profiles.unidad_peso`. El peso SIEMPRE se guarda en kilos; esto es cómo se muestra. */
export const UNIDADES_PESO = ['kg', 'lb'] as const;

/** `friendships.estado`. */
export const ESTADOS_AMISTAD = ['pendiente', 'aceptada'] as const;

/** `challenges.estado`. */
export const ESTADOS_RETO = ['pendiente', 'activo', 'terminado', 'rechazado'] as const;

/** `sesiones.estado`. */
export const ESTADOS_SESION = ['corriendo', 'terminada', 'abandonada'] as const;

/** `feedback.tipo`. */
export const TIPOS_FEEDBACK = ['bug', 'idea'] as const;

/** Los tres del DOTS, que son filas de `ejercicios` con `cuenta_dots`. */
export const EJERCICIOS_DOTS = ['sentadilla', 'press_banca', 'peso_muerto'] as const;

export type Visibilidad = (typeof VISIBILIDADES)[number];
export type UnidadPeso = (typeof UNIDADES_PESO)[number];
export type EstadoAmistad = (typeof ESTADOS_AMISTAD)[number];
export type EstadoReto = (typeof ESTADOS_RETO)[number];
export type EstadoSesion = (typeof ESTADOS_SESION)[number];
export type TipoFeedback = (typeof TIPOS_FEEDBACK)[number];

// null = sin cargar, y eso significa SIN DOTS (§16.7). No es un valor por
// defecto: no hay coeficientes neutros que sirvan.
export type Sexo = (typeof SEXOS)[number] | null;

export type Perfil = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  racha_actual: number;
  mejor_racha: number;
  rango_actual: number;
  racha_base: number;
  perdida_fecha: string | null;
  dias_descanso: number[];
  visibilidad_default: Visibilidad;
  unidad_peso: UnidadPeso;
  sexo: Sexo;
  // segundos; lo único del descanso entre series que vive en la base (§18.3)
  duracion_descanso: number;
  // el día que la guarda de las 20 horas dejó esperando; entra solo (§12b)
  dia_pendiente: string | null;
};

export type Log = {
  id: string;
  user_id: string;
  fecha: string;
  es_descanso: boolean;
  planeta_del_dia: string | null;
};

export type Foto = {
  id: string;
  user_id: string;
  log_id: string | null;
  storage_path: string;
  visibilidad: Visibilidad;
  es_subida_de_rango: boolean;
};

export type Peso = {
  id: string;
  fecha: string;
  valor: number;
};

export type Amistad = {
  id: string;
  solicitante: string;
  destinatario: string;
  estado: EstadoAmistad;
};

export type Reto = {
  id: string;
  retador: string;
  rival: string;
  desde: string;
  hasta: string;
  estado: EstadoReto;
  ganador: string | null;
};

export type UsuarioPublico = {
  id: string;
  username: string;
  avatar_url: string | null;
  racha_actual: number;
  rango_actual: number;
};

export type Ejercicio = {
  id: string;
  nombre: string;
  grupo: string;
  cuenta_dots: boolean;
  orden: number;
};

// Una marca cargada, tal como la escribió el usuario. El 1RM no se guarda:
// se deriva de peso + reps + es_real (§16.4).
export type PR = {
  id: string;
  ejercicio: string;
  peso: number;
  reps: number;
  es_real: boolean;
  fecha: string;
};

// La mejor marca de un ejercicio, ya con el 1RM resuelto por la base.
export type Marca = {
  ejercicio: string;
  nombre: string;
  grupo: string;
  cuenta_dots: boolean;
  kg: number;
  peso: number;
  reps: number;
  es_real: boolean;
  fecha: string;
};

export type MiFuerza = {
  marcas: Marca[];
  total: number | null;
  dots: number | null;
  banda: string | null;
  // por qué NO hay DOTS, para poder decir qué falta en vez de mostrar un cero
  falta: 'marcas' | 'sexo' | 'peso' | null;
};

// Fila del ranking entre amigos. El DOTS exacto viene SOLO en la fila propia
// (§16.7b): con el total a la vista, publicarlo permitiría despejar el peso
// corporal de cualquiera.
export type FilaFuerza = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  total: number | null;
  banda: string | null;
  dots_propio: number | null;
  marcas: { ejercicio: string; nombre: string; kg: number; fecha: string }[];
};

export type ResultadoRegistro = {
  log_id: string;
  racha: number;
  rango_antes: number;
  rango_despues: number;
  planeta: string | null;
  subio_rango: boolean;
};
