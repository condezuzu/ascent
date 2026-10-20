// LOS ESCENARIOS DE LA SESIÓN, con `useSesion` de verdad (ver `ganchos.mjs`).
//
//   node --import ./ganchos.mjs escenarios.mjs bloques  <sola|vigilante|otroAparato|sinPreguntar>
//   node --import ./ganchos.mjs escenarios.mjs refresco <despues|antes|siempre> <n> <telefono|web> <solo|vigilante>
//   node --import ./ganchos.mjs escenarios.mjs releer   <n>
//   node --import ./ganchos.mjs escenarios.mjs eleccion <peso|ejercicio|sugerencia|sugerencia-sola>
//   node --import ./ganchos.mjs escenarios.mjs hoja
//   node --import ./ganchos.mjs escenarios.mjs turno    <actividad|modo|doble> [n]
//
// Imprime UNA línea de JSON con lo que se vio. Quien decide si está bien es la
// sección 179 de `test-schema.mjs`. Es un sustituto del teléfono, no el teléfono:
// prueba el orden de las operaciones, no lo que se dibuja.
import { montar } from './react.mjs';
import { cambiarVisible, cfg, datos, servidas } from './plataforma.mjs';
import { servidor } from './cliente.mjs';

const { useSesion } = await import('@compartido/useSesion');
// El dueño único vive en el módulo: "la app arrancó de nuevo" es olvidarlo a mano.
const { olvidarViva } = await import('@compartido/sesionViva');

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

/**
 * ELEGIR Y TOCAR EL `+` ENSEGUIDA, CON LA RED COLGADA. La app se abrió de cero
 * en el subsuelo: la versión del esquema no se sabe y cada pedido que la
 * pregunta tarda y falla. Va una serie de press hecha, y sin esperar:
 *  - `peso`: se escribe 60 y se toca el `+`.
 *  - `ejercicio`: se elige remo y se toca el `+`.
 *  - `sugerencia`: se toca "Terminar serie" y el `+`; la rutina del día
 *    (press, remo) propone remo, y llega con la serie ya contada.
 *  - `sugerencia-sola`: "Terminar serie" y nada más; se mira enseguida, antes
 *    de que la red suelte: la sugerencia no tiene por qué esperarla.
 */
async function eleccion(cual) {
  servidor.ida.version_del_esquema = 300;
  servidor.falla.version_del_esquema = true;
  servidor.ultimoEjercicio = 'press_banca';
  if (cual.startsWith('sugerencia')) {
    const { hoyISO, restarDias } = await import('@nucleo/fechas');
    servidor.historial = [
      { bloques: [{ ejercicio: 'press_banca' }, { ejercicio: 'remo' }], logs: { fecha: restarDias(hoyISO(), 7) } },
    ];
  }
  const inicio = montar(() => useSesion());
  await asentar();
  await inicio.r.empezar();
  await dormir(700);
  await asentar();
  await inicio.r.serieHecha();
  await asentar();

  if (cual === 'peso') void inicio.r.elegirPeso(60);
  else if (cual === 'ejercicio') void inicio.r.elegirEjercicio('remo');
  else void inicio.r.bloqueSiguiente();
  if (cual === 'sugerencia-sola') {
    await dormir(120);
  } else {
    void inicio.r.serieHecha();
    // Lo que esperaba a la red tarda en soltar: se le da tiempo antes de mirar.
    await dormir(900);
    await asentar();
  }

  const e = inicio.r.estado;
  const conPesos = (b) => [
    ...b.cerrados.map((x) => [x.ejercicio, x.series, x.pesos ?? null]),
    [b.ejercicio, b.hechas, b.pesos ?? null],
  ];
  return {
    total: e.series,
    bloques: conPesos(e.bloques),
    sugerido: e.sugerido,
    base: (servidor.sesiones[0].bloques ?? []).map((x) => [x.ejercicio, x.series, x.pesos ?? null]),
  };
}

/**
 * UNA HOJA DE LA NATIVA, abierta y cerrada con su prop. No es de la sesión, pero
 * se corre con el mismo React de mentira: lo que se mira es qué pide dibujar
 * `nuevaEnCadaApertura` en cada paso —con qué llave—, que es lo que decide si
 * el estado de la hoja nace de nuevo o sigue siendo el de antes.
 */
async function hoja() {
  const { nuevaEnCadaApertura } = await import(new URL('../../../movil/src/hojaNueva.ts', import.meta.url).href);
  const LaHoja = () => null;
  const Envuelta = nuevaEnCadaApertura(LaHoja, (p) => p.visible);
  let props = { visible: false, inicial: 'sentadilla' };
  const i = montar(() => Envuelta(props));
  const pasos = [];
  const con = (nuevas) => {
    props = nuevas;
    i.render();
    pasos.push([i.r.key, i.r.props.visible, i.r.props.inicial]);
  };
  con({ visible: false, inicial: 'sentadilla' });
  con({ visible: true, inicial: 'press_banca' });
  con({ visible: true, inicial: 'remo' });
  con({ visible: false, inicial: 'remo' });
  con({ visible: true, inicial: 'peso_muerto' });
  // Una hoja que se monta ya abierta (las que se dibujan solo al abrirlas).
  const abierta = montar(() => Envuelta({ visible: true, inicial: 'x' }));
  return { pasos, laMisma: i.r.type === LaHoja, montadaAbierta: abierta.r.key };
}

/**
 * DOS QUE GUARDAN LA CACHÉ A LA VEZ. Cambiar una cosa de la sesión guardada es
 * leer, mezclar y guardar; si dos lo hacen cruzados, el segundo en guardar pisa
 * al primero con lo que había leído antes.
 *  - `actividad`: se elige un ejercicio con modo recordado. Proponer el modo y
 *    marcar la actividad guardan a la vez: la marca tiene que quedar.
 *  - `modo`: "Terminar serie" con una rutina que propone remo (modo recordado:
 *    por mancuerna). El modo tiene que quedar en la caché, no solo en pantalla.
 *  - `doble`: dos `+` casi juntos (el segundo, `n` operaciones de
 *    almacenamiento después; cuatro si no se dice): la caché tiene que quedar
 *    con las dos.
 */
async function turno(cual, nTxt = '4') {
  servidor.ultimoEjercicio = 'press_banca';
  datos.set('ascent:cargas-elegidas', JSON.stringify({ remo: 'par' }));
  if (cual === 'modo') {
    const { hoyISO, restarDias } = await import('@nucleo/fechas');
    servidor.historial = [
      { bloques: [{ ejercicio: 'press_banca' }, { ejercicio: 'remo' }], logs: { fecha: restarDias(hoyISO(), 7) } },
    ];
  }
  const inicio = montar(() => useSesion());
  await asentar();
  await inicio.r.empezar();
  await asentar();
  for (let i = 0; i < (cual === 'doble' ? 5 : 1); i++) await inicio.r.serieHecha();
  await asentar();

  if (cual === 'actividad') {
    // La última actividad guardada es de hace diez minutos.
    const vieja = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    datos.set('ascent:sesion', JSON.stringify({ ...cache(), ultimaActividad: vieja }));
    const desde = Date.now();
    await inicio.r.elegirEjercicio('remo');
    await asentar();
    return { marcaFresca: Date.parse(cache().ultimaActividad) >= desde - 1000, modo: cache().bloques?.carga ?? null };
  }
  if (cual === 'modo') {
    await inicio.r.bloqueSiguiente();
    await asentar();
    const e = inicio.r.estado;
    return { pantalla: [e.bloques.ejercicio, e.bloques.carga ?? null], cache: [cache().bloques?.ejercicio, cache().bloques?.carga ?? null] };
  }
  const desde = servidas.n;
  const segundo = new Promise((listo) => {
    servidas.alServir = (k) => {
      if (k - desde < Number(nTxt)) return;
      servidas.alServir = null;
      void inicio.r.serieHecha();
      listo();
    };
  });
  void inicio.r.serieHecha();
  if (Number(nTxt) === 0) {
    servidas.alServir = null;
    void inicio.r.serieHecha();
  } else {
    await segundo;
  }
  await asentar();
  const e = inicio.r.estado;
  const base = servidor.sesiones[0];
  return {
    pantalla: [e.series, e.bloques.hechas],
    cache: [cache()?.series, cache()?.bloques?.hechas],
    base: [base.series, base.bloques[0]?.series],
  };
}

