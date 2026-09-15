import { supabase } from '../supabase';

/**
 * `@cliente` DEL LADO NATIVO.
 *
 * Lo compartido (`compartido/`: la sesión, la cola, el descanso) pide el
 * cliente de Supabase con `crearCliente()`, que es el nombre de la web. Acá hay
 * uno solo, creado una vez con la sesión en AsyncStorage, así que "crear"
 * devuelve siempre ese mismo: dos clientes serían dos sesiones que se renuevan
 * cada una por su lado.
 */
export function crearCliente() {
  return supabase;
}

/** El cliente de ESTA app, para lo compartido (`compartido/`). */
export type Cliente = ReturnType<typeof crearCliente>;
