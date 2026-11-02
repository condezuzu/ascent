// LOS GRÁFICOS DE LÍNEA (1/11): el progreso de un ejercicio (la pantalla nueva, propuesta 13 de la
// galería) y la gráfica de peso, con el tiempo a escala y cada anotación sobre la línea.
//
// En la vista web de la nativa, con una cuenta descartable. Lo real: la cuenta, los pesos, las marcas
// y una sesión de hoy guardada con `fijar_bloques`, que es lo que comprueba que la pantalla entiende
// lo que la base devuelve. Dos dobles: las sesiones de los meses pasados (una sesión solo puede
// empezar ahora) y Salud (ningún navegador ve los pasos).
//
// Lo que NO mide: el iPhone. El dedo es un ratón acá, y volver deslizando no se puede probar.
//
//   node --env-file=.env.local supabase/probar-progreso.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(10);

const AQUI = dirname(fileURLToPath(import.meta.url));
const nucleo = (a) => import(pathToFileURL(join(AQUI, '..', 'nucleo', a)).href);
const { TEXTOS_ES: TX } = await nucleo('textos.ts');
const { paletaDe } = await nucleo('paletas.ts');
const { cuerpoDe } = await nucleo('rangos.ts');
const { CLAVE_OBJETIVO_PESO } = await nucleo('pesoObjetivo.ts');
const { fechaLinda } = await nucleo('fechas.ts');
const SALIDA = process.env.PROGRESO_SALIDA ?? null;
if (SALIDA) mkdirSync(SALIDA, { recursive: true });
const ROTOS = join(AQUI, '..', 'capturas', 'progreso');
mkdirSync(ROTOS, { recursive: true });
const sello = Date.now().toString(36);
let fallos = 0;
const chequear = (que, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : `: esperado ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`}`);
};

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const correo = `agusconde20+ascent-pg-${sello}@gmail.com`;
const clave = `Pg-${sello}-k9`;
const { error: eAlta } = await s.auth.signUp({ email: correo, password: clave });
if (eAlta) {
  console.log('No se pudo crear la cuenta:', eAlta.message);
  process.exit(1);
}
const uid = (await s.auth.getUser()).data.user.id;
await s.from('profiles').update({ username: `pg_${sello.slice(-6)}`, sexo: 'm' }).eq('id', uid);
const HOY = (await s.rpc('mi_hoy')).data;
const dia = (n) => {
  const d = new Date(`${HOY}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};
const dias = [];
for (let a = 8; a >= 1; a--) dias.push({ user_id: uid, fecha: dia(a) });
await s.from('logs').insert(dias);
await s.rpc('recalcular_desde_cero');

// Lo real: una sesión de hoy. La serie más pesada es la segunda, y la tercera empata con menos reps.
const sesionDeHoy = (await s.rpc('iniciar_sesion')).data?.id;
await s.rpc('fijar_series', { p_sesion: sesionDeHoy, p_series: 3 });
await s.rpc('fijar_bloques', { p_sesion: sesionDeHoy, p_bloques: [{ ejercicio: 'press_banca', series: 3, pesos: [60, 65, 65], reps: [8, 6, 5], carga: 'total' }] });
await s.rpc('terminar_sesion');

// La sentadilla tiene 120 anotados a mano, por encima de cualquier sesión.
await s.from('prs').insert([
  { user_id: uid, ejercicio: 'sentadilla', peso: 120, reps: 3, es_real: false, fecha: dia(13) },
  { user_id: uid, ejercicio: 'press_militar', peso: 50, reps: 5, es_real: false, fecha: dia(47) },
]);

// Los pesos: cada dos o tres días, bajando con ruido, y un hueco de tres semanas en el medio. El de
// hoy es real (`anotar_peso` anota solo hoy); los de antes son un doble, como las sesiones.
const ruido = [0.4, -0.3, 0.6, -0.5, 0.1, 0.5, -0.2, -0.6, 0.3, 0];
const pesosViejos = [];
for (let a = 118, i = 0; a >= 1; a -= i === 19 ? 22 : i % 2 === 0 ? 2 : 3, i++) {
  pesosViejos.push({ fecha: dia(a), valor: Math.round((78 + a * 0.035 + ruido[i % ruido.length]) * 10) / 10 });
}
await s.rpc('anotar_peso', { p_valor: 78.3 });
const pesos = [...pesosViejos, { fecha: HOY, valor: 78.3 }];

