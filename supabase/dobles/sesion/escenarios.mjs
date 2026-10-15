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
/**
 * `dueno`: EL DATO ES UNO (el dueño único, 15/10). Con el vigilante y la
 * pantalla montados, lo que toca la pantalla lo ve el vigilante en el render
 * siguiente, sin esperar a la caché —que tarda una vuelta del bucle de eventos—.
 * Con una copia por instancia, el vigilante iba atrás hasta releerla. Después se
 * toca desde el vigilante y se mira la pantalla: tiene que valer para los dos lados.
 */
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

const resultado = await { bloques, refresco, releer, eleccion, hoja, turno, senal, copia, cardio, yaCorria, viejas, dueno, cruce, releerVieja, fantasma, cronometro }[escenario](...argumentos);
console.log(JSON.stringify(resultado));
// El hook deja un intervalo andando mientras hay sesión: se corta acá.
process.exit(0);