/**
 * SEÑAL MALA (cacería del 13/10). En todos, la base juzga la sesión con lo que
 * le llegó, y el teléfono tiene cosas sin subir.
 *  - `pregunta`: se entrena 47 min en una zona sin señal y al desbloquear entra
 *    `mi_sesion` pero no la cola. La base no puede cerrar la sesión en el minuto 3.
 *  - `iniciar`: con series de la sesión sin subir no se inicia otra (la base
 *    cerraría esta con datos viejos). `iniciar-olvidada`: el teléfono ya la
 *    olvidó y la base la devuelve viva, con el conteo viejo: no se adopta.
 *  - `terminar` / `terminar-siguio`: "Terminar" sin señal y el reintento más
 *    tarde. Cierra a la hora del PRIMER toque, salvo que después se haya seguido.
 *  - `sin-sesion`: "+ Serie hecha" con la sesión ya cerrada sola.
 */
async function senal(cual) {
  const COLA = ['fijar_series', 'fijar_bloques', 'marcar_actividad'];
  const cortar = (si) => COLA.forEach((rpc) => (servidor.falla[rpc] = si));
  const llegaron = (rpc) => servidor.registro.filter((x) => x.rpc === rpc).length;
  const inicio = montar(() => useSesion());
  await asentar();
  await inicio.r.empezar();
  await asentar();
  await inicio.r.elegirPeso(60);
  await inicio.r.serieHecha();
  await inicio.r.serieHecha();
  await asentar();
  const s = servidor.sesiones[0];
  const pantalla = () => ({ corriendo: inicio.r.estado.corriendo, series: inicio.r.estado.series });

  if (cual === 'pregunta' || cual === 'iniciar' || cual === 'iniciar-olvidada') {
    cortar(true);
    for (let i = 0; i < 4; i++) await inicio.r.serieHecha();
    await dormir(80);
    // Para la base pasaron 47 minutos y lo último que supo fue hace 44.
    s.inicio = new Date(Date.now() - 47 * 60000).toISOString();
    s.ultima_actividad = new Date(Date.now() - 44 * 60000).toISOString();
    servidor.ventanaMs = 30 * 60000;
    const antes = llegaron('mi_sesion');
    if (cual === 'iniciar' || cual === 'iniciar-olvidada') {
      let quien = inicio;
      if (cual === 'iniciar-olvidada') {
        // El teléfono olvidó la sesión (su copia vence a la media hora y la app
        // arrancó de nuevo), pero para la base sigue viva: devuelve la misma.
        servidor.ventanaMs = null;
        datos.delete('ascent:sesion');
        olvidarViva();
        quien = montar(() => useSesion());
        await dormir(60);
      }
      const salio = await quien.r.empezar();
      await dormir(120);
      return {
        salio,
        series: quien.r.estado.series,
        enCola: cola().filter((p) => p.rpc === 'fijar_series').map((p) => p.args.p_series),
        base: [s.estado, s.series],
        sesionesEnLaBase: servidor.sesiones.length,
      };
    }
    await bloquearYDesbloquear();
    await dormir(150);
    const sinSubir = { ...pantalla(), preguntas: llegaron('mi_sesion') - antes, base: s.estado };
    // Vuelve la señal de verdad.
    cortar(false);
    await bloquearYDesbloquear();
    await asentar();
    return { sinSubir, alVolver: { ...pantalla(), preguntas: llegaron('mi_sesion') - antes > 0, base: [s.estado, s.series, s.cerro_sola] } };
  }

  if (cual === 'terminar' || cual === 'terminar-siguio') {
    servidor.falla.terminar_sesion = true;
    const toque = Date.now();
    const primero = await inicio.r.terminar();
    await dormir(400);
    if (cual === 'terminar-siguio') {
      await inicio.r.serieHecha();
      await asentar();
    }
    servidor.falla.terminar_sesion = false;
    const segundo = await inicio.r.terminar();
    const mandado = servidor.registro.filter((x) => x.rpc === 'terminar_sesion').pop()?.args?.p_hasta ?? null;
    return {
      primero: primero === null ? 'no salió' : 'salió',
      segundo: segundo === null ? 'no salió' : 'salió',
      // Cuánto se aleja la hora mandada del primer toque, y del reintento.
      delPrimerToque: mandado ? Math.abs(Date.parse(mandado) - toque) < 150 : null,
      atrasoMs: mandado ? Date.now() - Date.parse(mandado) >= 300 : null,
      conHora: mandado !== null,
      base: s.estado,
    };
  }

  if (cual === 'sin-sesion') {
    // La base la cerró sola y el teléfono ya se enteró: no hay sesión en pantalla.
    Object.assign(s, { estado: 'terminada', cerro_sola: true, fin: new Date().toISOString() });
    await bloquearYDesbloquear();
    await asentar();
    const enBase = [s.series, JSON.stringify(s.bloques)];
    servidor.registro.length = 0;
    const antes = pantalla();
    await inicio.r.serieHecha();
    await inicio.r.serieHecha();
    await asentar();
    return {
      antes,
      despues: pantalla(),
      escrituras: servidor.registro.filter((x) => COLA.includes(x.rpc)).length,
      enCola: cola().length,
      laBaseQuedoIgual: enBase[0] === s.series && enBase[1] === JSON.stringify(s.bloques),
      descanso: inicio.r.estado.descanso ?? null,
    };
  }
  return { fallo: 'no conozco ' + cual };
}

/** `copia`: `cacheLeida` al montar es false, y pasa a true recién cuando se leyó la copia de la sesión. */
async function copia() {
  const inicio = montar(() => useSesion());
  const alMontar = inicio.r.estado.cacheLeida;
  await asentar();
  return { alMontar, despues: inicio.r.estado.cacheLeida };
}

/**
 * `cardio`: una vuelta con minutos se anota y sube como una serie, sin descanso
 * después; corregir los minutos con la vuelta contada llega a la base. Y una serie
 * común, en el mismo hook, sí arranca el descanso (que el escenario no pase en
 * verde porque los descansos estén apagados).
 */
async function cardio() {
  const inicio = montar(() => useSesion());
  await asentar();
  await inicio.r.empezar();
  await asentar();
  await inicio.r.elegirEjercicio('cinta');
  await inicio.r.elegirMinutos(25);
  await inicio.r.serieHecha({ sinDescanso: true });
  await asentar();
  const s = servidor.sesiones.find((x) => x.estado === 'corriendo');
  const tras = { series: s?.series ?? null, minutos: (s?.bloques ?? []).map((b) => b.minutos ?? null), descanso: inicio.r.estado.descanso !== null };
  await inicio.r.elegirMinutos(30);
  await asentar();
  const corregido = (s?.bloques ?? []).map((b) => b.minutos ?? null);
  // Una serie común es de fuerza: sobre la cinta, "+ Serie hecha" ya no cuenta (cacería del 15/10).
  await inicio.r.elegirEjercicio('press_banca');
  await inicio.r.serieHecha();
  await asentar();
  return { tras, corregido, comun: inicio.r.estado.descanso !== null };
}

/**
 * `cronometro`: EL CRONÓMETRO DEL CARDIO (15/10). Se elige cinta y arranca; a
 * los 12 minutos "Listo" anota 12 y la vuelta cuenta, SIN descanso; "Otra
 * vuelta" arranca de nuevo y a los 5 suma 17. El reloj se adelanta a mano.
 */
async function cronometro() {
  const real = Date.now;
  let adelanto = 0;
  Date.now = () => real() + adelanto;
  const inicio = montar(() => useSesion());
  await asentar();
  await inicio.r.empezar();
  await asentar();
  await inicio.r.elegirEjercicio('cinta');
  await inicio.r.arrancarCardio();
  await asentar();
  const corre = inicio.r.estado.bloques.cardioDesde !== undefined;
  const enCache = cache()?.bloques?.cardioDesde !== undefined;
  const viva = () => servidor.sesiones.find((x) => x.estado === 'corriendo');
  adelanto = 12 * 60000 + 20000;
  await inicio.r.cerrarVueltaDeCardio();
  await asentar();
  const primera = {
    minutos: (viva()?.bloques ?? []).map((b) => b.minutos ?? null),
    descanso: inicio.r.estado.descanso !== null,
    corre: inicio.r.estado.bloques.cardioDesde !== undefined,
    subioElCronometro: JSON.stringify(viva()?.bloques ?? []).includes('cardioDesde'),
  };
  await inicio.r.arrancarCardio();
  adelanto += 5 * 60000;
  await inicio.r.cerrarVueltaDeCardio();
  await asentar();
  return { corre, enCache, primera, segunda: { minutos: (viva()?.bloques ?? []).map((b) => b.minutos ?? null), series: viva()?.series ?? null } };
}

