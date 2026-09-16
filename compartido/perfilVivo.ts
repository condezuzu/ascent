import type { Cliente } from '@cliente';
import type { Perfil } from '@nucleo/tipos';

/**
 * EL MISMO PERFIL PEDIDO DOS VECES AL MISMO TIEMPO.
 *
 * EL PROBLEMA. Al abrir Inicio salían DOS consultas a `profiles` para la misma
 * fila: una de la pantalla y otra de `VigilanteDeGimnasio`, que vive en el
 * armazón y por lo tanto monta en todas las pantallas. Ninguno de los dos
 * sabía del otro, y no tenían por qué saber. Lo mismo pasa en Stats, en Yo, en
 * Fuerza y en el Álbum.
 *
 * En la nativa NO pasa: `Pestanas` pide el perfil recién al entrar en
 * Ajustes, que es justamente para no chocar con Inicio. Lo que sí le sobra
 * a la nativa es otra cosa —`verificar_perdida` esperado ANTES de leer el
 * perfil, dos idas y vueltas en fila— y eso lo arregla el RPC del paso B.
 *
 * Con wifi eso es un pedido de más y no se nota. Con datos móviles es una ida
 * y vuelta entera —entre 250 y 400 ms— pagada dos veces por el mismo dato, y
 * es la clase de cosa que hace que la app se sienta lenta en el teléfono de
 * otro y rápida en el propio.
 *
 * QUÉ HACE ESTO, Y QUÉ NO HACE. Comparte el pedido QUE YA ESTÁ EN VUELO. Si
 * dos partes preguntan mientras la consulta viaja, las dos esperan la misma
 * respuesta. Apenas esa respuesta llega, la promesa se olvida.
 *
 * NO ES UNA CACHÉ, y la diferencia importa. Una caché con vencimiento —"vale
 * cuatro segundos"— habría que invalidarla en cada escritura que toca el
 * perfil: registrar el día, cerrar la sesión, devolver impulsos, cambiar el
 * nombre, el avatar, el punto del gimnasio. El día que se olvidara una de
 * esas, la pantalla mostraría una racha vieja sin ningún síntoma. Ese es
 * exactamente el tipo de bug que más caro sale acá.
 *
 * Compartiendo solo lo que está en vuelo no hay nada que invalidar: la
 * respuesta que recibe cada quien es la misma que habría recibido pidiéndola
 * por su cuenta, con la misma frescura. La única diferencia es cuántas veces
 * se pidió.
 *
 * POR QUÉ HAY QUE PEDIRLO EXPLÍCITO. Quien recarga DESPUÉS de escribir —Inicio
 * tras registrar un día— no puede compartir: si justo hay un pedido en vuelo
 * que salió ANTES de la escritura, adoptarlo es leer el perfil viejo. Por eso
 * `perfilVivo` es para el arranque y `perfilFresco` para todo lo demás, y no
 * hay un valor por omisión que decida por vos.
 */

let enVuelo: { uid: string; promesa: Promise<Perfil | null> } | null = null;

function pedir(supabase: Cliente, uid: string): { uid: string; promesa: Promise<Perfil | null> } {
  const mio: { uid: string; promesa: Promise<Perfil | null> } = { uid, promesa: null as never };
  mio.promesa = (async () => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      return (data ?? null) as Perfil | null;
    } catch {
      // Un error se contesta con null, igual que antes: quien llama ya
      // distingue "no vino el perfil" y dibuja su pantalla de reintento. Lo
      // que NO se hace es recordar el error, porque el próximo que pregunte
      // tiene derecho a que se vuelva a intentar.
      return null;
    } finally {
      // Se olvida apenas termina, haya ido bien o mal. Si mientras tanto
      // alguien pidió uno fresco, `enVuelo` ya es otro y este no lo pisa.
      if (enVuelo === mio) enVuelo = null;
    }
  })();
  return mio;
}

/**
 * El perfil del arranque. Si ya hay uno viajando para esta misma cuenta, se
 * espera ese en vez de pedir otro.
 */
export function perfilVivo(supabase: Cliente, uid: string): Promise<Perfil | null> {
  // El `uid` se compara a propósito: al cambiar de cuenta, el pedido que
  // quedó en vuelo es del dueño anterior y servirlo sería mostrarle a alguien
  // la racha de otro.
  if (enVuelo && enVuelo.uid === uid) return enVuelo.promesa;
  enVuelo = pedir(supabase, uid);
  return enVuelo.promesa;
}

/**
 * El perfil recién leído, sin compartir nada. Es lo que hay que usar después
 * de cualquier escritura que pueda haberlo cambiado.
 */
export function perfilFresco(supabase: Cliente, uid: string): Promise<Perfil | null> {
  enVuelo = null;
  enVuelo = pedir(supabase, uid);
  return enVuelo.promesa;
}

/** Al cerrar sesión: lo que esté viajando es de la cuenta que se está yendo. */
export function olvidarPerfilVivo() {
  enVuelo = null;
}
