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

export type ResultadoRegistro = {
  log_id: string;
  racha: number;
  rango_antes: number;
  rango_despues: number;
  planeta: string | null;
  subio_rango: boolean;
};
