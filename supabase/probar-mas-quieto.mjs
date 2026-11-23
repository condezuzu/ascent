// EL + QUE ABRE EL TECLADO (23/11, lo contaron unos amigos del dueño): «registrando la serie tocan el + y se
// les pone para escribir el peso o las repes». Se toca como un dedo, siempre en el mismo punto —el centro del +
// al empezar—, en un iPhone chico (SE, 375×667) y en uno normal (390×844), con «Registrar repeticiones»
// prendido y un peso escrito (sin repes: así la marca pregunta a cuántas y aparece su cuadro debajo del +). Después de cada toque se mira qué quedó debajo del dedo y si quedó un campo
// enfocado.
//
// Vista web de la nativa (:8090): no tiene teclado. Lo del teclado se mide aparte, con su alto en un iPhone.
//
//   node --env-file=.env.local supabase/probar-mas-quieto.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(12);

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas', 'mas-quieto');
mkdirSync(SALIDA, { recursive: true });
let fallos = 0;
const chequear = (que, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : `: esperado ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`}`);
};

const TELEFONOS = [
  { nombre: 'iPhone SE', ancho: 375, alto: 667 },
  { nombre: 'iPhone 15', ancho: 390, alto: 844 },
];

console.log('El + no se corre debajo del dedo');
const nav = await chromium.launch();
for (const tel of TELEFONOS) {
  const sello = Date.now().toString(36);
  const correo = `agusconde20+ascent-mq-${sello}@gmail.com`;
  const clave = `Mq-${sello}-Kp3`;
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: eAlta } = await s.auth.signUp({ email: correo, password: clave });
  if (eAlta) {
    console.log('No se pudo crear la cuenta:', eAlta.message);
    process.exit(1);
  }
  const uid = (await s.auth.getUser()).data.user.id;
  await s.from('profiles').update({ username: `mq_${sello.slice(-6)}` }).eq('id', uid);
  const ctx = await nav.newContext({ viewport: { width: tel.ancho, height: tel.alto }, locale: 'es-UY', timezoneId: 'America/Montevideo', hasTouch: true });
  const page = await ctx.newPage();
  const texto = (t) => page.getByText(t, { exact: true }).last();
  // Una sesión de ayer con press de banca, como en probar-reps: sin ella el bloque no tiene ejercicio ni peso.
  const ayer = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo' }).format(new Date(Date.now() - 86400000));
  await page.route(
    (u) => u.pathname.endsWith('/rest/v1/sesiones') && decodeURIComponent(u.search).includes('logs!inner'),
    async (route) => {
      const r = await route.fetch();
      const filas = await r.json().catch(() => []);
      filas.push({ bloques: [{ ejercicio: 'press_banca', series: 3, pesos: [55, 55, 55], carga: 'total', reps: [10, 9, 8] }], logs: { fecha: ayer } });
      await route.fulfill({ response: r, json: filas });
    }
  );
  // Lo que la app manda a la base con cada serie: los pesos de press.
  const enviados = [];
  page.on('request', (q) => {
    if (!q.url().includes('/rest/v1/rpc/fijar_bloques')) return;
    try {
      enviados.push(JSON.parse(q.postData() ?? '{}').p_bloques ?? []);
    } catch {}
  });
  const pesosMandados = () => (enviados.at(-1) ?? []).filter((b) => b.ejercicio === 'press_banca').map((b) => b.pesos);
  const mas = () => page.getByLabel('Sumar una serie').first();
  // Lo que hay en un punto: el + (o adentro de él), un campo, u otra cosa con su testID o su texto.
  const queHay = (x, y) =>
    page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return 'nada';
      if (el.closest('[aria-label="Sumar una serie"]')) return 'el +';
      if (el.closest('input, textarea')) return 'un campo: ' + (el.closest('input, textarea').getAttribute('aria-label') ?? '');
      const conId = el.closest('[data-testid]');
      return 'otra cosa: ' + (conId?.getAttribute('data-testid') ?? (el.textContent ?? '').trim().slice(0, 30));
    }, [x, y]);
  const enfocado = () => page.evaluate(() => (document.activeElement?.matches('input, textarea') ? document.activeElement.getAttribute('aria-label') ?? 'un campo' : null));
  try {
    await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
    await pasarLaEntradaNativa(page);
    await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
    await page.locator('input[type=password]').first().fill(clave);
    await texto('Entrar').click({ timeout: 60000 });
    // «Registrar repeticiones», prendido.
    await texto('Ajustes').click({ timeout: 120000 });
    const llave = page.getByRole('switch', { name: 'Registrar repeticiones' }).first();
    await llave.scrollIntoViewIfNeeded({ timeout: 30000 });
    await llave.click();
    await page.waitForTimeout(800);
    await texto('Inicio').click({ timeout: 30000 });
    await texto('Iniciar entrenamiento').click({ timeout: 120000 });
    await mas().waitFor({ timeout: 90000 });
    await page.waitForTimeout(2500);
    // Un peso escrito, como quien anota de verdad.
    const peso = page.getByLabel('Peso de las próximas series').first();
    await peso.click();
    await peso.fill('60');
    await page.evaluate(() => document.activeElement?.blur());
    await mas().scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    const caja = await mas().boundingBox();
    const dedo = { x: Math.round(caja.x + caja.width / 2), y: Math.round(caja.y + caja.height / 2) };
    await page.screenshot({ path: join(SALIDA, `${tel.ancho}-antes.png`) });

    // EL TECLADO: en el iPhone, el numérico mide 216 pt en el SE y 291 en el 15 (con la barra de inicio). Si al
    // escribir las repes el + queda debajo, el dedo que va al + toca el teclado.
    const tecladoArriba = tel.alto - (tel.alto <= 667 ? 216 : 291);
    const campoReps = await page.getByTestId('campo-reps').first().boundingBox();
    console.log(`  ${tel.nombre}: el + en y=${Math.round(caja.y)}–${Math.round(caja.y + caja.height)}; las repes en y=${Math.round(campoReps.y)}; el teclado empezaría en y=${tecladoArriba}`);

    // LA PRIMERA SERIE, CON EL PESO A MEDIO ESCRIBIR. En el iPhone el + ahora cuenta con el teclado arriba y el campo
    // no se entera de ningún blur antes de la serie; en la web, apretar el + le saca el foco y el blur confirma solo.
    // Para que la prueba mire lo del iPhone, ese blur no le llega a React mientras se aprieta.
    await peso.click();
    await peso.fill('62,5');
    await page.evaluate(() => {
      window.__sinBlur = (e) => e.target?.matches?.('input[aria-label="Peso de las próximas series"]') && e.stopImmediatePropagation();
      for (const t of ['focusout', 'blur']) window.addEventListener(t, window.__sinBlur, true);
    });
    await page.mouse.click(dedo.x, dedo.y);
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      for (const t of ['focusout', 'blur']) window.removeEventListener(t, window.__sinBlur, true);
    });
    chequear(`${tel.nombre}: con el peso a medio escribir, el + cuenta la serie con ese peso sin esperar a que se cierre el campo`, pesosMandados(), [[62.5]]);
    // La marca pregunta a cuántas, debajo del +, y no se contesta: quien sigue entrenando toca el + de nuevo.
    const pregunto = await page.getByText('A cuántas repeticiones:').last().waitFor({ timeout: 5000 }).then(() => true, () => false);
    await page.waitForTimeout(1500);
    console.log(`  ${tel.nombre}: ${pregunto ? 'la marca pregunta' : 'la marca no preguntó'}; el + pasó de y=${Math.round(caja.y)} a y=${Math.round((await mas().boundingBox()).y)}`);
    await page.screenshot({ path: join(SALIDA, `${tel.ancho}-pregunta.png`) });
    await page.waitForTimeout(4500);
    await page.evaluate(() => document.activeElement?.blur());
    await page.waitForTimeout(600);

    const recorrido = [];
    for (let i = 2; i <= 6; i++) {
      const antes = await queHay(dedo.x, dedo.y);
      if (antes !== 'el +') {
        recorrido.push(`toque ${i}: debajo del dedo hay ${antes}`);
        await page.screenshot({ path: join(SALIDA, `${tel.ancho}-toque-${i}.png`) });
      }
      await page.mouse.click(dedo.x, dedo.y);
      // Lo que tarda alguien entre una serie y la otra, corto: lo que se va solo a los 4,5 s ya se fue.
      await page.waitForTimeout(6000);
      const foco = await enfocado();
      if (foco) recorrido.push(`toque ${i}: quedó enfocado «${foco}»`);
      // Ya cumplida, el + es «Terminar»: el dedo ya no va al +.
      if (!(await mas().isVisible().catch(() => false))) break;
    }
    await page.screenshot({ path: join(SALIDA, `${tel.ancho}-despues.png`) });
    chequear(`${tel.nombre}: tocando siempre en el mismo punto, debajo del dedo sigue el + y no se enfoca ningún campo`, recorrido, []);
    chequear(`${tel.nombre}: y cuenta las tres series`, pesosMandados(), [[62.5, 62.5, 62.5]]);
  } catch (e) {
    fallos++;
    console.log('  FALLA ' + String(e).split('\n')[0].slice(0, 200));
    await page.screenshot({ path: join(SALIDA, `${tel.ancho}-error.png`) }).catch(() => {});
  }
  await ctx.close();
  const { error: eBorrar } = await borrarCuentaDePrueba(s);
  console.log(`  ${eBorrar ? 'FALLA' : 'ok  '} cuenta borrada${eBorrar ? ': ' + eBorrar.message : ''}`);
  if (eBorrar) fallos++;
}
await nav.close();
process.exit(fallos ? 1 : 0);