// Las sesiones de antes. Cada una con una serie más liviana de entrada: no tiene que ganar.
const PASOS = [4, 3, 7, 5, 6];
const historia = (ejercicio, atras, kilos, reps, carga = 'total', corte = -1, hueco = 0) => {
  const filas = [];
  let a = atras;
  for (let i = kilos.length - 1; i >= 0; i--) {
    const r = reps[i % reps.length];
    filas.unshift({ fecha: dia(a), bloques: [{ ejercicio, series: 3, pesos: [Math.round(kilos[i] * 0.7), kilos[i], kilos[i]], reps: [10, r, r - 1], carga }] });
    a += i === corte ? hueco : PASOS[i % PASOS.length];
  }
  return filas;
};
const BANCA = historia('press_banca', 2, [40, 40, 42.5, 42.5, 45, 45, 45, 47.5, 47.5, 50, 50, 50, 52.5, 50, 52.5, 52.5, 55, 50, 52.5, 52.5, 55, 55, 55, 57.5, 57.5, 60, 57.5, 60, 60, 60, 62.5, 60, 67.5, 62.5], [8, 8, 6, 8, 6, 8, 5], 'total', 17, 21);
const SENTADILLA = historia('sentadilla', 1, [60, 60, 65, 65, 70, 70, 70, 75, 75, 80, 80, 85, 85, 85, 90, 90, 95, 95, 90, 95, 100, 100, 105, 105, 110, 110], [8, 8, 6, 8, 6, 5]);
const MUERTO = historia('peso_muerto', 4, [100], [5]);
const CURL = historia('curl_mancuernas', 5, [10, 10, 12, 12, 12, 14, 14, 14, 14, 16, 16, 16, 18, 18], [10, 10, 8, 10, 8], 'par');
// Una sesión de banca sin un solo peso: no es cero, así que no dibuja nada.
const SIN_PESO = { fecha: dia(3), bloques: [{ ejercicio: 'press_banca', series: 3, carga: 'total' }] };
const ANTES = [...BANCA, ...SENTADILLA, ...MUERTO, ...CURL, SIN_PESO];

