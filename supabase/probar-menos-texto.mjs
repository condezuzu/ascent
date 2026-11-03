// MENOS TEXTO, MÁS VISUAL (31/10): las once propuestas de la sección 12 de la galería, de la A a la K.
// Por cada una, en la pantalla de verdad: la explicación escrita ya no se ve, el dibujo está y hace lo
// que dice, y VoiceOver sigue teniendo el texto (lo que se saca de la vista no se saca de quien no ve).
//
// En la vista web de la nativa, con una cuenta descartable. Dos dobles: Salud (ningún navegador ve los
// pasos, y la meta de pasos vive adentro de ese gráfico) y las sesiones de la semana (para la franja).
// El resto es lo real.
//
// Lo que NO mide: el iPhone. Los dibujos son los mismos, pero el gesto de arrastrar es con el ratón.
//
//   node --env-file=.env.local supabase/probar-menos-texto.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(12);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const { SERIES_POR_SEMANA } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'volumen.ts')).href);
const SALIDA = process.env.MENOS_SALIDA ?? null;
if (SALIDA) mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
let fallos = 0;
const chequear = (que, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : `: esperado ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`}`);
};

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const correo = `agusconde20+ascent-mt-${sello}@gmail.com`;
const clave = `Mt-${sello}-k9`;
const { error: eAlta } = await s.auth.signUp({ email: correo, password: clave });
if (eAlta) {
  console.log('No se pudo crear la cuenta:', eAlta.message);
  process.exit(1);
}
const uid = (await s.auth.getUser()).data.user.id;
await s.from('profiles').update({ username: `mt_${sello.slice(-6)}`, sexo: 'm' }).eq('id', uid);
const HOY = (await s.rpc('mi_hoy')).data;
const dia = (n) => { const d = new Date(`${HOY}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const filas = [];
for (let a = 8; a >= 1; a--) filas.push({ user_id: uid, fecha: dia(a) });
await s.from('logs').insert(filas);
await s.rpc('recalcular_desde_cero');
const unDia = { descanso: false, ejercicios: [{ ejercicio: 'press_banca', series: 3 }, { ejercicio: 'sentadilla', series: 3 }, { ejercicio: 'peso_muerto', series: 3 }] };
await s.rpc('guardar_rutina', { p_id: null, p_nombre: 'Prueba', p_dias: Array.from({ length: 7 }, () => unDia) });

