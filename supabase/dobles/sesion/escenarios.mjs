// LOS ESCENARIOS DE LA SESIÓN, con `useSesion` de verdad (ver `ganchos.mjs`).
//
//   node --import ./ganchos.mjs escenarios.mjs bloques  <sola|vigilante|otroAparato|sinPreguntar>
//   node --import ./ganchos.mjs escenarios.mjs refresco <despues|antes|siempre> <n> <telefono|web> <solo|vigilante>
//   node --import ./ganchos.mjs escenarios.mjs releer   <n>
//
// Imprime UNA línea de JSON con lo que se vio. Quien decide si está bien es la
// sección 179 de `test-schema.mjs`. Es un sustituto del teléfono, no el teléfono:
// prueba el orden de las operaciones, no lo que se dibuja.
import { montar } from './react.mjs';
import { cambiarVisible, cfg, datos, servidas } from './plataforma.mjs';
import { servidor } from './cliente.mjs';

const { useSesion } = await import('@compartido/useSesion');

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const cache = () => JSON.parse(datos.get('ascent:sesion') ?? 'null');
const cola = () => JSON.parse(datos.get('ascent:cola') ?? '[]');
// Los bloques en chico: [ejercicio, series] de los cerrados y del que está en curso.
const corto = (b) => [...b.cerrados.map((x) => [x.ejercicio, x.series]), [b.ejercicio, b.hechas]];
const enLaBase = (s) => (s?.bloques ?? []).map((x) => [x.ejercicio, x.series]);

/** Espera a que no quede nada por subir ni por guardar. */
async function asentar() {
  for (let quieto = 0, antes = -1; quieto < 3; ) {
    await dormir(40);
    quieto = cola().length === 0 && servidas.n === antes ? quieto + 1 : 0;
    antes = servidas.n;
  }
}

async function bloquearYDesbloquear() {
  cambiarVisible(false);
  await dormir(20);
  cambiarVisible(true);
}

/**
 * LOS BLOQUES DE LA SESIÓN ANTERIOR EN LA NUEVA.
 *  - `sola`: la base cierra la sesión por inactividad; nadie toca Terminar.
 *  - `vigilante`: se termina con el botón de Inicio, y la sesión siguiente la
 *    arranca OTRA instancia del hook (el vigilante del gimnasio).
 *  - `otroAparato`: la web la termina y empieza otra, con sus propias series.
 *  - `sinPreguntar`: la base la cerró y el teléfono no se enteró —dormía en el
 *    bolsillo— cuando se arranca la siguiente.
 */
async function bloques(variante) {
  servidor.ultimoEjercicio = 'press_banca';
  const inicio = montar(() => useSesion());
  const vigilante = variante === 'vigilante' ? montar(() => useSesion()) : null;
  await asentar();

  // La sesión de ayer: press 3 x 60 y sentadilla 3 x 100.
  await inicio.r.empezar();
  await asentar();
  await inicio.r.elegirPeso(60);
  for (let i = 0; i < 3; i++) await inicio.r.serieHecha();
  await inicio.r.elegirEjercicio('sentadilla');
  await inicio.r.elegirPeso(100);
  for (let i = 0; i < 3; i++) await inicio.r.serieHecha();
  await asentar();
  const ayer = { bloques: corto(inicio.r.estado.bloques), base: enLaBase(servidor.sesiones[0]) };

  const ahora = new Date().toISOString();
  if (vigilante) {
    await inicio.r.terminar();
  } else {
    Object.assign(servidor.sesiones[0], { estado: 'terminada', cerro_sola: variante === 'sola', fin: ahora });
    if (variante === 'sola') await bloquearYDesbloquear();
  }
  await asentar();
  const alCerrar = {
    corriendo: inicio.r.estado.corriendo,
    bloques: corto(inicio.r.estado.bloques),
    delVigilante: vigilante ? corto(vigilante.r.estado.bloques) : null,
  };

  // Al otro día, en el mismo proceso: otra sesión.
  servidor.registro.length = 0;
  servidor.ultimoEjercicio = 'remo';
  if (variante === 'otroAparato') {
    servidor.sesiones.push({
      id: 'sesion-2',
      inicio: ahora,
      series: 2,
      bloques: [{ ejercicio: 'remo', series: 2 }],
      estado: 'corriendo',
      ultima_actividad: ahora,
      origen: 'manual',
      cerro_sola: false,
    });
  } else if (vigilante) {
    await vigilante.r.empezar({ origen: 'ubicacion' });
  } else {
    await inicio.r.empezar();
  }
  await asentar();
  const nueva = { total: inicio.r.estado.series, bloques: corto(inicio.r.estado.bloques) };

  // Se bloquea y se desbloquea SIN tocar el +: qué le llega a la base.
  await bloquearYDesbloquear();
  await asentar();
  const sinTocar = {
    subidos: servidor.registro.filter((x) => x.rpc === 'fijar_bloques').map((x) => [x.args.p_sesion, x.args.p_bloques.length]),
    base: enLaBase(servidor.sesiones[1]),
  };

  await inicio.r.serieHecha();
  await asentar();
  const primerMas = {
    total: inicio.r.estado.series,
    bloques: corto(inicio.r.estado.bloques),
    base: enLaBase(servidor.sesiones[1]),
    baseSeries: servidor.sesiones[1].series,
  };
  return { ayer, alCerrar, nueva, sinTocar, primerMas };
}