/**
 * `cardioLargo` (cacería del 15/10): la cinta con el cronómetro andando.
 *  - `35` / `50`: tantos minutos de cinta con la app adelante y sin tocar nada;
 *    después se desbloquea (la base contesta) y se toca Listo. La base cierra
 *    por inactividad a la media hora de su última marca, con marcas que acepta
 *    hasta 15 min adelante.
 *  - `terminar` / `cambiar`: a los 12 min de cinta se toca Terminar, o se elige
 *    otro ejercicio. La vuelta no se puede perder.
 */
async function cardioLargo(caso) {
  const real = Date.now;
  let adelanto = 0;
  Date.now = () => real() + adelanto;
  servidor.ventanaMs = 30 * 60000;
  const inicio = montar(() => useSesion());
  await asentar();
  await inicio.r.empezar();
  await asentar();
  await inicio.r.elegirEjercicio('cinta');
  await inicio.r.arrancarCardio();
  await asentar();
  const viva = () => servidor.sesiones[0];
  const minutos = () => (viva()?.bloques ?? []).map((b) => [b.ejercicio, b.minutos ?? null]);
  if (caso === 'terminar' || caso === 'cambiar') {
    adelanto = 12 * 60000;
    let cierre = null;
    if (caso === 'terminar') cierre = await inicio.r.terminar();
    else await inicio.r.elegirEjercicio('press_banca');
    await asentar();
    return {
      base: minutos(),
      resumen: cierre ? cierre.bloques.map((b) => [b.ejercicio, b.minutos ?? null]) : null,
      series: viva()?.series ?? null,
    };
  }
  // Con la app adelante: el reloj de la sesión hace su vuelta de cada segundo.
  for (let m = 5; m <= Number(caso); m += 5) {
    adelanto = m * 60000;
    await dormir(1300);
  }
  await asentar();
  await bloquearYDesbloquear();
  await dormir(300);
  await asentar();
  const alMirar = { corriendo: inicio.r.estado.corriendo, base: viva()?.estado ?? null };
  await inicio.r.cerrarVueltaDeCardio();
  await asentar();
  return { alMirar, base: minutos() };
}

/**
 * `descansoLargo` (cacería del 15/10): el + del descanso deja ponerlo a mano hasta una
 * hora. Un descanso de 50 min con la app adelante no puede cerrar la sesión.
 */
async function descansoLargo() {
  const real = Date.now;
  let adelanto = 0;
  Date.now = () => real() + adelanto;
  servidor.ventanaMs = 30 * 60000;
  const { cambiarDuracion } = await import('@compartido/descanso');
  const inicio = montar(() => useSesion());
  await asentar();
  await inicio.r.empezar();
  await asentar();
  await inicio.r.elegirEjercicio('press_banca');
  await inicio.r.serieHecha();
  await asentar();
  const d = inicio.r.estado.descanso;
  if (d) inicio.r.reiniciarDescanso(cambiarDuracion(d, 50 * 60));
  await asentar();
  for (let m = 5; m <= 50; m += 5) {
    adelanto = m * 60000;
    await dormir(1300);
  }
  await asentar();
  await bloquearYDesbloquear();
  await dormir(300);
  await asentar();
  return { corriendo: inicio.r.estado.corriendo, base: servidor.sesiones[0]?.estado ?? null };
}

/**
 * `vueltaDos` (cacería del 15/10, vuelta 2): la cinta y las marcas, por el camino de la pantalla.
 *  - `bolsillo`: se elige la cinta como lo hace Bloque —sin esperar— y arranca el
 *    cronómetro; el teléfono se bloquea 35 min. La sesión no puede cerrarse.
 *  - `salida`: la cinta anda y la sesión se termina con la hora de salida del
 *    gimnasio (10 min después de arrancar); se abre la app a los 50. La cinta son 10.
 *  - `sinSenal`: Terminar sin señal con un descanso andando; la renovación de la
 *    marca no puede borrar la hora del toque, y el reintento cierra a esa hora.
 *  - `listo`: 15 min de cinta, "Listo", y la persona se va sin tocar Terminar: la
 *    sesión se cierra sola a la hora de Listo, no una hora después (con la 82).
 *  - `serieEnCinta`: con la cinta andando se toca "+ Serie hecha" en el descanso:
 *    es la misma vuelta, no una más.
 */
async function vueltaDos(caso) {
  const real = Date.now;
  let adelanto = 0;
  Date.now = () => real() + adelanto;
  servidor.ventanaMs = 30 * 60000;
  // `listo` necesita la 82 (la marca que baja).
  if (caso === 'listo') servidor.version = 82;
  const inicio = montar(() => useSesion());
  await asentar();
  await inicio.r.empezar();
  await asentar();
  const viva = () => servidor.sesiones[0];
  if (caso === 'sinSenal') {
    const { cambiarDuracion } = await import('@compartido/descanso');
    await inicio.r.elegirEjercicio('press_banca');
    await inicio.r.serieHecha();
    await asentar();
    // Un descanso largo andando cuando se toca Terminar: la renovación cae adentro.
    const d = inicio.r.estado.descanso;
    if (d) inicio.r.reiniciarDescanso(cambiarDuracion(d, 30 * 60));
    await dormir(1300);
    await asentar();
    const toque = Date.now();
    ['terminar_sesion', 'fijar_series', 'fijar_bloques', 'marcar_actividad', 'mi_sesion'].forEach((r) => (servidor.falla[r] = true));
    await inicio.r.terminar();
    await dormir(300);
    adelanto = 6 * 60000;
    await dormir(1300);
    adelanto = 20 * 60000;
    await dormir(1300);
    ['terminar_sesion', 'fijar_series', 'fijar_bloques', 'marcar_actividad', 'mi_sesion'].forEach((r) => (servidor.falla[r] = false));
    await inicio.r.terminar();
    await asentar();
    const fin = Date.parse(viva()?.fin ?? '') || null;
    return { estado: viva()?.estado ?? null, finEnElToque: fin !== null && Math.abs(fin - toque) < 60000 };
  }
  void inicio.r.elegirEjercicio('cinta');
  await inicio.r.arrancarCardio();
  await asentar();
  if (caso === 'serieEnCinta') {
    adelanto = 7 * 60000;
    await inicio.r.serieHecha();
    await asentar();
    return { series: viva()?.series ?? null, bloques: (viva()?.bloques ?? []).map((b) => [b.ejercicio, b.series, b.minutos ?? null]) };
  }
  if (caso === 'listo') {
    adelanto = 15 * 60000;
    await inicio.r.cerrarVueltaDeCardio();
    await asentar();
    const listo = Date.now();
    cambiarVisible(false);
    await asentar();
    adelanto = 15 * 60000 + 50 * 60000;
    cambiarVisible(true);
    await dormir(400);
    await asentar();
    const fin = Date.parse(viva()?.fin ?? '') || null;
    return { estado: viva()?.estado ?? null, minutosDeMas: fin === null ? null : Math.round((fin - listo) / 60000) };
  }
  if (caso === 'salida') {
    const arranco = Date.now();
    adelanto = 50 * 60000;
    await inicio.r.terminar({ hasta: arranco + 10 * 60000 });
    await asentar();
    return { bloques: (viva()?.bloques ?? []).map((b) => [b.ejercicio, b.minutos ?? null]) };
  }
  // bolsillo
  cambiarVisible(false);
  await asentar();
  adelanto = 35 * 60000;
  cambiarVisible(true);
  await dormir(400);
  await asentar();
  return { corriendo: inicio.r.estado.corriendo, base: viva()?.estado ?? null };
}

/**
 * `vueltaTres` (cacería del 15/10, vuelta 3), con la 82 en la base:
 *  - `seguir`: con la cinta andando se toca "Seguir" en un descanso ya terminado y
 *    el teléfono va al bolsillo 35 min. La marca de la cinta no puede bajar.
 *  - `semilla`: la semilla del primer bloque llega tarde (señal lenta) y la persona
 *    ya eligió la cinta: no se la puede pisar.
 *  - `porError`: la cinta se toca por error y a los 20 s se elige otro: no queda
 *    una vuelta de un minuto ni una serie de más.
 *  - `acortar`: un descanso de una hora se corrige a 90 s: la marca baja a su fin.
 *  - `pisada`: "Listo" sin señal y después una serie: la bajada no se pierde en la cola.
 *  - `tarde`: "Listo" sin señal; la señal vuelve 20 min después: la marca queda en
 *    la hora de Listo, no en la de la vuelta de la señal.
 *  - `guardada`: con la rutina guardada, se elige otro ejercicio de ese día: al
 *    terminarlo, se propone el siguiente de la rutina, no uno del historial.
 */
