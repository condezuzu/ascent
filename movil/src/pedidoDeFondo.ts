import { createContext } from 'react';
import type { OpcionesFondo } from '@compartido/motor/escena';

/**
 * QUÉ FONDO PIDE LA PANTALLA ACTIVA.
 *
 * En la app nativa el motor no vive en Inicio: vive en la raíz (`FondoRaiz`),
 * con un solo contexto de GL para toda la sesión. Las pantallas solo PIDEN:
 * "quiero este cuerpo, con estas opciones".
 *
 * POR QUÉ. Con el motor adentro de Inicio, cada vuelta a Inicio creaba un
 * `GLView` nuevo, con un contexto nuevo, y compilaba todos los shaders otra
 * vez: medido, 6 shaders y 3 programas por vuelta. Inicio es la pantalla que
 * más se abre.
 *
 * ─────────────────────────────────────────────────────────────────────
 * ES UNA PILA, Y NO UN SOLO CASILLERO (24/9)
 *
 * Antes había una sola variable: pedir la pisaba y soltar la vaciaba. Eso
 * alcanzaba cuando las pestañas montaban solo la activa, y dejó de alcanzar el
 * 23/9, cuando se arregló el titileo dejándolas TODAS montadas. Dos bugs
 * salieron de ahí, y el humano encontró los dos:
 *
 *   - VOLVER DEL PERFIL DEJABA EL ESPACIO SIN EL CUERPO. El perfil pedía su
 *     fondo encima del de Inicio; al cerrarse, soltaba y vaciaba el casillero.
 *     Inicio seguía montado, su efecto no se volvía a correr, y nadie pedía
 *     nada: quedaba la escena en pausa.
 *   - Y VOLVER A INICIO DESDE OTRA PESTAÑA, lo mismo con otra cara: Ranking,
 *     Álbum, Stats y Ajustes piden `soloEstrellas`, o sea cielo SIN cuerpo. El
 *     último que hubiera pedido ganaba para siempre.
 *
 * Con una pila, soltar no vacía: DESTAPA lo que había debajo. Que es lo que
 * hace una pantalla apilada cuando se cierra.
 *
 * PEDIR DE NUEVO CON EL MISMO `id` ACTUALIZA EN EL LUGAR, no sube a la cima:
 * que Inicio cambie de planeta mientras mirás tu perfil no tiene por qué
 * robarle el fondo al perfil.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Y SOLO PIDE LA QUE SE VE (`ContextoVisible`)
 *
 * La pila sola no alcanzaba: con las cinco pestañas montadas, las cinco
 * pedían. Cada carril de `Pestanas` envuelve a su pantalla diciéndole si está
 * a la vista, y `FondoEspacial` suelta su pedido mientras no lo esté. Así la
 * pila tiene, como mucho, la pestaña visible y lo que haya apilado encima.
 *
 * `null` = nadie pide fondo: la raíz guarda la escena en pausa.
 */
export type Pedido = OpcionesFondo & {
  atmosfera?: boolean;
  /** Cuánto tapa el velo. Sin esto lo decide el rango, como en la web. */
  velo?: number;
  /**
   * EL CUERPO ES DE OTRA PERSONA: no le pongas mi estado encima.
   *
   * Lo usa el perfil de un amigo, que es la única pantalla que dibuja un
   * cuerpo que no es el tuyo. Sin esto, tu día de descanso apagaría su
   * planeta. Ver `ponerEstadoDelCuerpo`.
   */
  ajeno?: boolean;
};

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA CONDICIÓN DEL CUERPO ES DE LA PERSONA, NO DE LA PANTALLA (26/9)
 *
 * QUÉ SE ROMPÍA. Inicio pedía el fondo con cinco banderas —día de descanso,
 * racha perdida, cuenta vacía, presagio, y el fantasma del récord— y las otras
 * SEIS pantallas pedían el mismo cuerpo sin ninguna. Esas banderas son parte
 * de la identidad de la escena (`claveDeEscena`), así que en cualquier día en
 * que alguna fuera cierta, salir de Inicio hacia CUALQUIER pestaña armaba la
 * escena de nuevo: seis shaders y tres programas recompilados, a mitad del
 * deslizamiento.
 *
 * Y es el peor tipo de tirón que hay: solo aparece algunos días —los de
 * descanso, los de racha recién perdida—, así que mirando la app un martes
 * cualquiera no está.
 *
 * POR QUÉ NO SE ARREGLA PASÁNDOSELAS A CADA PANTALLA. Porque ya se intentó
 * eso, implícitamente, y así quedó: siete lugares que tienen que decir lo
 * mismo, y ninguno se entera si otro cambia. La bandera correcta la conoce
 * una sola pantalla —Inicio, que es la que tiene los logs y los descansos— y
 * el resto no tiene por qué recalcularla.
 *
 * ASÍ QUE VIVE ACÁ, UNA VEZ, y se le pone encima a lo que pida cualquiera.
 * Lo que la pantalla sí elige —el velo, la esquina— no se toca: eso sí es
 * suyo, y además no entra en la clave de la escena.
 */
