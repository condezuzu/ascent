// null = sin cargar, y eso significa SIN DOTS (§16.7). No es un valor por
// defecto: no hay coeficientes neutros que sirvan.
export type Sexo = 'm' | 'f' | null;

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
  visibilidad_default: 'privada' | 'amigos';
  unidad_peso: 'kg' | 'lb';
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
  visibilidad: 'privada' | 'amigos';
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
  estado: 'pendiente' | 'aceptada';
};

export type Reto = {
  id: string;
  retador: string;
  rival: string;
  desde: string;
  hasta: string;
  estado: 'pendiente' | 'activo' | 'terminado' | 'rechazado';
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