async function vueltaTres(caso) {
  const real = Date.now;
  let adelanto = 0;
  Date.now = () => real() + adelanto;
  servidor.ventanaMs = 30 * 60000;
  servidor.version = 82;
  const { cambiarDuracion } = await import('@compartido/descanso');
  const SIN_RED = ['fijar_series', 'fijar_bloques', 'marcar_actividad', 'mi_sesion'];
  if (caso === 'guardada') {
    datos.set('ascent:perfil', JSON.stringify({ id: 'yo', username: 'yo', racha_actual: 1, unidad_peso: 'kg' }));
    const dias = Array.from({ length: 7 }, () => ({ descanso: false, ejercicios: [] }));
    dias[new Date(Date.now()).getDay()] = { descanso: false, ejercicios: ['press_banca', 'press_inclinado', 'aperturas'].map((ejercicio) => ({ ejercicio, series: 3 })) };
    datos.set('ascent:rutina-activa', JSON.stringify({ de: 'yo', dias }));
  }
  if (caso === 'semilla') servidor.ida.ultimo_ejercicio = 500;
  const inicio = montar(() => useSesion());
  await asentar();
  await inicio.r.empezar();
  const viva = () => servidor.sesiones[0];
  const adelante = () => Math.round((Date.parse(viva()?.ultima_actividad ?? '') - Date.now()) / 60000);
  if (caso === 'semilla') {
    void inicio.r.elegirEjercicio('cinta');
    await inicio.r.arrancarCardio();
    await dormir(900);
    await asentar();
    return { ejercicio: inicio.r.estado.bloques.ejercicio, cronometro: inicio.r.estado.bloques.cardioDesde !== undefined };
  }
  await asentar();
  if (caso === 'guardada') {
    await dormir(300);
    await inicio.r.elegirEjercicio('press_inclinado');
    await inicio.r.serieHecha({ sinDescanso: true });
    await inicio.r.bloqueSiguiente();
    await asentar();
    return { propone: inicio.r.estado.bloques.ejercicio };
  }
  if (caso === 'acortar') {
    await inicio.r.elegirEjercicio('press_banca');
    await inicio.r.serieHecha();
    await asentar();
    inicio.r.reiniciarDescanso(cambiarDuracion(inicio.r.estado.descanso, 60 * 60));
    await asentar();
    const conHora = adelante();
    inicio.r.reiniciarDescanso(cambiarDuracion(inicio.r.estado.descanso, 90));
    await asentar();
    return { conHora, corregido: adelante() <= 2 };
  }
  if (caso === 'seguir') {
    await inicio.r.elegirEjercicio('press_banca');
    await inicio.r.serieHecha();
    await asentar();
    void inicio.r.elegirEjercicio('cinta');
    await inicio.r.arrancarCardio();
    await asentar();
    adelanto = 4 * 60000;
    inicio.r.cerrarDescanso();
    await asentar();
    cambiarVisible(false);
    await asentar();
    adelanto = 39 * 60000;
    cambiarVisible(true);
    await dormir(400);
    await asentar();
    return { corriendo: inicio.r.estado.corriendo, cronometro: inicio.r.estado.bloques.cardioDesde !== undefined };
  }
  void inicio.r.elegirEjercicio('cinta');
  await inicio.r.arrancarCardio();
  await asentar();
  if (caso === 'porError') {
    adelanto = 20000;
    await inicio.r.elegirEjercicio('press_banca');
    await asentar();
    return { series: viva()?.series ?? null, bloques: (viva()?.bloques ?? []).map((b) => b.ejercicio) };
  }
  // pisada / tarde
  adelanto = 15 * 60000;
  SIN_RED.forEach((r) => (servidor.falla[r] = true));
  await inicio.r.cerrarVueltaDeCardio();
  const listo = Date.now();
  if (caso === 'pisada') {
    await inicio.r.elegirEjercicio('press_banca');
    await inicio.r.serieHecha({ sinDescanso: true });
  }
  await dormir(200);
  adelanto = 35 * 60000;
  SIN_RED.forEach((r) => (servidor.falla[r] = false));
  await bloquearYDesbloquear();
  await dormir(300);
  await asentar();
  const ultima = Date.parse(viva()?.ultima_actividad ?? '');
  return { cercaDeListo: Math.abs(ultima - listo) < 2 * 60000 };
}

/**
 * `vueltaCuatro` (cacería del 15/10, vuelta 4): la sesión que ya había empezado otro
 * aparato (2 × 60 de press anotadas allá), con señal lenta.
 *  - `elige`: se toca Iniciar, y mientras llega el historial se elige remo.
 *  - `mas`: lo mismo, y además un + en remo.
 *  - `llega`: el historial es rápido pero los bloques de la base tardan; se elige
 *    remo antes de que lleguen. Remo sigue siendo el de ahora.
 *  - `cintaParada`: la cinta ya cerrada con Listo y se toca "+ Serie hecha" en el
 *    descanso: ni vuelta de cero minutos ni descanso.
 */
async function vueltaCuatro(caso) {
  const real = Date.now;
  let adelanto = 0;
  Date.now = () => real() + adelanto;
  const viva = () => servidor.sesiones[0];
  const lista = () => (viva()?.bloques ?? []).map((b) => [b.ejercicio, b.series]);
  if (caso === 'cintaParada') {
    const inicio = montar(() => useSesion());
    await asentar();
    await inicio.r.empezar();
    await asentar();
    await inicio.r.elegirEjercicio('press_banca');
    await inicio.r.serieHecha();
    await asentar();
    void inicio.r.elegirEjercicio('cinta');
    await inicio.r.arrancarCardio();
    await asentar();
    adelanto = 10 * 60000;
    await inicio.r.cerrarVueltaDeCardio();
    await asentar();
    await inicio.r.serieHecha();
    await asentar();
    return { series: viva()?.series ?? null, bloques: (viva()?.bloques ?? []).map((b) => [b.ejercicio, b.series, b.minutos ?? null]), descanso: inicio.r.estado.descanso !== null };
  }
  // El teléfono tiene Inicio abierto desde antes (sin sesión); la sesión la empieza otro aparato.
  const inicio = montar(() => useSesion());
  await asentar();
  const ahora = new Date(Date.now()).toISOString();
  servidor.sesiones.push({
    id: 'sesion-web', inicio: ahora, series: 2, estado: 'corriendo', origen: 'manual', ultima_actividad: ahora, cerro_sola: false,
    bloques: [{ ejercicio: 'press_banca', series: 2, pesos: [60, 60] }],
  });
  if (caso === 'llega') servidor.ida.bloquesDeSesion = 600;
  else servidor.ida.historial = 800;
  await inicio.r.empezar();
  await dormir(50);
  await inicio.r.elegirEjercicio('remo_barra');
  if (caso === 'mas') await inicio.r.serieHecha({ sinDescanso: true });
  await dormir(1500);
  await asentar();
  return { base: lista(), series: viva()?.series ?? null, enCurso: inicio.r.estado.bloques.ejercicio };
}

/**
 * `vueltaCinco` (cacería del 15/10, vuelta 5):
 *  - `deshacer` / `siguiente`: la sesión de otro aparato (press 2 × 60) sin poder
 *    traer sus bloques; acá remo 2. Vuelve la señal y se toca − (o Terminar serie);
 *    se bloquea y desbloquea, y se suma sentadilla. Lo de allá no se borra.
 *  - `terminar`: lo mismo, pero se toca Terminar al volver la señal: lo de acá sube.
 *  - `menos`: 30 min de cinta, Listo, otra vuelta, y a los 2 min el −: los 30 quedan.
 */
