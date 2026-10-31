// LAS LETRAS (30/10): Inter para todo lo que se lee, Outfit solo para el número de la racha y Geist
// Mono para los datos. «Nunca la fuente del sistema» decía la spec, y la nativa no cargaba ninguna.
//
// Por la pantalla, en la vista web de la nativa: junta todo el texto visible de Inicio, de una sesión,
// del descanso y de Stats, y mira qué familia calculó el navegador para cada uno. Si alguno cae en la
// del sistema, falla. Después va a los que tienen un papel: el número es Outfit, el reloj y las cifras
// son Geist Mono, las etiquetas son Inter.
//
// Una fuente nombrada que no cargó también daría el nombre, así que se comprueba que cargó de verdad:
// `document.fonts`, y en Geist Mono que el 1 y el 0 midan lo mismo, cosa que en Inter no pasa.
//
// Lo que NO mide: el iPhone. Ahí las carga el módulo de expo-font, que está en el binario, y esto
// prueba la vista web.
//
//   node --env-file=.env.local supabase/probar-letras.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(8);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const sello = Date.now().toString(36);
let fallos = 0;
const chequear = (que, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : `: esperado ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`}`);
};

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const correo = `agusconde20+ascent-le-${sello}@gmail.com`;
const clave = `Le-${sello}-k9`;
const { error: eAlta } = await s.auth.signUp({ email: correo, password: clave });
if (eAlta) {
  console.log('No se pudo crear la cuenta:', eAlta.message);
  process.exit(1);
}
const uid = (await s.auth.getUser()).data.user.id;
await s.from('profiles').update({ username: `le_${sello.slice(-6)}`, sexo: 'm' }).eq('id', uid);
const HOY = (await s.rpc('mi_hoy')).data;
const dia = (n) => { const d = new Date(`${HOY}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const filas = [];
for (let a = 3; a >= 1; a--) filas.push({ user_id: uid, fecha: dia(a) });
await s.from('logs').insert(filas);
await s.rpc('recalcular_desde_cero');

const FAMILIAS = /^(Inter_|Outfit_|GeistMono_)/;

