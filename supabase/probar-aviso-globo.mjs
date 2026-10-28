// EL AVISO DE «NOVEDAD», COMO GLOBO (21/10, a pedido: "tapa botones y empuja el contenido").
// Era una tarjeta en el medio de la columna: les sacaba lugar a las pantallas y, entrenando,
// tapaba «Terminar». Después colgó sobre la barra, y con las burbujas arriba (28/10) quedó encima
// de «Anotar peso» y se tragaba el toque. Desde el 29/10 va en el hueco que sobra de Inicio.
//
// En la vista web de la nativa (:8090), a 390×844 (un iPhone normal), con dos cuentas descartables
// (a una nueva le toca el aviso de la rutina): una sin nada y otra con rutina, días y una amiga
// entrenando en las burbujas, que es la Inicio más llena. En las dos el globo se ve, Inicio llega
// hasta la barra y NINGÚN botón queda tapado: en el centro de cada uno está el botón. Entrenando
// no sale y «Terminar» se puede tocar; al terminar vuelve, y «De acuerdo» lo saca.
//
//   node --env-file=.env.local supabase/probar-aviso-globo.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(8);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const SALIDA = join(AQUI, '..', 'capturas', 'aviso-globo');
mkdirSync(SALIDA, { recursive: true });
let fallos = 0;
const chequear = (que, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : `: esperado ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`}`);
};

async function cuenta(etiqueta, llena) {
  const sello = Date.now().toString(36) + etiqueta;
  const correo = `agusconde20+ascent-ag-${sello}@gmail.com`;
  const clave = `Ag-${sello}-Kp3`;
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error } = await s.auth.signUp({ email: correo, password: clave });
  if (error) throw new Error('No se pudo crear la cuenta: ' + error.message);
  const uid = (await s.auth.getUser()).data.user.id;
  await s.from('profiles').update({ username: `ag_${sello.slice(-7)}` }).eq('id', uid);
  if (llena) {
    const dia = (n) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo' }).format(new Date(Date.now() - n * 86400000));
    for (const n of [3, 2, 1]) await s.from('logs').insert({ user_id: uid, fecha: dia(n) });
    const d = { descanso: false, ejercicios: [{ ejercicio: 'press_banca', series: 4 }] };
    await s.rpc('guardar_rutina', { p_id: null, p_nombre: 'Prueba', p_dias: Array.from({ length: 7 }, () => d) });
  }
  return { s, correo, clave };
}

// Los botones que se ven en Inicio, y si en el centro de cada uno está él (o algo suyo).
const tapados = (page) =>
  page.evaluate(() => {
    const raiz = [...document.querySelectorAll('[data-testid="pantalla-inicio"]')].find((e) => e.offsetParent !== null);
    const globo = document.querySelector('[data-testid="aviso-rutina"]');
    // Un Pressable sin rol (como «Anotar peso») se dibuja sin role: lo delata el tabindex.
    return [...(raiz?.querySelectorAll('[role="button"], button, [role="link"], [tabindex="0"]') ?? [])]
      .filter((el) => !globo?.contains(el))
      .flatMap((el) => {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0 || b.bottom <= 0 || b.top >= innerHeight) return [];
        const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return t && (el.contains(t) || t.contains(el)) ? [] : [(el.textContent || el.getAttribute('aria-label') || '?').trim().slice(0, 30)];
      });
  });

const nav = await chromium.launch();
async function inicio(c, amiga) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY', timezoneId: 'America/Montevideo' });
  const page = await ctx.newPage();
  if (amiga) {
    // Una cuenta nueva no tiene amigos entrenando: la respuesta se contesta desde acá.
    await page.route('**/rest/v1/rpc/entrenando_ahora', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: '00000000-0000-4000-8000-0000000000b1', username: 'lucia', avatar_url: null }]) }),
    );
  }
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(c.correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(c.clave);
  await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  await page.getByTestId('aviso-rutina').first().waitFor({ timeout: 120000 });
  await page.waitForTimeout(2500);
  return page;
}
const caja = async (loc) => loc.boundingBox();

const vacia = await cuenta('v', false);
const llena = await cuenta('l', true);
try {
  console.log('El aviso de «Novedad», en una cuenta sin nada');
  const page = await inicio(vacia, false);
  await page.screenshot({ path: join(SALIDA, 'inicio-vacia.png') });
  const barra = await caja(page.getByRole('tablist').first());
  const raiz = await caja(page.getByTestId('pantalla-inicio').first());
  const g = await caja(page.getByTestId('aviso-rutina').first());
  chequear('Inicio llega hasta la barra y el globo está entero entre las dos', [Math.abs(raiz.y + raiz.height - barra.y) <= 2, g.y + g.height <= barra.y, g.y > raiz.y], [true, true, true]);
  chequear('no tapa ningún botón', await tapados(page), []);

  const texto = (t) => page.getByText(t, { exact: true }).last();
  const libre = (loc) => loc.evaluate((el) => {
    const b = el.getBoundingClientRect();
    const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return !!t && (el.contains(t) || t.contains(el));
  });
  await texto(TX.inicio.iniciarEntrenamiento).click({ timeout: 30000 });
  await page.getByLabel(TX.inicio.sumarSerie).first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(1500);
  chequear('entrenando no sale, y «Terminar» se puede tocar', [await page.getByTestId('aviso-rutina').count(), await libre(texto(TX.sesion.terminar))], [0, true]);
  await texto(TX.sesion.terminar).click({ timeout: 30000 });
  await texto(TX.sesion.terminar).click({ timeout: 30000 });
  await page.waitForTimeout(2500);
  // Al terminar, Inicio suma el renglón de la sesión corta y el globo ya no entra: espera. Al volver
  // a abrir la app, sale, porque todavía no se vio.
  await page.screenshot({ path: join(SALIDA, 'tras-terminar.png') });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await pasarLaEntradaNativa(page);
  const volvio = await page.getByTestId('aviso-rutina').first().waitFor({ timeout: 90000 }).then(() => true, () => false);
  chequear('al volver a abrir vuelve, porque todavía no se vio', [volvio, await tapados(page)], [true, []]);
  await page.getByTestId('aviso-rutina-entendido').first().click({ timeout: 30000 });
  await page.waitForTimeout(1200);
  chequear('«De acuerdo» lo saca', await page.getByTestId('aviso-rutina').count(), 0);
  await page.context().close();

  console.log('Y en la Inicio más llena: rutina, días y una amiga en las burbujas');
  const p2 = await inicio(llena, true);
  await p2.screenshot({ path: join(SALIDA, 'inicio-llena.png') });
  const barra2 = await caja(p2.getByRole('tablist').first());
  const g2 = await caja(p2.getByTestId('aviso-rutina').first());
  const peso = await caja(p2.getByText(TX.peso.anotarPeso, { exact: true }).first());
  chequear('el globo queda abajo de «Anotar peso» y arriba de la barra', [g2.y >= peso.y + peso.height, g2.y + g2.height <= barra2.y], [true, true]);
  chequear('no tapa ningún botón', await tapados(p2), []);
  await p2.context().close();
} catch (e) {
  fallos++;
  console.log('  FALLA ' + String(e).split('\n')[0].slice(0, 200));
}
await nav.close();

for (const c of [vacia, llena]) {
  const { error: eBorrar } = await borrarCuentaDePrueba(c.s);
  console.log(`  ${eBorrar ? 'FALLA' : 'ok  '} cuenta borrada${eBorrar ? ': ' + eBorrar.message : ''}`);
  if (eBorrar) fallos++;
}
process.exit(fallos ? 1 : 0);