/**
 * UN `+` QUE CAE CERCA DE LA RESPUESTA DE `mi_sesion`. La sesión va en 5 series,
 * se bloquea y se desbloquea el teléfono, y se toca el `+` una sola vez:
 *  - `despues n`: cuando ya se atendieron `n` operaciones de almacenamiento
 *    DESPUÉS de que llegó la respuesta.
 *  - `antes n`: con la pregunta en viaje (la base ya leyó 5), y la respuesta
 *    llega `n` operaciones después del toque. `una`: llega cuando `fijar_series`
 *    ya subió y `fijar_bloques` no. `fin`: cuando el toque ya subió entero.
 *  - `siempre`: un toque con CADA respuesta que llega, para ver que una respuesta
 *    vieja se vuelve a pedir una vez y no queda preguntando en fila.
 * Después se toca el `+` otra vez: tiene que ser la serie siguiente.
 */
async function refresco(modo, nTxt, aparato, variante) {
  cfg.comoLaWeb = aparato === 'web';
  servidor.ultimoEjercicio = 'press_banca';
  const inicio = montar(() => useSesion());
  if (variante === 'vigilante') montar(() => useSesion());
  await asentar();
  await inicio.r.empezar();
  await asentar();
  for (let i = 0; i < 5; i++) await inicio.r.serieHecha();
  await asentar();
  const base = servidor.sesiones[0];
  if (base.series !== 5 || inicio.r.estado.series !== 5) throw new Error('el escenario no arrancó en 5 series');

  // LA CACHÉ NO PUEDE VOLVER ATRÁS. En estos escenarios solo se suma, así que
  // cualquier escritura con menos series que la anterior es un refresco viejo
  // pisando un toque: si la app se cerrara justo ahí, eso es lo que quedaría.
  let cacheRetrocedio = false;
  const guardarDeVerdad = datos.set.bind(datos);
  datos.set = (clave, valor) => {
    if (clave === 'ascent:sesion' && JSON.parse(valor).series < (cache()?.series ?? 0)) cacheRetrocedio = true;
    return guardarDeVerdad(clave, valor);
  };

  let tocado = false;
  const tocar = () => {
    if (tocado) return;
    tocado = true;
    void inicio.r.serieHecha();
  };
  // Con el vigilante hay dos preguntas; el toque va con la primera que llega.
  let respuestas = 0;
  const n = Number(nTxt);
  const trasOperaciones = (cuantas) =>
    new Promise((listo) => {
      const desde = servidas.n;
      servidas.alServir = (k) => {
        if (k - desde >= cuantas) listo();
      };
    });

  if (modo === 'siempre') {
    servidor.antesDeResponder.mi_sesion = async () => {
      tocado = true;
      respuestas++;
      void inicio.r.serieHecha();
    };
  } else if (modo === 'despues') {
    servidor.antesDeResponder.mi_sesion = async () => {
      if (++respuestas !== 1) return;
      // En un navegador el toque es su propia tarea: cae en la siguiente, no en
      // medio de las microtareas de la respuesta.
      if (cfg.comoLaWeb) return void setImmediate(tocar);
      if (n === 0) return tocar();
      void trasOperaciones(n).then(tocar);
    };
  } else {
    servidor.ida.mi_sesion = 1;
    servidor.antesDeResponder.mi_sesion = async () => {
      if (++respuestas !== 1) return;
      tocar();
      if (nTxt === 'una') {
        servidor.ida.fijar_bloques = 300;
        while (base.series !== 6 || cola().some((p) => p.rpc === 'fijar_series')) await dormir(5);
        delete servidor.ida.fijar_bloques;
      } else if (nTxt === 'fin') {
        while (cola().length > 0 || cache()?.series !== 6 || base.series !== 6) await dormir(5);
      } else if (cfg.comoLaWeb) {
        await new Promise((r) => setImmediate(r));
      } else if (n > 0) {
        await trasOperaciones(n);
      }
    };
  }

  servidor.registro.length = 0;
  await bloquearYDesbloquear();
  await dormir(100);
  await asentar();
  servidas.alServir = null;
  servidor.antesDeResponder = {};
  if (!tocado) throw new Error('el + no llegó a caer');
  // La respuesta que llegó vieja se descarta y se vuelve a pedir: una vez por
  // instancia, y no más.
  const preguntas = servidor.registro.filter((x) => x.rpc === 'mi_sesion').length;
  const e1 = inicio.r.estado;
  const trasElToque = {
    pantalla: [e1.series, e1.bloques.hechas],
    cache: [cache()?.series, cache()?.bloques?.hechas],
    base: [base.series, base.bloques[0]?.series],
  };

  await inicio.r.serieHecha();
  await asentar();
  const e2 = inicio.r.estado;
  return {
    trasElToque,
    trasElSiguiente: { pantalla: [e2.series, e2.bloques.hechas], base: [base.series, base.bloques[0]?.series] },
    preguntas,
    cacheRetrocedio,
  };
}