console.log('Las letras de la nativa');
const nav = await chromium.launch();
try {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY', timezoneId: 'America/Montevideo' });
  const page = await ctx.newPage();
  const texto = (t) => page.getByText(t, { exact: true }).last();
  const familia = (loc) => loc.evaluate((n) => getComputedStyle(n).fontFamily.split(',')[0].replace(/["']/g, '').trim());
  // Todo lo que se ve, y la familia de cada uno. Una hoja abierta tapa lo de atrás, pero también se mide.
  const delSistema = () => page.evaluate((fuente) => {
    const re = new RegExp(fuente);
    const salida = [];
    const paseador = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (paseador.nextNode()) {
      const n = paseador.currentNode;
      const t = n.textContent.trim();
      if (!t) continue;
      const el = n.parentElement;
      if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TITLE'].includes(el.tagName)) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const c = el.getBoundingClientRect();
      if (c.width < 1 || c.height < 1) continue;
      const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
      if (!re.test(fam)) salida.push(`${t.slice(0, 24)} → ${fam}`);
    }
    return salida;
  }, FAMILIAS.source);

  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.evaluate(([u]) => localStorage.setItem(`ascent:guia:${u}`, JSON.stringify({ uid: u, recorrido: true, paso: 0, globos: ['elegir', 'series', 'descanso', 'peso', 'terminar', 'carga', 'sugerido', 'mas'] })), [uid]);
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  chequear('el login ya está en Inter', await familia(page.locator('input[type=email], input[inputmode=email]').first()), 'Inter_400Regular');
  await page.getByText(TX.entrar.entrar, { exact: true }).last().click({ timeout: 60000 });
  const iniciar = page.getByText(TX.inicio.iniciarEntrenamiento, { exact: true }).first();
  await iniciar.waitFor({ timeout: 120000 });
  await page.waitForTimeout(1500);

  // ---- CARGARON DE VERDAD ----
  // El navegador las baja recién cuando algo las usa: se pregunta por las de la pantalla que se ve.
  const sinCargar = (fuentes) => page.evaluate(async (lista) => {
    await document.fonts.ready;
    return lista.filter((f) => !document.fonts.check(`16px ${f}`));
  }, fuentes);
  chequear('las fuentes de Inicio están cargadas', await sinCargar(['Inter_400Regular', 'Inter_500Medium', 'Inter_600SemiBold', 'Outfit_300Light', 'GeistMono_400Regular']), []);
  const anchos = await page.evaluate(() => {
    const c = document.createElement('canvas').getContext('2d');
    const mide = (f, t) => { c.font = `40px ${f}`; return Math.round(c.measureText(t).width * 10) / 10; };
    return {
      mono: mide('GeistMono_400Regular', '1111') === mide('GeistMono_400Regular', '0000'),
      inter: mide('Inter_400Regular', '1111') === mide('Inter_400Regular', '0000'),
      outfit: mide('Outfit_300Light', '0') !== mide('Inter_400Regular', '0'),
    };
  });
  chequear('se dibujan: en Geist Mono el 1 y el 0 miden lo mismo, en Inter no, y Outfit es otra', anchos, { mono: true, inter: false, outfit: true });

  // ---- INICIO ----
  chequear('Inicio: nada en la fuente del sistema', await delSistema(), []);
  const racha = page.getByText('3', { exact: true }).first();
  chequear('el número de la racha es Outfit', await familia(racha), 'Outfit_300Light');
  chequear('el nombre es Inter 600', await familia(page.getByText(`le_${sello.slice(-6)}`, { exact: true }).first()), 'Inter_600SemiBold');
  chequear('las letras de la tira son datos', await familia(page.getByTestId('pantalla-inicio').getByText('M', { exact: true }).first()), 'GeistMono_400Regular');
  chequear('el botón de iniciar es Inter 500', await familia(iniciar), 'Inter_500Medium');

  // ---- ENTRENANDO ----
  await iniciar.click({ timeout: 30000 });
  const mas = page.getByLabel(TX.inicio.sumarSerie).first();
  await mas.waitFor({ timeout: 60000 });
  await page.waitForTimeout(1200);
  chequear('entrenando: nada en la fuente del sistema', await delSistema(), []);
  chequear('las metas son datos', await familia(page.getByText('×3', { exact: true }).first()), 'GeistMono_400Regular');
  await page.getByText('×3', { exact: true }).first().click({ timeout: 20000 });
  await page.waitForTimeout(300);
  await mas.click();
  await page.waitForTimeout(900);
  chequear('«1 en total» es un dato', await familia(page.getByText(TX.sesion.totalHoy(1), { exact: true }).first()), 'GeistMono_400Regular');

  // ---- EL DESCANSO ----
  await page.getByTestId('pildora-descanso').first().click({ timeout: 20000 });
  const reloj = page.getByTestId('descanso-reloj').first();
  await reloj.waitFor({ timeout: 20000 });
  await page.waitForTimeout(600);
  chequear('el reloj del descanso es Geist Mono fina', await familia(reloj), 'GeistMono_200ExtraLight');
  chequear('y se sigue leyendo como un reloj', /^\d+:\d\d$/.test((await reloj.innerText()).replace(/\s/g, '')), true);
  chequear('el descanso: nada en la fuente del sistema', await delSistema(), []);
  chequear('y la fina cargó', await sinCargar(['GeistMono_200ExtraLight']), []);
  await page.keyboard.press('Escape').catch(() => {});
  await page.getByText(TX.descanso?.saltar ?? 'Saltar', { exact: true }).last().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(800);

  await s.rpc('terminar_sesion').then(() => {}, () => {});
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByTestId('luz-stats').first().waitFor({ timeout: 120000, state: 'attached' });
  await page.waitForTimeout(1500);

  // ---- STATS ----
  await texto(TX.nav.stats).click({ timeout: 30000 });
  await page.waitForTimeout(2000);
  chequear('Stats: nada en la fuente del sistema', await delSistema(), []);
  chequear('y la de las cifras cargó', await sinCargar(['GeistMono_300Light']), []);
  chequear('las cifras de Stats son Geist Mono liviana', await familia(page.getByTestId('stats-cifra').first()), 'GeistMono_300Light');
  chequear('la etiqueta de una cifra es Inter 500', await familia(page.getByText(TX.stats.mejorRacha, { exact: true }).first()), 'Inter_500Medium');
  chequear('«día N» es un dato', await familia(page.getByText(TX.stats.diaN(6), { exact: true }).first()), 'GeistMono_400Regular');
} finally {
  await nav.close();
  await s.rpc('terminar_sesion').then(() => {}, () => {});
  const { error } = await borrarCuentaDePrueba(s);
  if (error) console.log('No se pudo borrar la cuenta:', error.message);
}
console.log(fallos ? `\n${fallos} fallas` : '\nLas letras están donde dice la spec');
process.exit(fallos ? 1 : 0);