console.log('Menos texto, más visual');
const nav = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader=false'] });
try {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: SALIDA ? 2 : 1, locale: 'es-UY', timezoneId: 'America/Montevideo' });
  // Los pasos de una semana: el doble de Salud, antes de que cargue nada.
  await ctx.addInitScript(([hoy]) => {
    const dias = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(`${hoy}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - (13 - i));
      return { fecha: d.toISOString().slice(0, 10), valor: [7400, 9100, 6200, 8300, 10500, 5400, 8800][i % 7] };
    });
    window.__saludDePrueba = new Proxy({}, {
      get: (_, k) => (k === 'disponible' ? () => true : k === 'pasosPorDia' ? async () => dias : k === 'pasosDe' ? async () => 7100 : k === 'yaSePidio' ? async () => true : async () => null),
    });
  }, [HOY]);
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)));
  // La semana de la franja: pecho adentro (12), piernas abajo (4).
  await page.route((u) => u.pathname.endsWith('/rest/v1/sesiones') && decodeURIComponent(u.search).includes('logs(fecha)'), async (route) => {
    const r = await route.fetch();
    const previas = await r.json().catch(() => []);
    const bloques = [{ ejercicio: 'press_banca', series: 12, pesos: Array(12).fill(60), carga: 'total' }, { ejercicio: 'sentadilla', series: 4, pesos: Array(4).fill(90), carga: 'total' }];
    previas.push({ id: '00000000-0000-0000-0000-000000000001', bloques, logs: { fecha: dia(1) } });
    await route.fulfill({ response: r, json: previas });
  });
  const foto = async (n) => { if (SALIDA) await page.screenshot({ path: join(SALIDA, `${n}.png`) }); };
  const texto = (t) => page.getByText(t, { exact: true }).last();
  // Que no se vea es que no esté a la vista. Sigue estando para VoiceOver, como etiqueta.
  const seLee = async (t) => page.getByText(t, { exact: true }).filter({ visible: true }).count();
  const etiquetaDe = (testID) => page.getByTestId(testID).first().evaluate((n) => (n.getAttribute('aria-label') ?? '') + ' ' + (n.closest('[aria-label]')?.getAttribute('aria-label') ?? ''));
  const iniciar = page.getByText(TX.inicio.iniciarEntrenamiento, { exact: true }).first();

  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.evaluate(([u]) => localStorage.setItem(`ascent:guia:${u}`, JSON.stringify({ uid: u, recorrido: true, paso: 0, globos: ['elegir', 'series', 'descanso', 'peso', 'terminar', 'carga', 'sugerido', 'mas', 'album', 'amigos', 'rutina', 'pasos', 'calendario'] })), [uid]);
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await page.getByText(TX.entrar.entrar, { exact: true }).last().click({ timeout: 60000 });
  await iniciar.waitFor({ timeout: 120000 });
  await page.waitForTimeout(2200);
  const ceremonia = page.locator('[aria-modal="true"]');
  for (let i = 0; i < 12 && (await ceremonia.count()) > 0; i++) {
    await page.mouse.click(195, 420);
    await page.waitForTimeout(1000);
  }

  // ---- D · EL GIMNASIO ----
  console.log('D · Marcar el gimnasio');
  await page.getByTestId('gimnasio-explicado').first().waitFor({ timeout: 20000 });
  chequear('la oración ya no se lee', await seLee(TX.inicio.gimnasioRecordatorioNativo), 0);
  chequear('VoiceOver la sigue teniendo', (await etiquetaDe('gimnasio-escena')).includes(TX.inicio.gimnasioRecordatorioNativo), true);
  const lugarDelPunto = () => page.getByTestId('gimnasio-punto').first().evaluate((n) => Math.round(n.getBoundingClientRect().left));
  await page.getByTestId('gimnasio-dia-lleno').first().waitFor({ timeout: 8000 });
  const alLlegar = await lugarDelPunto();
  await foto('d-gimnasio');
  await page.getByTestId('gimnasio-escena').first().click();
  await page.waitForTimeout(500);
  const yendo = await lugarDelPunto();
  chequear('al tocar, el punto vuelve a caminar', yendo < alLlegar, true);
  await page.getByTestId('gimnasio-dia-lleno').first().waitFor({ timeout: 6000 });
  chequear('y al llegar, el día se llena', await page.getByTestId('gimnasio-dia-lleno').count(), 1);

  // ---- E · LO SUGERIDO ----
  console.log('E · El ejercicio sugerido');
  await iniciar.click({ timeout: 30000 });
  const mas = page.getByLabel(TX.inicio.sumarSerie).first();
  await mas.waitFor({ timeout: 60000 });
  await page.waitForTimeout(1200);
  chequear('entre sugerido: la línea punteada', await page.getByTestId('ejercicio-sugerido').first().locator('line[stroke-dasharray]').count(), 1);
  chequear('sin la etiqueta ni la nota', [await seLee(TX.sesion.sugerido), await seLee(TX.sesion.sugeridoNota)], [0, 0]);
  await foto('e-sugerido');
  await page.getByText('×3', { exact: true }).first().click({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(300);
  await mas.click();
  await page.waitForTimeout(700);
  chequear('con la primera serie, la línea se vuelve firme', [await page.getByTestId('ejercicio-sugerido').count(), await page.getByTestId('ejercicio-elegido').first().locator('line').count()], [0, 0]);
  await foto('e-confirmado');
  await s.rpc('terminar_sesion').then(() => {}, () => {});
  await s.from('logs').delete().eq('user_id', uid).eq('fecha', HOY);
  await s.rpc('recalcular_desde_cero');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await iniciar.waitFor({ timeout: 120000 });
  await page.waitForTimeout(1200);

  // ---- A · LAS VIDAS ----
  console.log('A · Las vidas');
  await texto(TX.nav.stats).click({ timeout: 30000 });
  await page.getByTestId('vidas-explicadas').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
  chequear('la nota ya no se lee', [await seLee(TX.impulso.nota), await page.getByText(TX.impulso.notaJuntas).filter({ visible: true }).count()], [0, 0]);
  const centro = (n) => { const c = n.getBoundingClientRect(); return [c.left + c.width / 2, c.top + c.height / 2]; };
  const [aroX, aroY] = await page.getByTestId('vidas-llama').first().evaluate(centro);
  const [diaX, diaY] = await page.getByTestId('vidas-dia-que-falto').first().evaluate(centro);
  chequear('el aro que llama está centrado en el día que faltó', Math.abs(aroX - diaX) <= 1 && Math.abs(aroY - diaY) <= 1, true);
  chequear('VoiceOver la sigue teniendo', /30 días/.test(await etiquetaDe('vidas-explicadas')), true);
  const rachaAntes = await page.getByTestId('vidas-racha').first().innerText();
  await foto('a-vidas');
  await page.getByTestId('vidas-explicadas').first().click();
  await page.getByTestId('vidas-vuela').first().waitFor({ timeout: 2000 });
  chequear('al tocar, la estrella vuela', await page.getByTestId('vidas-vuela').count(), 1);
  await page.waitForTimeout(1100);
  chequear('y queda en el día que faltó', await page.getByTestId('vidas-dia-que-falto').first().locator('svg').count(), 1);
  chequear('la racha no se mueve', await page.getByTestId('vidas-racha').first().innerText(), rachaAntes);
  await foto('a-vidas-cubierto');
  const contando = Number(await page.getByTestId('vidas-contando').first().innerText().catch(() => '0'));
  chequear('un aro la trae de vuelta, contando', contando > 0 && contando <= 30, true);
  await page.waitForTimeout(4600);
  chequear('y todo vuelve a como estaba: es una demostración', [await page.getByTestId('vidas-dia-que-falto').first().locator('svg').count(), await page.getByTestId('vidas-vuela').count()], [0, 0]);

  // ---- F · EL PESO SIN DATOS ----
  console.log('F · El peso, antes de tener datos');
  chequear('la nota ya no se lee', await seLee(TX.stats.pesoVacio), 0);
  const fantasmaPeso = page.getByTestId('peso-sin-datos').first();
  await fantasmaPeso.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  chequear('se ve el gráfico que va a haber, punteado', await fantasmaPeso.locator('path[stroke-dasharray]').count(), 1);
  chequear('con el candado, y VoiceOver con el texto', [await page.getByTestId('candado').count() > 0, (await fantasmaPeso.getAttribute('aria-label')) === TX.stats.pesoVacio], [true, true]);
  await foto('f-peso-vacio');

  // ---- C · EL NÚMERO DE FUERZA ----
  console.log('C · El número de fuerza');
  const numero = page.getByTestId('fuerza-numero').first();
  await numero.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  chequear('sin marcas, una raya, y la oración ya no se lee', [await numero.innerText(), await seLee(TX.fuerza.sinNada)], ['—', 0]);
  chequear('VoiceOver la sigue teniendo', (await numero.getAttribute('aria-label')) === TX.fuerza.sinNada, true);
  chequear('las tres cajas', await page.getByTestId('tres-marcas').first().locator('[data-testid^="marca-"]').count(), 3);
  await foto('c-sin-marcas');
  await s.from('prs').insert([{ user_id: uid, ejercicio: 'sentadilla', peso: 110, reps: 5, es_real: false, fecha: dia(2) }, { user_id: uid, ejercicio: 'press_banca', peso: 80, reps: 5, es_real: false, fecha: dia(1) }]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await iniciar.waitFor({ timeout: 120000 });
  await page.waitForTimeout(800);
  await texto(TX.nav.stats).click({ timeout: 30000 });
  await page.getByTestId('tres-marcas').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  chequear('con dos: el número sigue en raya, y faltan marcas ya no se lee', [await page.getByTestId('fuerza-numero').first().innerText(), await page.getByText(TX.fuerza.faltanMarcasCorto).filter({ visible: true }).count()], ['—', 0]);
  chequear('cada caja dice lo suyo: con marca, el peso; sin, una raya', [(await page.getByTestId('marca-sentadilla').first().innerText()).includes('kg'), (await page.getByTestId('marca-peso_muerto').first().innerText()).startsWith('—')], [true, true]);
  await foto('c-dos-marcas');
  await page.getByTestId('marca-peso_muerto').first().click({ timeout: 10000 });
  await page.getByText(TX.fuerza.anotarMarca, { exact: true }).first().waitFor({ timeout: 20000 });
  chequear('tocar una caja lleva a Mis marcas', true, true);
  await page.getByText(TX.general.volver, { exact: true }).last().click({ timeout: 8000 });
  await page.waitForTimeout(1200);

  // ---- B · LA FRANJA ----
  console.log('B · La franja de series');
  await texto(TX.stats.pestanaEntrenamiento).click({ timeout: 20000 });
  await page.getByTestId('escala-de-series').first().waitFor({ timeout: 30000 }).catch(async (e) => { await foto('error-b'); throw e; });
  await page.getByTestId('escala-de-series').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1300);
  chequear('10 y 20 arriba de las barras', (await page.getByTestId('escala-de-series').first().innerText()).replace(/\s+/g, ' ').trim(), `${SERIES_POR_SEMANA.minimo} ${SERIES_POR_SEMANA.maximo}`);
  chequear('las dos notas ya no se leen', [await seLee(TX.volumen.notaRango), await seLee(TX.volumen.notaRangoPorque)], [0, 0]);
  chequear('VoiceOver las sigue teniendo', (await etiquetaDe('escala-de-series')).includes(TX.volumen.notaRango), true);
  chequear('la franja se prende en la fila que está adentro, y en las otras no', [await page.getByTestId('franja-viva').count() >= 1, await page.getByTestId('franja').count() >= 1], [true, true]);
  await foto('b-franja');

  // ---- K · ORDENAR ----
  console.log('K · Ordenar la rutina');
  await page.mouse.move(195, 300);
  await page.mouse.wheel(0, -2000);
  await page.waitForTimeout(500);
  await page.getByTestId('rutina-editar').first().click({ timeout: 20000 });
  const filasRutina = page.locator('[data-testid^="rutina-filas-"]').first();
  await filasRutina.waitFor({ timeout: 20000 });
  chequear('cada fila lleva su agarradera', await filasRutina.locator('[data-testid="agarradera"]').count(), 3);
  chequear('y la pista ya no se lee', await page.getByText(/apretado/i).filter({ visible: true }).count(), 0);
  // Cuadro por cuadro: la del medio se levanta y vuelve, sola.
  const posiciones = await filasRutina.evaluate(async (n) => {
    const fila = n.children[1];
    const vistas = new Set();
    const t0 = performance.now();
    while (performance.now() - t0 < 2300) {
      vistas.add(Math.round(fila.getBoundingClientRect().top));
      await new Promise((r) => requestAnimationFrame(r));
    }
    return vistas.size;
  });
  chequear('la del medio se levanta y vuelve, sola', posiciones >= 3, true);
  chequear('y no se repite: queda anotado', await page.evaluate(() => Object.keys(localStorage).some((k) => k.includes('arrastrar-ensenado'))), true);
  await foto('k-agarraderas');
  await page.getByTestId('rutina-editar').first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(600);

  // ---- H · LA META DE PASOS ----
  console.log('H · La meta de pasos');
  await texto(TX.stats.pestanaGeneral).click({ timeout: 20000 });
  await page.waitForTimeout(1200);
  const botonMeta = page.getByText(/^Meta/).filter({ visible: true }).first();
  await botonMeta.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
  await botonMeta.click({ timeout: 15000 });
  await page.getByTestId('meta-de-pasos').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);
  chequear('la nota ya no se lee', await seLee(TX.ajustes.metaPasosNota), 0);
  chequear('con los pasos de verdad: una barra por día', await page.getByTestId('meta-semana').first().locator(':scope > div').count(), 8);
  const valorAntes = await page.getByTestId('meta-valor').first().innerText();
  const lineaAntes = await page.getByTestId('meta-linea').first().evaluate((n) => Math.round(n.getBoundingClientRect().top));
  await foto('h-meta');
  // COMO EL PESO (2/11, a pedido): con − y + a los lados de una regla, no con una barra.
  chequear('sin barra para arrastrar', [await page.getByTestId('meta-deslizador').count(), await page.getByTestId('meta-regla').count()], [0, 1]);
  const numeroDeMeta = async () => Number((await page.getByTestId('meta-valor').first().innerText()).replace(/\D/g, ''));
  const deArranque = await numeroDeMeta();
  await page.getByTestId('meta-mas').first().click();
  await page.waitForTimeout(200);
  chequear('el + sube de a 100', await numeroDeMeta(), deArranque + 100);
  await page.getByTestId('meta-menos').first().click();
  await page.waitForTimeout(200);
  chequear('y el − baja', await numeroDeMeta(), deArranque);
  const caja = await page.getByTestId('meta-regla').first().boundingBox();
  await page.mouse.move(caja.x + caja.width * 0.75, caja.y + caja.height / 2);
  await page.mouse.down();
  await page.mouse.move(caja.x + caja.width * 0.25, caja.y + caja.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const valorDespues = await page.getByTestId('meta-valor').first().innerText();
  chequear('arrastrar la regla a la izquierda sube el número', (await numeroDeMeta()) > deArranque, true);
  chequear('y se mueve la línea de la semana', await page.getByTestId('meta-linea').first().evaluate((n) => Math.round(n.getBoundingClientRect().top)) !== lineaAntes, true);
  await foto('h-meta-movida');
  await page.getByTestId('meta-guardar').first().click({ timeout: 8000 });
  await page.waitForTimeout(800);
  chequear('guardar cierra, y la meta queda', [await page.getByTestId('meta-de-pasos').count(), await page.evaluate(() => Object.entries(localStorage).find(([k]) => k.includes('meta-pasos'))?.[1] ?? null)], [0, valorDespues.replace(/\D/g, '')]);

  // ---- G · LOS AJUSTES ----
  console.log('G · Un ajuste que se muestra');
  await texto(TX.nav.ajustes).click({ timeout: 20000 });
  await page.getByTestId('ajuste-muestra').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(600);
  chequear('las oraciones ya no se leen', [await seLee(TX.ajustes.mostrarUltimaVezNota), await seLee(TX.ajustes.registrarRepsNota)], [0, 0]);
  chequear('apagados, en el bloque no está lo que suman', [await page.getByTestId('muestra-ultima-vez').count(), await page.getByTestId('muestra-reps').count()], [0, 0]);
  await foto('g-ajustes');
  await page.getByRole('switch', { name: TX.ajustes.mostrarUltimaVez }).first().click({ timeout: 10000 });
  await page.getByRole('switch', { name: TX.ajustes.registrarReps }).first().click({ timeout: 10000 });
  await page.waitForTimeout(800);
  chequear('al prender, aparece en el bloque', [await page.getByTestId('muestra-ultima-vez').count(), await page.getByTestId('muestra-reps').count()], [1, 1]);
  await foto('g-ajustes-prendidos');
  await page.getByRole('switch', { name: TX.ajustes.mostrarUltimaVez }).first().click({ timeout: 10000 });
  await page.waitForTimeout(600);
  chequear('al apagar, se va', await page.getByTestId('muestra-ultima-vez').count(), 0);
  await page.getByRole('switch', { name: TX.ajustes.registrarReps }).first().click({ timeout: 10000 });
  await page.waitForTimeout(400);

  // ---- I · EL ÁLBUM ----
  console.log('I · El álbum, vacío');
  await texto(TX.nav.album).click({ timeout: 20000 });
  await page.getByTestId('album-vacio').first().waitFor({ timeout: 30000 });
  chequear('el pie ya no se lee, el título sí', [await seLee(TX.album.vacioPie), await seLee(TX.album.vacioTitulo)], [0, 1]);
  chequear('VoiceOver lo sigue teniendo', (await etiquetaDe('album-vacio')).includes(TX.album.vacioPie), true);
  await page.getByTestId('album-foto-puesta').first().waitFor({ state: 'attached', timeout: 5000 });
  await page.waitForTimeout(900);
  chequear('la foto cae y se pega, sola', await page.getByTestId('album-foto-puesta').first().evaluate((n) => Number(getComputedStyle(n).opacity)), 1);
  // Un cuadrado con el halo recortado no se distingue contando elementos: se le pregunta al planeta y a su escena.
  chequear('el planeta es redondo y entero', await page.getByTestId('album-planeta').first().evaluate((n) => [parseFloat(getComputedStyle(n).borderRadius) >= n.getBoundingClientRect().width / 2, getComputedStyle(n.parentElement).overflow]), [true, 'visible']);
  await foto('i-album');
  await page.getByTestId('album-vacio').first().click();
  await page.waitForTimeout(500);
  chequear('al tocar, se saca', await page.getByTestId('album-foto').first().evaluate((n) => Number(getComputedStyle(n).opacity) < 0.1), true);

  // ---- J · SOCIAL ----
  console.log('J · Social, sin amigos');
  await texto(TX.nav.social).click({ timeout: 20000 });
  await page.getByTestId('social-vacio').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(500);
  // LA ESTRELLA GUÍA (2/11, a pedido; reemplaza a la constelación).
  chequear('la estrella es un botón y dice qué hace', [await page.getByTestId('social-estrella').first().getAttribute('role'), await seLee(TX.social.vacioBoton)], ['button', 1]);
  const anchoDe = (id) => page.getByTestId(id).first().evaluate((n) => n.getBoundingClientRect().width);
  const vivo = (id) => page.getByTestId(id).first().evaluate((n) => { let o = 1; for (let a = n; a; a = a.parentElement) o *= Number(getComputedStyle(a).opacity); return o; });
  chequear('hasta tocarla, ni el buscador ni el renglón de invitar se ven', [await vivo('buscar-gente') < 0.05, await vivo('social-invitar') < 0.05], [true, true]);
  await foto('j-social');
  await page.getByTestId('social-estrella').first().click();
  // Mientras viaja: el buscador se va abriendo.
  await page.waitForTimeout(620);
  const abriendo = await page.locator('[data-testid="buscar-gente"]').first().evaluate((n) => { for (let a = n; a; a = a.parentElement) if (getComputedStyle(a).overflow === 'hidden' && a.getBoundingClientRect().width < innerWidth - 48 - 1) return Math.round(a.getBoundingClientRect().width); return null; });
  chequear('la barra de texto se abre de a poco, no aparece', abriendo !== null && abriendo > 0, true);
  await foto('j-social-abriendo');
  await page.waitForTimeout(1500);
  chequear('la estrella termina al lado de «Invítalos con un link», y el buscador queda listo para escribir', [await vivo('social-invitar') > 0.9, await seLee(TX.social.vacioInvitar), await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))], [true, 1, 'buscar-gente']);
  chequear('la estrella grande ya no está', await page.getByTestId('social-estrella').count(), 0);
  await foto('j-social-tocado');
  void anchoDe;

  chequear('sin errores de la página', errores, []);
} finally {
  await nav.close();
  await s.rpc('terminar_sesion').then(() => {}, () => {});
  const { error } = await borrarCuentaDePrueba(s);
  if (error) console.log('No se pudo borrar la cuenta:', error.message);
}
console.log(fallos ? `\n${fallos} fallas` : '\nLas once se entienden mirándolas: bien');
process.exit(fallos ? 1 : 0);