async function vueltaCinco(caso) {
  const real = Date.now;
  let adelanto = 0;
  Date.now = () => real() + adelanto;
  const viva = () => servidor.sesiones[0];
  const lista = () => (viva()?.bloques ?? []).map((b) => [b.ejercicio, b.series, b.minutos ?? null]);
  const inicio = montar(() => useSesion());
  await asentar();
  if (caso === 'menos') {
    await inicio.r.empezar();
    await asentar();
    void inicio.r.elegirEjercicio('cinta');
    await inicio.r.arrancarCardio();
    adelanto = 30 * 60000;
    await inicio.r.cerrarVueltaDeCardio();
    await inicio.r.arrancarCardio();
    adelanto = 32 * 60000;
    await inicio.r.deshacerSerie();
    await asentar();
    return { base: lista(), series: viva()?.series ?? null, cronometro: inicio.r.estado.bloques.cardioDesde !== undefined };
  }
  const ahora = new Date(Date.now()).toISOString();
  servidor.sesiones.push({
    id: 'sesion-web', inicio: ahora, series: 2, estado: 'corriendo', origen: 'manual', ultima_actividad: ahora, cerro_sola: false,
    bloques: [{ ejercicio: 'press_banca', series: 2, pesos: [60, 60] }],
  });
  servidor.falla.lecturas = true;
  await inicio.r.empezar();
  await asentar();
  await inicio.r.elegirEjercicio('remo_barra');
  await inicio.r.serieHecha({ sinDescanso: true });
  await inicio.r.serieHecha({ sinDescanso: true });
  await asentar();
  servidor.falla.lecturas = false;
  if (caso === 'terminar') {
    await inicio.r.terminar();
    await asentar();
    return { base: lista().map(([e, n]) => [e, n]), estado: viva()?.estado ?? null };
  }
  if (caso === 'siguiente') await inicio.r.bloqueSiguiente();
  else await inicio.r.deshacerSerie();
  await asentar();
  await bloquearYDesbloquear();
  await dormir(200);
  await asentar();
  await inicio.r.elegirEjercicio('sentadilla');
  await inicio.r.serieHecha({ sinDescanso: true });
  await asentar();
  return { conservaLoDeAlla: lista().some(([e, n]) => e === 'press_banca' && n === 2) };
}

/**
 * `vueltaSeis` (cacería del 15/10, vuelta 6):
 *  - `reabrir`: sesión de otro aparato (press 2) sin poder traer sus bloques; acá
 *    remo. iOS mata la app, se reabre sin señal y se toca +. Vuelve la señal.
 *  - `terminarSinLeer`: lo mismo sin cerrar la app, y Terminar sin poder leer.
 *  - `quieto`: press 2 acá; este aparato queda quieto 31 min mientras el otro anota remo 1.
 *  - `cintaSugerida`: la rutina propone la cinta; Arrancar la confirma.
 *  - `cadena`: rutina guardada; iOS mata la app tras la primera; se desbloquea y sigue.
 *  - `cintaParada`: 30 + 20 min de cinta, −, − y otro ejercicio.
 */
async function vueltaSeis(caso) {
  const real = Date.now;
  let adelanto = 0;
  Date.now = () => real() + adelanto;
  const viva = () => servidor.sesiones[servidor.sesiones.length - 1];
  const lista = () => (viva()?.bloques ?? []).map((b) => [b.ejercicio, b.series, b.minutos ?? null]);
  const TODO = ['mi_sesion', 'fijar_series', 'fijar_bloques', 'marcar_actividad', 'iniciar_sesion', 'terminar_sesion'];
  const sinSenal = (si) => {
    for (const r of TODO) servidor.falla[r] = si;
    servidor.falla.lecturas = si;
  };
  const deOtroAparato = () => {
    const ahora = new Date(Date.now()).toISOString();
    servidor.sesiones.push({
      id: 'sesion-web', inicio: ahora, series: 2, estado: 'corriendo', origen: 'manual', ultima_actividad: ahora, cerro_sola: false,
      bloques: [{ ejercicio: 'press_banca', series: 2, pesos: [60, 60] }],
    });
  };
  if (caso === 'cadena') {
    datos.set('ascent:perfil', JSON.stringify({ id: 'yo', username: 'yo', racha_actual: 1, unidad_peso: 'kg' }));
    const dias = Array.from({ length: 7 }, () => ({ descanso: false, ejercicios: [] }));
    dias[new Date(Date.now()).getDay()] = { descanso: false, ejercicios: ['press_banca', 'press_inclinado', 'aperturas'].map((ejercicio) => ({ ejercicio, series: 3 })) };
    datos.set('ascent:rutina-activa', JSON.stringify({ de: 'yo', dias }));
  }
  if (caso === 'cintaSugerida') {
    const { hoyISO, restarDias } = await import('@nucleo/fechas');
    servidor.ultimoEjercicio = 'press_banca';
    servidor.historial = [{ bloques: [{ ejercicio: 'press_banca' }, { ejercicio: 'cinta' }], logs: { fecha: restarDias(hoyISO(), 7) } }];
  }
  let tel = montar(() => useSesion());
  await asentar();
  if (caso === 'reabrir' || caso === 'terminarSinLeer') {
    deOtroAparato();
    servidor.falla.lecturas = true;
    await tel.r.empezar();
    await dormir(300);
    await tel.r.elegirEjercicio('remo_barra');
    await dormir(300);
    if (caso === 'terminarSinLeer') {
      await tel.r.serieHecha({ sinDescanso: true });
      await dormir(200);
      const cierre = await tel.r.terminar();
      await dormir(300);
      const primero = { cerro: !!cierre, estado: viva().estado };
      servidor.falla.lecturas = false;
      const segundo = await tel.r.terminar();
      await asentar();
      return { primero, segundo: { cerro: !!segundo, estado: viva().estado, base: lista().map(([e, n]) => [e, n]) } };
    }
    sinSenal(true);
    olvidarViva();
    tel = montar(() => useSesion());
    await dormir(400);
    await tel.r.serieHecha({ sinDescanso: true });
    await dormir(200);
    sinSenal(false);
    await bloquearYDesbloquear();
    await dormir(1200);
    await asentar();
    return { base: lista().map(([e, n]) => [e, n]) };
  }
  await tel.r.empezar();
  await asentar();
  if (caso === 'quieto') {
    servidor.ventanaMs = 30 * 60000;
    await tel.r.elegirEjercicio('press_banca');
    await tel.r.serieHecha({ sinDescanso: true });
    await tel.r.serieHecha({ sinDescanso: true });
    await asentar();
    adelanto = 31 * 60000;
    const s = viva();
    s.bloques = [...s.bloques, { ejercicio: 'remo_barra', series: 1 }];
    s.series = 3;
    s.ultima_actividad = new Date(Date.now()).toISOString();
    await dormir(3000);
    await asentar();
    return { base: lista().map(([e, n]) => [e, n]), estado: viva().estado };
  }
  if (caso === 'cintaSugerida') {
    await dormir(400);
    await asentar();
    await tel.r.serieHecha({ sinDescanso: true });
    await asentar();
    await tel.r.bloqueSiguiente();
    await asentar();
    const propuesta = [tel.r.estado.bloques.ejercicio, tel.r.estado.sugerido];
    await tel.r.arrancarCardio();
    await asentar();
    return { propuesta, alArrancar: [tel.r.estado.sugerido, cache()?.sugerido ?? null] };
  }
  if (caso === 'cadena') {
    await dormir(300);
    await asentar();
    await tel.r.serieHecha({ sinDescanso: true });
    await tel.r.bloqueSiguiente();
    await asentar();
    // Desbloquear pregunta a la base: la cadena tiene que sobrevivir a esa escritura de la caché.
    await bloquearYDesbloquear();
    await dormir(300);
    await asentar();
    olvidarViva();
    tel = montar(() => useSesion());
    await dormir(300);
    await asentar();
    await tel.r.serieHecha({ sinDescanso: true });
    await tel.r.bloqueSiguiente();
    await asentar();
    return { propone: [tel.r.estado.bloques.ejercicio, tel.r.estado.sugerido] };
  }
  // cintaParada
  const vuelta = async (min) => {
    await tel.r.arrancarCardio();
    adelanto += min * 60000;
    await tel.r.cerrarVueltaDeCardio();
    await asentar();
  };
  await tel.r.elegirEjercicio('cinta');
  await vuelta(30);
  await vuelta(20);
  await tel.r.deshacerSerie();
  await asentar();
  await tel.r.deshacerSerie();
  await asentar();
  await tel.r.elegirEjercicio('press_banca');
  await asentar();
  return { base: lista(), series: viva().series };
}

/**
 * `vueltaSiete` (cacería del 15/10, vuelta 7):
 *  - `menosCinta`: la cinta arranca sola, a los 3 min se apaga con el − y nadie toca
 *    Terminar: la base cierra sola, y el fin tiene que ser a los 3 min, no a los 60.
 *  - `otroSinLeer`: el otro aparato suma remo; al desbloquear no se pueden leer los
 *    bloques; vuelve la señal y se toca +: el remo sigue en la base.
 *  - `propioAjeno`: el historial y el último ejercicio traen un propio de un amigo que
 *    ya no se ve (la 80): no sale como rutina ni como semilla.
 */