/**
 * EL GESTO DEL GIMNASIO: tocar el `+` y bloquear el teléfono. Bloquear relee la
 * caché, y si el toque todavía no llegó a guardarse —`n` operaciones de
 * almacenamiento después del toque— lo leído es de antes del toque.
 */
async function releer(nTxt) {
  servidor.ultimoEjercicio = 'press_banca';
  const inicio = montar(() => useSesion());
  await asentar();
  await inicio.r.empezar();
  await asentar();
  for (let i = 0; i < 5; i++) await inicio.r.serieHecha();
  await asentar();

  const desde = servidas.n;
  const bloqueado = new Promise((listo) => {
    servidas.alServir = (k) => {
      if (k - desde < Number(nTxt)) return;
      servidas.alServir = null;
      cambiarVisible(false);
      listo();
    };
  });
  void inicio.r.serieHecha();
  if (Number(nTxt) === 0) cambiarVisible(false);
  else await bloqueado;
  await asentar();
  servidas.alServir = null;
  const e1 = inicio.r.estado;
  const trasElToque = { pantalla: [e1.series, e1.bloques.hechas], cache: [cache()?.series, cache()?.bloques?.hechas] };

  // Sin volver a leer nada: el `+` siguiente sale de lo que quedó en pantalla.
  await inicio.r.serieHecha();
  await asentar();
  const e2 = inicio.r.estado;
  const base = servidor.sesiones[0];
  return {
    trasElToque,
    trasElSiguiente: { pantalla: [e2.series, e2.bloques.hechas], base: [base.series, base.bloques[0]?.series] },
  };
}

const [escenario, ...argumentos] = process.argv.slice(2);
const resultado = await { bloques, refresco, releer }[escenario](...argumentos);
console.log(JSON.stringify(resultado));
// El hook deja un intervalo andando mientras hay sesión: se corta acá.
process.exit(0);