export type EstadoDelCuerpo = Pick<
  Pedido,
  'apagado' | 'vacio' | 'reposo' | 'presagio' | 'fantasma'
>;

let cuerpo: EstadoDelCuerpo = {};

type Entrada = { id: string; pedido: Pedido };

let pila: Entrada[] = [];
const oyentes = new Set<(p: Pedido | null) => void>();

/** El de más arriba: la pantalla más nueva de las que están pidiendo. */
function arriba(): Pedido | null {
  if (!pila.length) return null;
  const p = pila[pila.length - 1].pedido;
  // EL PEDIDO GANA sobre el estado: Inicio manda las cinco banderas a mano y
  // tiene que poder decir `reposo: false` un día de descanso si alguna vez
  // hiciera falta. Lo que hereda es lo que NO nombró.
  return p.ajeno ? p : { ...cuerpo, ...p };
}

/** Las cinco. Están acá para que agregar una sexta sea un solo lugar. */
const BANDERAS = ['apagado', 'vacio', 'reposo', 'presagio', 'fantasma'] as const;

/**
 * QUIEN LAS NOMBRA, LAS FIJA.
 *
 * Es la regla entera, y es así y no una función aparte que Inicio llame a
 * propósito por una razón concreta: esas cinco se calculan DESPUÉS de los
 * primeros `return` de Inicio —hacen falta los logs y los descansos—, o sea
 * después de todos sus hooks. Un efecto no puede vivir ahí, y llamarlo
 * mientras se dibuja le cambiaría el estado a otro componente en pleno render,
 * que es exactamente lo que React canta con "Cannot update a component while
 * rendering a different component".
 *
 * Así que la señal es el pedido mismo: la pantalla que NOMBRA una bandera está
 * diciendo que la conoce. Hoy es Inicio y nadie más, y un chequeo de `test:db`
 * lo sostiene.
 */
function anotarElEstado(p: Pedido) {
  if (p.ajeno) return false;
  if (!BANDERAS.some((b) => b in p)) return false;
  const nuevo: EstadoDelCuerpo = {
    apagado: p.apagado,
    vacio: p.vacio,
    reposo: p.reposo,
    presagio: p.presagio,
    fantasma: p.fantasma,
  };
  // SIN ESTE CORTE SERÍA UN AVISO POR CARGA: Inicio vuelve a pedir el fondo
  // cada vez que recarga —y recarga al volver a la pestaña, al registrar el
  // día, al terminar una sesión—, y avisar de más redibuja la raíz del fondo
  // para dejar todo igual.
  const igual =
    nuevo.apagado === cuerpo.apagado &&
    nuevo.vacio === cuerpo.vacio &&
    nuevo.reposo === cuerpo.reposo &&
    nuevo.presagio === cuerpo.presagio &&
    nuevo.fantasma?.rango === cuerpo.fantasma?.rango &&
    nuevo.fantasma?.planeta === cuerpo.fantasma?.planeta;
  cuerpo = nuevo;
  return !igual;
}

function avisar() {
  const p = arriba();
  for (const fn of [...oyentes]) fn(p);
}

export function pedirFondo(id: string, p: Pedido) {
  anotarElEstado(p);
  const i = pila.findIndex((e) => e.id === id);
  // En el lugar si ya estaba: ver "pedir de nuevo con el mismo id", arriba.
  if (i >= 0) pila[i] = { id, pedido: p };
  else pila.push({ id, pedido: p });
  avisar();
}

export function soltarFondo(id: string) {
  const antes = pila.length;
  pila = pila.filter((e) => e.id !== id);
  if (pila.length !== antes) avisar();
}

/** Avisa con el pedido actual apenas se suscribe, y después en cada cambio. */
export function escucharFondo(fn: (p: Pedido | null) => void): () => void {
  oyentes.add(fn);
  fn(arriba());
  return () => {
    oyentes.delete(fn);
  };
}

/**
 * SI LA PANTALLA QUE PIDE ESTÁ A LA VISTA.
 *
 * Por omisión `true`: una pantalla que nadie envuelve —el perfil apilado, una
 * hoja— está a la vista por definición. Lo pone `Pestanas`, que es el único
 * lugar donde hay pantallas montadas y escondidas al mismo tiempo.
 */
export const ContextoVisible = createContext(true);
