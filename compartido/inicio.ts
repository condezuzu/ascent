import type { Cliente } from '@cliente';
import type { ConfigDescanso } from '@nucleo/descansos';
import type { Log, MiFuerza, Perfil } from '@nucleo/tipos';

/**
 * TODO INICIO EN UN SOLO PEDIDO (migración 43).
 *
 * LO QUE HABÍA. Abrir Inicio con la caché fría eran cuatro tandas de pedidos
 * ENCADENADAS: cada una no podía empezar hasta que volviera la anterior.
 *
 *   tanda 1  perfil, logs, verificar_perdida, descansos
 *   tanda 2  mis_impulsos, mi_fuerza, los amigos
 *   tanda 3  el último día de esos amigos
 *   tanda 4  quién es ese amigo
 *
 * Con wifi cada tanda son 40 ms y no se nota nada. Con datos móviles son entre
 * 250 y 400 ms CADA UNA, y se pagan enteras. Medido contra la base de verdad:
 * la secuencia completa tarda 1204 ms, un solo pedido 234 ms.
 *
 * LO QUE SE GANA DE VERDAD, que no es el número grande. La pantalla ya se
 * dibujaba con la tanda 1, así que esto no la hace aparecer un segundo antes.
 * Lo que cambia es que DEJA DE MOVERSE: hoy termina de acomodarse a los 1,9 s
 * —el aviso de impulso salta como un cartel un segundo tarde, la línea social
 * empuja el layout— y así llega entera. Y son cuatro despertadas de la antena
 * en vez de una, que es lo que se le come la batería a un teléfono viejo.
 *
 * POR QUÉ NO SE PREGUNTA LA VERSIÓN DEL ESQUEMA. `versionDelEsquema` es otro
 * viaje a la base; usarla para decidir si llamar a esta función sería sumar
 * una ida y vuelta para ahorrar tres. Se llama directo: si la migración no
 * corrió, PostgREST contesta PGRST202 —"esa función no existe"— y ahí sí se
 * vuelve al camino viejo. Cuesta un pedido perdido una vez, y solo mientras la
 * migración no esté.
 *
 * TRES RESPUESTAS POSIBLES, y cada una se atiende distinto:
 *
 *   'listo'        llegó todo (o casi: un pedazo puede venir en null, ver la
 *                  migración, cada sección tiene su propio `exception`).
 *   'sin-funcion'  la migración 43 no corrió todavía: camino viejo, completo.
 *   'falla'        la red o la base. NO es lo mismo que 'sin-funcion': repetir
 *                  el camino viejo acá sería hacer cuatro pedidos más que
 *                  también van a fallar. Quien llama se queda con lo que tenga.
 */

export type DatosDeInicio = {
  hoy: string;
  perfil: Perfil | null;
  logs: Log[];
  descansos: ConfigDescanso[];
  impulsos: {
    vigentes?: string[];
    ultimas?: string[];
    quedan?: number;
    total?: number;
  } | null;
  fuerza: MiFuerza | null;
  perdida: { perdida?: boolean } | null;
  social: { username: string; racha: number } | null;
};

export type RespuestaDeInicio =
  | { tipo: 'listo'; datos: DatosDeInicio }
  | { tipo: 'sin-funcion' }
  | { tipo: 'falla' };

/** PostgREST cuando la función no existe: la migración todavía no corrió. */
const NO_EXISTE = 'PGRST202';

export async function pedirInicio(supabase: Cliente): Promise<RespuestaDeInicio> {
  const { data, error } = await supabase.rpc('pantalla_inicio');
  if (error) return error.code === NO_EXISTE ? { tipo: 'sin-funcion' } : { tipo: 'falla' };
  // `null` es "no hay sesión", que acá se trata como una falla: quien llama ya
  // rebota al login si no hay sesión, y si llegamos hasta acá con una sesión
  // viva un null es algo raro, no un caso normal.
  if (!data) return { tipo: 'falla' };

  const d = data as Record<string, unknown>;
  return {
    tipo: 'listo',
    datos: {
      hoy: String(d.hoy ?? ''),
      perfil: (d.perfil ?? null) as Perfil | null,
      // Cada lista puede venir en null si su sección falló del lado de la
      // base. Un null NO es una lista vacía —"no se pudo" no es "no hay"— pero
      // acá se colapsan a vacío igual porque la pantalla no tiene forma de
      // dibujar la diferencia, y lo que importa (el perfil) viene aparte.
      logs: (Array.isArray(d.logs) ? d.logs : []) as Log[],
      descansos: (Array.isArray(d.descansos) ? d.descansos : []) as ConfigDescanso[],
      impulsos: (d.impulsos ?? null) as DatosDeInicio['impulsos'],
      fuerza: (d.fuerza ?? null) as MiFuerza | null,
      perdida: (d.perdida ?? null) as DatosDeInicio['perdida'],
      social: (d.social ?? null) as DatosDeInicio['social'],
    },
  };
}