async function vueltaSiete(caso) {
  const real = Date.now;
  let adelanto = 0;
  Date.now = () => real() + adelanto;
  servidor.version = 82;
  if (caso === 'propioAjeno') {
    const { hoyISO, restarDias } = await import('@nucleo/fechas');
    servidor.visibles = ['press_banca', 'remo_barra', 'sentadilla'];
    servidor.ultimoEjercicio = 'propio_ajeno';
    servidor.historial = [{ bloques: [{ ejercicio: 'propio_ajeno' }, { ejercicio: 'remo_barra' }], logs: { fecha: restarDias(hoyISO(), 7) } }];
  }
  const tel = montar(() => useSesion());
  await asentar();
  await tel.r.empezar();
  await asentar();
  const s = servidor.sesiones[0];
  if (caso === 'propioAjeno') {
    await dormir(400);
    await asentar();
    return { semilla: tel.r.estado.bloques.ejercicio };
  }
  if (caso === 'menosCinta') {
    const { crearCliente } = await import('./cliente.mjs');
    await tel.r.elegirEjercicio('cinta');
    await tel.r.arrancarCardio();
    await asentar();
    adelanto = 3 * 60000;
    await tel.r.deshacerSerie();
    await asentar();
    servidor.ventanaMs = 30 * 60000;
    adelanto = 120 * 60000;
    await crearCliente().rpc('mi_sesion');
    return { estado: s.estado, finMin: s.fin ? Math.round((Date.parse(s.fin) - Date.parse(s.inicio)) / 60000) : null };
  }
  // otroSinLeer
  await tel.r.elegirEjercicio('press_banca');
  await tel.r.serieHecha({ sinDescanso: true });
  await tel.r.serieHecha({ sinDescanso: true });
  await asentar();
  s.bloques = [...s.bloques, { ejercicio: 'remo_barra', series: 1 }];
  s.series = 3;
  servidor.falla.lecturas = true;
  await bloquearYDesbloquear();
  await dormir(400);
  await asentar();
  servidor.falla.lecturas = false;
  await tel.r.serieHecha({ sinDescanso: true });
  await dormir(300);
  await asentar();
  return { base: s.bloques.map((b) => [b.ejercicio, b.series]), series: s.series };
}

/**
 * `vueltaOcho` (cacería del 15/10, vuelta 8), con otro aparato que anota:
 *  - `dupla`: acá press 2; allá remo 1 y no se puede leer; allá sentadilla 1 y vuelve
 *    la señal. Nadie toca nada acá: la base no duplica.
 *  - `peso`: press 2 con 60; allá remo 1; sin poder leer, el + siguiente lleva los 60.
 *  - `cinta`: la cinta andando; allá remo 1; sin poder leer, Listo a los 20 anota la cinta.
 */
async function vueltaOcho(caso) {
  const real = Date.now;
  let adelanto = 0;
  Date.now = () => real() + adelanto;
  servidor.version = 82;
  const tel = montar(() => useSesion());
  await asentar();
  await tel.r.empezar();
  await asentar();
  const s = servidor.sesiones[0];
  const base = () => s.bloques.map((b) => [b.ejercicio, b.series, b.pesos?.[0] ?? b.minutos ?? null]);
  if (caso === 'cinta') {
    await tel.r.elegirEjercicio('cinta');
    await tel.r.arrancarCardio();
  } else {
    await tel.r.elegirEjercicio('press_banca');
    if (caso === 'peso') await tel.r.elegirPeso(60);
    await tel.r.serieHecha({ sinDescanso: true });
    await tel.r.serieHecha({ sinDescanso: true });
  }
  await asentar();
  s.bloques = [...s.bloques, { ejercicio: 'remo_barra', series: 1 }];
  s.series += 1;
  servidor.falla.lecturas = true;
  await bloquearYDesbloquear();
  await dormir(400);
  await asentar();
  if (caso === 'dupla') {
    s.bloques = [...s.bloques, { ejercicio: 'sentadilla', series: 1 }];
    s.series += 1;
    servidor.falla.lecturas = false;
    await bloquearYDesbloquear();
    await dormir(400);
    await asentar();
    return { base: base(), series: s.series };
  }
  servidor.falla.lecturas = false;
  if (caso === 'peso') await tel.r.serieHecha({ sinDescanso: true });
  else {
    adelanto = 20 * 60000;
    await tel.r.cerrarVueltaDeCardio();
  }
  await dormir(300);
  await asentar();
  return { base: base(), series: s.series };
}

/**
 * `serieEnCinta` (vuelta 8): "+ Serie hecha" del descanso con una cinta que todavía
 * no arrancó. `sugerida`: la propone la rutina; `menos`: se arrancó y se apagó con el −.
 * No cuenta una serie ni guarda una vuelta sin minutos.
 */
async function serieEnCinta(caso) {
  const real = Date.now;
  let adelanto = 0;
  Date.now = () => real() + adelanto;
  servidor.version = 82;
  servidor.visibles = ['press_banca', 'cinta', 'remo_barra'];
  servidor.porTiempo = ['cinta'];
  if (caso === 'sugerida') {
    const { hoyISO, restarDias } = await import('@nucleo/fechas');
    servidor.ultimoEjercicio = 'press_banca';
    servidor.historial = [{ bloques: [{ ejercicio: 'press_banca' }, { ejercicio: 'cinta' }], logs: { fecha: restarDias(hoyISO(), 7) } }];
  }
  const tel = montar(() => useSesion());
  await asentar();
  await tel.r.empezar();
  await asentar();
  await dormir(400);
  await asentar();
  if (tel.r.estado.bloques.ejercicio !== 'press_banca') await tel.r.elegirEjercicio('press_banca');
  await tel.r.serieHecha();
  await asentar();
  tel.r.cerrarDescanso();
  await tel.r.bloqueSiguiente();
  await asentar();
  if (caso !== 'sugerida') await tel.r.elegirEjercicio('cinta');
  if (caso === 'menos') {
    await tel.r.arrancarCardio();
    adelanto = 20000;
    await tel.r.deshacerSerie();
  }
  await asentar();
  if (!tel.r.estado.descanso) await tel.r.descansarSuelto();
  await asentar();
  adelanto += 30000;
  await tel.r.serieHecha();
  await asentar();
  const s = servidor.sesiones[0];
  return { enCurso: [tel.r.estado.bloques.ejercicio, tel.r.estado.bloques.hechas], series: s.series, base: s.bloques.map((b) => [b.ejercicio, b.series]) };
}

/**
 * `cantidades` (vuelta 7, de la lista de OTA): la rutina guardada de hoy dice press
 * de banca 4 series y cinta 30 min. La semilla trae la meta 4 y la cinta propuesta, 30.
 */
async function cantidades() {
  datos.set('ascent:perfil', JSON.stringify({ id: 'yo', username: 'yo', racha_actual: 1, unidad_peso: 'kg' }));
  const dias = Array.from({ length: 7 }, () => ({ descanso: false, ejercicios: [] }));
  dias[new Date(Date.now()).getDay()] = { descanso: false, ejercicios: [{ ejercicio: 'press_banca', series: 4 }, { ejercicio: 'cinta', series: 1, minutos: 30 }] };
  datos.set('ascent:rutina-activa', JSON.stringify({ de: 'yo', dias }));
  const tel = montar(() => useSesion());
  await asentar();
  await tel.r.empezar();
  await dormir(400);
  await asentar();
  const semilla = [tel.r.estado.bloques.ejercicio, tel.r.estado.bloques.meta];
  for (let i = 0; i < 4; i++) await tel.r.serieHecha({ sinDescanso: true });
  await tel.r.bloqueSiguiente();
  await asentar();
  return { semilla, propuesta: [tel.r.estado.bloques.ejercicio, tel.r.estado.bloques.minutos ?? null, tel.r.estado.sugerido] };
}

/** `yaCorria`: la sesión ya corría (empezada en otro lado) y se toca Empezar: se sigue con esa, sin cartel. */
async function yaCorria() {
  const inicio = montar(() => useSesion());
  await asentar();
  const ahora = new Date().toISOString();
  servidor.sesiones.push({ id: 'sesion-de-otro-lado', inicio: ahora, series: 2, bloques: [], estado: 'corriendo', ultima_actividad: ahora, origen: 'manual', cerro_sola: false });
  const ok = await inicio.r.empezar();
  await asentar();
  return { ok, corre: inicio.r.estado.corriendo ?? null, vivas: servidor.sesiones.filter((s) => s.estado === 'corriendo').length, aviso: inicio.r.estado.aviso };
}