console.log('Los gráficos de línea');
const nav = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader=false'] });
let page = null;
try {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: SALIDA ? 2 : 1, locale: 'es-UY', timezoneId: 'America/Montevideo' });
  await ctx.addInitScript(([hoy]) => {
    const dias = Array.from({ length: 60 }, (_, i) => {
      const d = new Date(`${hoy}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - (59 - i));
      return { fecha: d.toISOString().slice(0, 10), valor: 6000 + ((i * 2731) % 6000) };
    });
    window.__saludDePrueba = new Proxy({}, {
      get: (_, k) => (k === 'disponible' ? () => true : k === 'pasosPorDia' ? async () => dias : k === 'pasosDe' ? async () => 7100 : k === 'yaSePidio' ? async () => true : async () => null),
    });
  }, [HOY]);
  page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)));
  await page.route((u) => u.pathname.endsWith('/rest/v1/sesiones') && decodeURIComponent(u.search).includes('logs(fecha)'), async (route) => {
    const r = await route.fetch();
    const reales = await r.json().catch(() => []);
    const dobles = ANTES.map((f, i) => ({ id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`, bloques: f.bloques, logs: { fecha: f.fecha } }));
    await route.fulfill({ response: r, json: [...reales, ...dobles] });
  });
  await page.route((u) => u.pathname.endsWith('/rest/v1/weights'), async (route) => {
    const r = await route.fetch();
    const reales = await r.json().catch(() => []);
    await route.fulfill({ response: r, json: [...pesosViejos, ...reales] });
  });
  const foto = async (n) => {
    if (SALIDA) await page.screenshot({ path: join(SALIDA, `${n}.png`) });
  };
  const texto = (t) => page.getByText(t, { exact: true }).last();
  const leer = (id) => page.getByTestId(id).first().innerText();
  const coma = (n) => String(n).replace('.', ',');

  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.evaluate(([u, clave]) => {
    localStorage.setItem(`ascent:guia:${u}`, JSON.stringify({ uid: u, recorrido: true, paso: 0, globos: ['elegir', 'series', 'descanso', 'peso', 'terminar', 'carga', 'sugerido', 'mas', 'album', 'amigos', 'rutina', 'pasos', 'calendario'] }));
    localStorage.setItem(clave, '78');
  }, [uid, CLAVE_OBJETIVO_PESO]);
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await page.getByText(TX.entrar.entrar, { exact: true }).last().click({ timeout: 60000 });
  await page.getByText(TX.inicio.iniciarEntrenamiento, { exact: true }).first().waitFor({ timeout: 120000 });
  await page.waitForTimeout(2200);
  const ceremonia = page.locator('[aria-modal="true"]');
  for (let i = 0; i < 12 && (await ceremonia.count()) > 0; i++) {
    await page.mouse.click(195, 420);
    await page.waitForTimeout(1000);
  }

  // ---- LA GRÁFICA DE PESO ----
  console.log('La gráfica de peso');
  await texto(TX.nav.stats).click({ timeout: 30000 });
  const lienzoPeso = page.getByTestId('peso-lienzo').first();
  await lienzoPeso.waitFor({ timeout: 60000 });
  await lienzoPeso.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await foto('1-peso');
  chequear('un punto por cada anotación', await page.locator('[data-testid="peso-lienzo"] [data-testid="grafico-anotaciones"] circle').count(), pesos.length);
  const xsPeso = await page.locator('[data-testid="peso-lienzo"] [data-testid="grafico-anotaciones"] circle').evaluateAll((c) => c.map((n) => Number(n.getAttribute('cx'))));
  // El hueco de tres semanas: entre esos dos puntos hay mucho más aire que entre dos seguidos.
  const huecos = xsPeso.slice(1).map((x, i) => x - xsPeso[i]);
  const mayor = Math.max(...huecos);
  chequear('el tiempo va a escala: tres semanas sin pesarse se ven', mayor > 5 * Math.min(...huecos), true);
  const rotulos = (await page.getByTestId('grafico-eje').first().innerText()).split('\n').filter(Boolean);
  chequear('abajo dice cuándo', rotulos.length >= 2 && rotulos.every((r) => /^[a-zñ]{3}$/.test(r)), true);
  const lineasEscala = await page.locator('[data-testid="peso-lienzo"] line').count();
  chequear('hay líneas de escala', lineasEscala >= 3, true);
  chequear('el objetivo es una línea punteada, adentro del dibujo', await page.locator('[data-testid="peso-lienzo"] line[stroke-dasharray]').count(), 1);
  const alto = await lienzoPeso.evaluate((n) => n.getBoundingClientRect().height);
  chequear('ya no es una tira de 84 px', alto >= 140, true);

  const cifraPeso = await leer('peso-cifra');
  const detallePeso = await leer('peso-detalle');
  chequear('sin tocar: la tendencia, y cuánto cambió', detallePeso.includes('anotaciones'), true);
  const cajaPeso = await lienzoPeso.boundingBox();
  const k = 6;
  await page.mouse.click(cajaPeso.x + xsPeso[k], cajaPeso.y + 70);
  await page.waitForTimeout(200);
  chequear('tocar lee lo que pesaste ese día, crudo', await leer('peso-cifra'), `${coma(pesos[k].valor.toFixed(1))} kg`);
  chequear('y qué día fue', await leer('peso-detalle'), fechaLinda(pesos[k].fecha));
  await foto('2-peso-tocado');
  await page.waitForTimeout(600);
  chequear('al soltar queda elegido', await leer('peso-detalle'), fechaLinda(pesos[k].fecha));
  await page.mouse.click(cajaPeso.x + xsPeso[k], cajaPeso.y + 70);
  await page.waitForTimeout(200);
  chequear('tocarlo de nuevo lo suelta', [await leer('peso-cifra'), await leer('peso-detalle')], [cifraPeso, detallePeso]);
  await page.mouse.move(cajaPeso.x + xsPeso[2], cajaPeso.y + 70);
  await page.mouse.down();
  await page.mouse.move(cajaPeso.x + xsPeso[12], cajaPeso.y + 70, { steps: 6 });
  await page.waitForTimeout(100);
  chequear('arrastrar lee el punto que queda abajo', await leer('peso-detalle'), fechaLinda(pesos[12].fecha));
  await page.mouse.up();
  await texto(TX.stats.pesoMes).click();
  await page.waitForTimeout(1000);
  const enElMes = pesos.filter((p) => p.fecha >= dia(30)).length;
  chequear('un mes: solo sus puntos', await page.locator('[data-testid="peso-lienzo"] [data-testid="grafico-anotaciones"] circle').count(), enElMes);
  chequear('y cambiar de rango suelta lo elegido', (await leer('peso-detalle')).includes('anotaciones'), true);
  await foto('3-peso-mes');
  chequear('VoiceOver lo recorre: es un control con su valor', await lienzoPeso.evaluate((n) => [n.getAttribute('role'), n.getAttribute('aria-label')]), ['slider', TX.stats.pesoTendencia]);
  await texto(TX.stats.pesoTodo).click();

  // ---- LOS PASOS ----
  console.log('Los pasos');
  const barras = texto(TX.stats.pasosMes);
  await barras.scrollIntoViewIfNeeded();
  await barras.click();
  await page.waitForTimeout(1100);
  const lienzoPasos = page.getByTestId('pasos-lienzo').first();
  await lienzoPasos.waitFor({ timeout: 10000 });
  await lienzoPasos.scrollIntoViewIfNeeded();
  await foto('4-pasos');
  chequear('las mismas piezas: línea, escala y fechas', [await page.locator('[data-testid="pasos-lienzo"] path').count() >= 2, (await page.getByTestId('grafico-eje').last().innerText()).trim().length > 0], [true, true]);
  chequear('la escala en miles', (await lienzoPasos.innerText()).split('\n').some((t) => /^\d+(,\d)?k$/.test(t)), true);

  // ---- LA LISTA ----
  console.log('La lista de máximos');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByText(TX.stats.pestanaEntrenamiento, { exact: true }).first().click({ timeout: 20000 });
  const filaBanca = page.getByTestId('fila-maximo-press_banca').first();
  await filaBanca.waitFor({ timeout: 30000 });
  await filaBanca.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await foto('5-lista');
  chequear('la fila con peso lleva su línea', await filaBanca.locator('[data-testid="linea-chiquita"] path').count(), 1);
  chequear('una sola sesión: un punto y lo que va a haber', await page.getByTestId('fila-maximo-peso_muerto').first().locator('[data-testid="linea-chiquita"] circle[fill]:not([fill="none"])').count(), 1);
  chequear('solo una marca: el punto hueco', await page.getByTestId('fila-maximo-press_militar').first().locator('[data-testid="linea-chiquita"] circle[fill="none"]').count(), 1);
  chequear('una sin peso no se toca', await page.getByTestId('fila-maximo-dominadas').count(), 0);
  chequear('la fila dice para VoiceOver qué abre', await filaBanca.evaluate((n) => n.getAttribute('role')), 'button');

  // ---- BANCA ----
  console.log('Banca, muchas sesiones');
  await filaBanca.click();
  await page.getByTestId('progreso-lienzo').first().waitFor({ timeout: 20000 });
  chequear('se entra a la pantalla de ese ejercicio', page.url().endsWith('/progreso/press_banca'), true);
  await page.waitForTimeout(80);
  chequear('la línea se dibuja de a poco', await page.locator('[data-testid="progreso-linea"] path').first().getAttribute('stroke-dasharray').then((v) => v !== null), true);
  await page.waitForTimeout(1100);
  chequear('y después es una línea común', await page.locator('[data-testid="progreso-linea"] path').first().getAttribute('stroke-dasharray'), null);
  await foto('6-banca');
  const sesionesBanca = BANCA.length + 1;
  chequear('el nombre', await leer('progreso-nombre'), 'Press de banca');
  chequear('el número es lo último que hiciste: la sesión real de hoy, su serie más pesada', [await leer('progreso-cifra'), await leer('progreso-unidad')], ['65', 'kg']);
  chequear('con las reps de la mejor de esas series, y el día', await leer('progreso-cuando'), `${TX.progreso.reps(6)} · ${fechaLinda(HOY)}`);
  chequear('cuántas sesiones y cuánto subió, con signo', await leer('progreso-cambio'), TX.progreso.cambio(sesionesBanca, '+25', 'kg'));
  const trazoDe = async () => {
    const d = await page.locator('[data-testid="progreso-linea"] path').first().getAttribute('d');
    return d.split(/[ML]\s*/).filter(Boolean).map((p) => p.trim().split(',').map(Number));
  };
  const puntosBanca = await trazoDe();
  chequear('un punto por sesión con peso: la de sin peso no dibuja nada', puntosBanca.length, sesionesBanca);
  const dx = puntosBanca.slice(1).map((p, i) => p[0] - puntosBanca[i][0]);
  chequear('el tiempo va a escala: las tres semanas sin banca se ven', Math.max(...dx) > 2.5 * [...dx].sort((a, b) => a - b)[Math.floor(dx.length / 2)], true);
  chequear('el récord dice su peso, no el de la última', await leer('progreso-record'), '67,5');
  chequear('y la línea punteada marca hasta dónde llegaste', await page.locator('[data-testid="progreso-lienzo"] line[stroke-dasharray]').count(), 1);
  chequear('la primera dice de dónde saliste', await leer('progreso-primero'), '40');
  const { rango, planeta } = cuerpoDe((await s.from('profiles').select('racha_actual').eq('id', uid).single()).data.racha_actual);
  chequear('la línea es del color del rango', (await page.locator('[data-testid="progreso-linea"] path').first().getAttribute('stroke')).toLowerCase(), paletaDe(rango, planeta).claro.toLowerCase());
  chequear('VoiceOver: un control con su valor', await page.getByTestId('progreso-lienzo').first().evaluate((n) => [n.getAttribute('role'), n.getAttribute('aria-label')]), ['slider', TX.progreso.grafico('Press de banca')]);

  const caja = await page.getByTestId('progreso-lienzo').first().boundingBox();
  const i = 9;
  await page.mouse.click(caja.x + puntosBanca[i][0], caja.y + puntosBanca[i][1]);
  await page.waitForTimeout(200);
  const hecho = BANCA[i];
  chequear('tocar lee esa sesión', [await leer('progreso-cifra'), (await leer('progreso-cuando')).endsWith(fechaLinda(hecho.fecha))], [coma(hecho.bloques[0].pesos[1]), true]);
  await foto('7-banca-tocada');
  chequear('queda elegido al soltar', await page.getByTestId('grafico-elegido').count(), 1);
  await page.mouse.click(caja.x + puntosBanca[i][0], caja.y + puntosBanca[i][1]);
  await page.waitForTimeout(200);
  chequear('tocarlo de nuevo lo suelta', [await page.getByTestId('grafico-elegido').count(), await leer('progreso-cifra')], [0, '65']);
  await page.mouse.click(caja.x + puntosBanca[20][0], caja.y + puntosBanca[20][1]);
  await page.waitForTimeout(150);
  await page.getByTestId('progreso-nombre').first().click();
  await page.waitForTimeout(150);
  chequear('tocar afuera también', await page.getByTestId('grafico-elegido').count(), 0);
  await page.mouse.move(caja.x + puntosBanca[5][0], caja.y + 120);
  await page.mouse.down();
  await page.mouse.move(caja.x + puntosBanca[25][0], caja.y + 120, { steps: 8 });
  await page.waitForTimeout(100);
  chequear('arrastrar recorre las sesiones', (await leer('progreso-cuando')).endsWith(fechaLinda(BANCA[25].fecha)), true);
  await page.mouse.up();
  await page.waitForTimeout(150);
  chequear('arrastrar y soltar no lo suelta', await page.getByTestId('grafico-elegido').count(), 1);

  const enUnMes = BANCA.filter((f) => f.fecha >= dia(30)).length + 1;
  await page.getByTestId('progreso-rango-30').first().click();
  await page.waitForTimeout(1100);
  chequear('un mes: solo sus sesiones', (await trazoDe()).length, enUnMes);
  chequear('y lo elegido se suelta', await page.getByTestId('grafico-elegido').count(), 0);
  await foto('8-banca-mes');
  await page.getByTestId('progreso-rango-todo').first().click();
  await page.waitForTimeout(1100);
  chequear('todo: de vuelta', (await trazoDe()).length, sesionesBanca);

  await page.getByText(TX.general.volver, { exact: true }).first().click();
  await filaBanca.waitFor({ timeout: 20000 });
  chequear('volver lleva a la lista, en Entrenamiento', await page.getByTestId('fila-maximo-sentadilla').count(), 1);

  // ---- CON UNA MARCA ----
  console.log('Sentadilla, con una marca anotada a mano');
  await page.getByTestId('fila-maximo-sentadilla').first().click();
  await page.getByTestId('progreso-lienzo').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1100);
  await foto('9-sentadilla');
  chequear('la marca es un punto suelto', await page.getByTestId('progreso-marca').count(), 1);
  chequear('que no entra en la línea', (await trazoDe()).length, SENTADILLA.length);
  chequear('el récord es la marca, igual que en la lista', await leer('progreso-record'), '120');
  const hueco = await page.getByTestId('progreso-marca').first().boundingBox();
  await page.mouse.click(hueco.x + hueco.width / 2, hueco.y + hueco.height / 2);
  await page.waitForTimeout(200);
  chequear('tocarla la lee, y dice que es una marca', [await leer('progreso-cifra'), await leer('progreso-cambio'), await leer('progreso-cuando')], ['120', TX.progreso.marca, `${TX.progreso.reps(3)} · ${fechaLinda(dia(13))}`]);
  await page.getByText(TX.general.volver, { exact: true }).first().click();

  // ---- UNA SOLA SESIÓN ----
  console.log('Peso muerto, una sola sesión');
  await page.getByTestId('fila-maximo-peso_muerto').first().click();
  await page.getByTestId('progreso-lienzo').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(900);
  await foto('10-una-sesion');
  chequear('el número y una sesión', [await leer('progreso-cifra'), await leer('progreso-cambio')], ['100', TX.progreso.sesiones(1)]);
  chequear('sin línea, con lo que va a haber', [await page.getByTestId('progreso-linea').count(), await page.locator('[data-testid="progreso-lienzo"] path[stroke-dasharray]').count()], [0, 1]);
  chequear('sin rangos: no hay nada que elegir', await page.getByTestId('progreso-rango-todo').count(), 0);
  await page.getByText(TX.general.volver, { exact: true }).first().click();

  // ---- CON MANCUERNAS ----
  console.log('Curl con mancuernas');
  const filaCurl = page.getByTestId('fila-maximo-curl_mancuernas').first();
  await filaCurl.scrollIntoViewIfNeeded();
  await filaCurl.click();
  await page.getByTestId('progreso-lienzo').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1100);
  await foto('11-curl');
  chequear('el número es lo que se agarró, y lo dice', [await leer('progreso-cifra'), await leer('progreso-unidad')], ['18', 'kg por mancuerna']);
  chequear('el cambio también', (await leer('progreso-cambio')).includes('+8 kg'), true);
  await page.getByText(TX.general.volver, { exact: true }).first().click();

  // ---- SOLO UNA MARCA ----
  console.log('Press militar, solo una marca');
  const filaMilitar = page.getByTestId('fila-maximo-press_militar').first();
  await filaMilitar.scrollIntoViewIfNeeded();
  await filaMilitar.click();
  await page.getByTestId('progreso-lienzo').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(900);
  await foto('12-solo-marca');
  chequear('el número, y que es una marca', [await leer('progreso-cifra'), await leer('progreso-cambio')], ['50', TX.progreso.marca]);
  chequear('un punto hueco y nada de línea', [await page.getByTestId('progreso-marca').count(), await page.getByTestId('progreso-linea').count()], [1, 0]);

  // ---- ABIERTA DIRECTO ----
  console.log('Abierta directo, sin pasar por la lista');
  await page.goto('http://localhost:8090/progreso/press_banca', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByTestId('progreso-lienzo').first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(1100);
  chequear('pide lo suyo y dibuja lo mismo', [await leer('progreso-nombre'), await leer('progreso-cifra'), (await trazoDe()).length], ['Press de banca', '65', sesionesBanca]);
  await page.getByText(TX.general.volver, { exact: true }).first().click();
  await page.waitForTimeout(600);
  chequear('y volver no deja a nadie encerrado', page.url().includes('/progreso/'), false);

  chequear('sin errores de la página', errores, []);
} catch (e) {
  fallos++;
  const lineas = String(e).split('\n');
  for (const l of [lineas[0], ...lineas.slice(1).slice(-8)]) console.log('  FALLA ' + l.slice(0, 200));
  await page?.screenshot({ path: join(ROTOS, 'error.png'), timeout: 10000 }).catch(() => {});
}
await nav.close();
await s.rpc('terminar_sesion').then(() => {}, () => {});
const { error } = await borrarCuentaDePrueba(s);
if (error) {
  fallos++;
  console.log(`  FALLA cuenta: ${error.message}`);
}
console.log(`  ${fallos ? '' : 'ok   '}cuenta borrada`);
console.log(fallos ? `\n${fallos} con problemas.` : '\nLos gráficos de línea: bien');
process.exit(fallos ? 1 : 0);