/**
 * `viejas`: LAS DOS RESPUESTAS VIEJAS que siguen abiertas (spec/alcance.md, "Un
 * solo dueño"). Una pregunta a la base sale, y mientras viaja se toca un botón:
 *  - `no-hay`: la respuesta "no hay sesión" sale ANTES de Iniciar y llega DESPUÉS.
 *    Después se suma una serie: tiene que llegar a la base.
 *  - `corre`: la respuesta "está corriendo" sale ANTES de Terminar y llega DESPUÉS.
 * Con `vigilante`, hay dos instancias montadas (el vigilante primero): la
 * pregunta vieja es la del vigilante y el toque es en Inicio.
 * Devuelve lo que muestra cada pantalla, lo que queda en la caché y lo que dice la base.
 */
async function viejas(caso, variante) {
  const conVigilante = variante === 'vigilante';
  let inicio = null;
  let vigilante = null;
  const resultado = (tocado) => {
    const viva = servidor.sesiones.find((s) => s.estado === 'corriendo');
    const r = { tocado, pantallaCorre: inicio.r.estado.corriendo, baseCorre: !!viva, cacheId: cache()?.id ?? null };
    if (conVigilante) r.vigilanteCorre = vigilante.r.estado.corriendo;
    if (caso === 'no-hay') Object.assign(r, { pantallaSeries: inicio.r.estado.series, baseSeries: viva?.series ?? null });
    return r;
  };
  if (caso === 'no-hay') {
    // Sin sesión, la pregunta que hay es la del arranque: el toque cae mientras viaja.
    let tocado = false;
    servidor.antesDeResponder.mi_sesion = async () => {
      if (tocado || !inicio) return;
      tocado = true;
      await inicio.r.empezar();
    };
    if (conVigilante) vigilante = montar(() => useSesion());
    inicio = montar(() => useSesion());
    await asentar();
    await dormir(200);
    await asentar();
    await inicio.r.serieHecha({ sinDescanso: true });
    await asentar();
    await dormir(100);
    await asentar();
    return resultado(tocado);
  }
  if (conVigilante) vigilante = montar(() => useSesion());
  inicio = montar(() => useSesion());
  await asentar();
  await inicio.r.empezar();
  await asentar();
  await inicio.r.serieHecha({ sinDescanso: true });
  await asentar();
  let tocado = false;
  servidor.antesDeResponder.mi_sesion = async () => {
    if (tocado) return;
    tocado = true;
    await inicio.r.terminar();
  };
  await bloquearYDesbloquear();
  await asentar();
  await dormir(200);
  await asentar();
  return resultado(tocado);
}

const [escenario, ...argumentos] = process.argv.slice(2);

/** El reloj de este proceso pasa a ser el del lunes de esta semana, a la misma hora (`new Date()` y `Date.now`). */
function relojDeLunes() {
  const Real = Date;
  const lunes = new Real();
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  const corrimiento = lunes.getTime() - Real.now();
  globalThis.Date = class extends Real {
    constructor(...a) {
      if (a.length === 0) super(Real.now() + corrimiento);
      else super(...a);
    }
    static now() {
      return Real.now() + corrimiento;
    }
  };
}

// Una rutina de dos días: lunes A y sentadilla; martes remo y dominadas (0 = domingo, como getDay).
function rutinaDeDosDias(primero = 'press_banca') {
  const dias = Array.from({ length: 7 }, () => ({ descanso: false, ejercicios: [] }));
  dias[1] = { descanso: false, ejercicios: [{ ejercicio: primero, series: 3 }, { ejercicio: 'sentadilla', series: 3 }] };
  dias[2] = { descanso: false, ejercicios: [{ ejercicio: 'remo', series: 3 }, { ejercicio: 'dominadas', series: 3 }] };
  return dias;
}

/**
 * `rutinaDelDia` (20/10, bug del gimnasio: "hoy es lunes y la sesión arrancó la rutina del
 * martes"). Con el reloj de un lunes y una rutina guardada de lunes y martes, se empieza la
 * sesión y se mira qué propone. El martes pasado se entrenó la del martes.
 *  - `conCopia`: el teléfono tiene la copia de la rutina activa.
 *  - `sinCopia`: no la tiene (recién entró, o nunca abrió la rutina en este aparato); la
 *    base sí la tiene.
 */
async function rutinaDelDia(variante) {
  relojDeLunes();
  servidor.version = 82;
  datos.set('ascent:perfil', JSON.stringify({ id: 'yo', username: 'yo', racha_actual: 1, unidad_peso: 'kg' }));
  const dias = rutinaDeDosDias();
  servidor.rutinas = [{ id: 'r1', nombre: 'Entrenamiento 1', activa: true, dias }];
  if (variante === 'conCopia') datos.set('ascent:rutina-activa', JSON.stringify({ de: 'yo', id: 'r1', dias }));
  const { hoyISO, restarDias } = await import('@nucleo/fechas');
  servidor.historial = [{ bloques: [{ ejercicio: 'remo', series: 3 }, { ejercicio: 'dominadas', series: 3 }], logs: { fecha: restarDias(hoyISO(), 6) } }];
  const inicio = montar(() => useSesion());
  await asentar();
  await inicio.r.empezar();
  await dormir(500);
  await asentar();
  return { dia: new Date().getDay(), propone: inicio.r.estado.bloques.ejercicio, sugerido: inicio.r.estado.sugerido };
}

/**
 * `primerEjercicio` (20/10, bug del gimnasio: "cambié el primer ejercicio de la rutina y me
 * editó todo; la recomendación siguió dando el de antes"). Lunes, rutina con press de banca
 * primero; se empieza, se cambia por press inclinado en la primera serie, se termina, se
 * contesta la ventana y se empieza otra sesión.
 *  - modo `antes`: se elige el otro antes de sumar la serie.
 *  - modo `despues`: la serie se suma con el sugerido y después «Eran de press inclinado».
 *  - ventana `reemplazar` | `nueva` | `olvidar` | `nada`: lo que se contesta al terminar.
 */
async function primerEjercicio(modo, ventana, copia = 'conCopia') {
  relojDeLunes();
  servidor.version = 82;
  datos.set('ascent:perfil', JSON.stringify({ id: 'yo', username: 'yo', racha_actual: 1, unidad_peso: 'kg' }));
  const dias = rutinaDeDosDias('press_banca');
  servidor.rutinas = [{ id: 'r1', nombre: 'Entrenamiento 1', activa: true, dias }];
  // `sinCopia`: el teléfono todavía no tiene la copia de la rutina (como en `rutinaDelDia`).
  if (copia === 'conCopia') datos.set('ascent:rutina-activa', JSON.stringify({ de: 'yo', id: 'r1', dias }));
  const { hoyISO, restarDias } = await import('@nucleo/fechas');
  servidor.historial = [{ bloques: [{ ejercicio: 'remo', series: 3 }, { ejercicio: 'dominadas', series: 3 }], logs: { fecha: restarDias(hoyISO(), 6) } }];
  const { diaDeLaSesion, hayQuePreguntarPorLaRutina, rutinaTrasLaVentana } = await import('@nucleo/rutina');
  const inicio = montar(() => useSesion());
  await asentar();
  await inicio.r.empezar();
  await dormir(500);
  await asentar();
  const sugeridoAlEmpezar = inicio.r.estado.bloques.ejercicio;
  if (modo === 'antes') {
    await inicio.r.elegirEjercicio('press_inclinado');
    await inicio.r.serieHecha({ sinDescanso: true });
  } else {
    await inicio.r.serieHecha({ sinDescanso: true });
    await inicio.r.mudarSeries('press_inclinado');
  }
  await inicio.r.serieHecha({ sinDescanso: true });
  await asentar();
  const cierre = await inicio.r.terminar();
  await asentar();
  // La ventana del final, con las mismas reglas que `preguntarPorLaRutina` (la nativa).
  const dia = new Date().getDay();
  const hecho = diaDeLaSesion(cierre?.bloques ?? []);
  const pregunta = hayQuePreguntarPorLaRutina(dias[dia], hecho);
  let diasDespues = dias;
  // «Olvidar este día» (20/10): la misma regla que la app; no queda nada que guardar.
  const tras = pregunta && ventana !== 'nada' ? rutinaTrasLaVentana(dias, dia, hecho, ventana) : null;
  if (tras && ventana === 'reemplazar') {
    diasDespues = tras;
    servidor.rutinas = [{ id: 'r1', nombre: 'Entrenamiento 1', activa: true, dias: diasDespues }];
    datos.set('ascent:rutina-activa', JSON.stringify({ de: 'yo', id: 'r1', dias: diasDespues }));
  }
  if (tras && ventana === 'nueva') servidor.rutinas = [...servidor.rutinas, { id: 'r2', nombre: 'Entrenamiento 2', activa: false, dias: tras }];
  const otra = montar(() => useSesion());
  await asentar();
  await otra.r.empezar();
  await dormir(500);
  await asentar();
  return {
    sugeridoAlEmpezar,
    hecho: hecho.ejercicios.map((e) => [e.ejercicio, e.series]),
    pregunta,
    diaDespues: diasDespues[dia].ejercicios.map((e) => e.ejercicio),
    martesDespues: diasDespues[2].ejercicios.map((e) => e.ejercicio),
    laOtraPropone: otra.r.estado.bloques.ejercicio,
  };
}

/**
 * `dueno`: EL DATO ES UNO (el dueño único, 15/10). Con el vigilante y la
 * pantalla montados, lo que toca la pantalla lo ve el vigilante en el render
 * siguiente, sin esperar a la caché —que tarda una vuelta del bucle de eventos—.
 * Con una copia por instancia, el vigilante iba atrás hasta releerla. Después se
 * toca desde el vigilante y se mira la pantalla: tiene que valer para los dos lados.
 */
/**
 * `repsUltimaVez` (20/10): las repeticiones de la última vez salen de la marca guardada en la
 * última sesión de ese ejercicio, y solo de las propias (la base también deja leer las de los
 * amigos). Remo: sesión ayer sin marca, marca de hace diez días → nada.
 */
async function repsUltimaVez() {
  servidor.version = 82;
  datos.set('ascent:perfil', JSON.stringify({ id: 'yo', username: 'yo', racha_actual: 1, unidad_peso: 'kg' }));
  const { hoyISO, restarDias } = await import('@nucleo/fechas');
  const hoy = hoyISO();
  servidor.historial = [
    { bloques: [{ ejercicio: 'press_banca', series: 3 }], logs: { fecha: restarDias(hoy, 3) } },
    { bloques: [{ ejercicio: 'remo', series: 3 }], logs: { fecha: restarDias(hoy, 1) } },
  ];
  servidor.marcas = [
    { user_id: 'yo', ejercicio: 'remo', peso: 80, reps: 6, fecha: restarDias(hoy, 10) },
    { user_id: 'yo', ejercicio: 'press_banca', peso: 60, reps: 8, fecha: restarDias(hoy, 10) },
    { user_id: 'yo', ejercicio: 'press_banca', peso: 62.5, reps: 5, fecha: restarDias(hoy, 3) },
    { user_id: 'amigo', ejercicio: 'press_banca', peso: 100, reps: 3, fecha: restarDias(hoy, 1) },
    { user_id: 'yo', ejercicio: 'press_banca', peso: 70, reps: 2, fecha: hoy },
    { user_id: 'yo', ejercicio: 'sentadilla', peso: 90, reps: 6, fecha: restarDias(hoy, 2) },
  ];
  const inicio = montar(() => useSesion());
  await asentar();
  await inicio.r.empezar();
  await dormir(500);
  await asentar();
  const r = (id) => {
    const m = inicio.r.repsDeLaUltimaVezDe(id);
    return m ? [m.peso, m.reps] : null;
  };
  return { press: r('press_banca'), sentadilla: r('sentadilla'), remo: r('remo') };
}

async function dueno() {
  const vigilante = montar(() => useSesion());
  const inicio = montar(() => useSesion());
  await asentar();
  const soloRender = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };
  const ver = (x) => ({ corriendo: x.r.estado.corriendo, series: x.r.estado.series, bloques: corto(x.r.estado.bloques) });
  await inicio.r.empezar();
  await soloRender();
  const alEmpezar = ver(vigilante);
  await inicio.r.elegirPeso(60);
  await inicio.r.serieHecha({ sinDescanso: true });
  await inicio.r.serieHecha({ sinDescanso: true });
  await soloRender();
  const trasDos = { pantalla: ver(inicio), vigilante: ver(vigilante) };
  await vigilante.r.serieHecha({ sinDescanso: true });
  await soloRender();
  const desdeElVigilante = ver(inicio);
  await asentar();
  return { alEmpezar, trasDos, desdeElVigilante, base: servidor.sesiones[0]?.series ?? null };
}

/**
 * `cruce`: BORRAR Y GUARDAR LA CACHÉ, EN LA MISMA FILA QUE ACTUALIZAR (15/10).
 * Un `actualizar` lee la caché; justo ahí se termina la sesión y se borra; el
 * `actualizar` guarda lo que había leído y la sesión terminada volvía a aparecer
 * en el teléfono. `guardar`: lo mismo con una sesión nueva que se guarda en el medio.
 */
async function cruce(cual) {
  const SC = await import('@compartido/sesionCache');
  const vieja = { inicio: new Date().toISOString(), desfasaje: 0, series: 1, id: 'sesion-1' };
  await SC.guardarSesionCache(vieja);
  const n0 = servidas.n;
  let enElMedio = null;
  servidas.alServir = (n) => {
    if (n !== n0 + 1 || enElMedio) return;
    enElMedio = cual === 'guardar'
      ? SC.guardarSesionCache({ ...vieja, id: 'sesion-2', series: 0 })
      : SC.borrarSesionCache();
  };
  await SC.actualizarSesionCache({ series: 2 });
  await enElMedio;
  servidas.alServir = null;
  const c = cache();
  return { cache: c ? [c.id, c.series] : null };
}

/**
 * `releerVieja` (paso 5 del refactor, 15/10): al desbloquear se relee la caché
 * —"no hay sesión"—, se toca Iniciar, y la lectura vacía llega DESPUÉS. No
 * puede sacar de la pantalla la sesión que acaba de empezar.
 */
async function releerVieja() {
  const inicio = montar(() => useSesion());
  await asentar();
  cambiarVisible(false);
  await asentar();
  cfg.demoraLeer = { 'ascent:sesion': 150 };
  cambiarVisible(true);
  cfg.demoraLeer = {};
  await inicio.r.empezar();
  await dormir(250);
  await asentar();
  const viva = servidor.sesiones.find((s) => s.estado === 'corriendo');
  return { pantallaCorre: inicio.r.estado.corriendo, baseCorre: !!viva, cacheId: cache()?.id ?? null };
}

/**
 * `fantasma` (paso 5 del refactor, 15/10): con el bloque siguiente propuesto
 * por la rutina —"fantasma"—, se desbloquea y se le pregunta a la base. La
 * respuesta es de la misma sesión: no le puede sacar el fantasma a la caché.
 */
async function fantasma() {
  servidor.ida.version_del_esquema = 300;
  servidor.falla.version_del_esquema = true;
  servidor.ultimoEjercicio = 'press_banca';
  const { hoyISO, restarDias } = await import('@nucleo/fechas');
  servidor.historial = [
    { bloques: [{ ejercicio: 'press_banca' }, { ejercicio: 'remo' }], logs: { fecha: restarDias(hoyISO(), 7) } },
  ];
  const inicio = montar(() => useSesion());
  await asentar();
  await inicio.r.empezar();
  await dormir(700);
  await asentar();
  await inicio.r.serieHecha({ sinDescanso: true });
  await asentar();
  await inicio.r.bloqueSiguiente();
  await dormir(120);
  await asentar();
  const antes = [inicio.r.estado.sugerido, cache()?.sugerido ?? null];
  await bloquearYDesbloquear();
  await dormir(200);
  await asentar();
  return { antes, despues: [inicio.r.estado.sugerido, cache()?.sugerido ?? null] };
}

const resultado = await { bloques, refresco, releer, eleccion, hoja, turno, senal, copia, cardio, yaCorria, viejas, dueno, cruce, releerVieja, fantasma, cronometro, cardioLargo, descansoLargo, vueltaDos, vueltaTres, vueltaCuatro, vueltaCinco, vueltaSeis, vueltaSiete, vueltaOcho, serieEnCinta, cantidades, rutinaDelDia, primerEjercicio, repsUltimaVez }[escenario](...argumentos);
console.log(JSON.stringify(resultado));
// El hook deja un intervalo andando mientras hay sesión: se corta acá.
process.exit(0);
