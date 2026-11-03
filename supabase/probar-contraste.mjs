// EL PISO DE 4,5:1, MEDIDO EN LA PANTALLA (30/10). No compara dos colores escritos en un
// archivo: abre la nativa con una cuenta en cada uno de los siete rangos, junta todo el texto
// visible con su color y la opacidad que le llega de arriba, y lo compara con lo que hay de
// verdad detrás: una captura con el texto transparente, motor incluido, y de esa caja el píxel
// que peor le queda (percentil 90 si el texto es más claro que su fondo, 10 si es más oscuro).
//
// Inicio en reposo (en el rango 4, con los diez planetas), Stats General y Entrenamiento, Social,
// Álbum y Ajustes, entrenando con una serie hecha («Ver lista» sobre el planeta), el descanso, el
// resumen al terminar y el día listo.
//
// Lo que NO mide: el iPhone. Es la vista web de la nativa; el motor es el mismo, pero el color
// exacto que da el GL de Windows no es el de la pantalla del teléfono.
//
// Exento: el − y el + de un control que no se puede tocar. Son dibujos, no texto.
//
//   node --env-file=.env.local supabase/probar-contraste.mjs [rangos, ej: 3,4]
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(20);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const { DESDE_RANGO } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'reglas.ts')).href);
const PISO = 4.5;
const SALIDA = process.env.CONTRASTE_SALIDA ?? null;
if (SALIDA) mkdirSync(SALIDA, { recursive: true });
const RANGOS = (process.argv[2] ?? '1,2,3,4,5,6,7').split(',').map(Number);
const sello = Date.now().toString(36);

const luz = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const relacion = (a, b) => { const [x, y] = [luz(a), luz(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const leerColor = (css) => {
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  return { rgb: p.slice(0, 3), alfa: p[3] ?? 1 };
};

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const correo = `agusconde20+ascent-co-${sello}@gmail.com`;
const clave = `Co-${sello}-k9`;
const { error: eAlta } = await s.auth.signUp({ email: correo, password: clave });
if (eAlta) {
  console.log('No se pudo crear la cuenta:', eAlta.message);
  process.exit(1);
}
const uid = (await s.auth.getUser()).data.user.id;
await s.from('profiles').update({ username: `co_${sello.slice(-6)}`, sexo: 'm' }).eq('id', uid);
const HOY = (await s.rpc('mi_hoy')).data;
const dia = (n) => { const d = new Date(`${HOY}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

// La misma cuenta va subiendo: suma días para atrás y recalcula. El rango lo cuenta la base.
let hasta = 0;
async function llevarARango(r) {
  const objetivo = (DESDE_RANGO[r - 1] ?? 0) + 3;
  const filas = [];
  for (let a = hasta + 1; a <= objetivo; a++) filas.push({ user_id: uid, fecha: dia(a) });
  for (let i = 0; i < filas.length; i += 50) {
    const { error } = await s.from('logs').insert(filas.slice(i, i + 50));
    if (error) throw new Error(`logs: ${error.message}`);
  }
  hasta = Math.max(hasta, objetivo);
  const { error } = await s.rpc('recalcular_desde_cero');
  if (error) throw new Error(`recalcular: ${error.message}`);
}

async function sumarUnDia() {
  hasta += 1;
  const { error } = await s.from('logs').insert({ user_id: uid, fecha: dia(hasta) });
  if (error) throw new Error(`logs: ${error.message}`);
  await s.rpc('recalcular_desde_cero');
}

async function juntarTexto(page) {
  return page.evaluate(() => {
    const salida = [];
    const tapados = [];
    const paseador = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (paseador.nextNode()) {
      const nodo = paseador.currentNode;
      const t = nodo.textContent.trim();
      if (!t) continue;
      const el = nodo.parentElement;
      if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TITLE'].includes(el.tagName)) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const rango = document.createRange();
      rango.selectNodeContents(nodo);
      const caja = rango.getBoundingClientRect();
      if (caja.width < 2 || caja.height < 2) continue;
      const cx = caja.x + caja.width / 2;
      const cy = caja.y + caja.height / 2;
      if (cx < 0 || cy < 0 || cx >= innerWidth || cy >= innerHeight) continue;
      let op = 1;
      for (let a = el; a; a = a.parentElement) op *= parseFloat(getComputedStyle(a).opacity);
      if (op < 0.02) continue;
      const tope = document.elementFromPoint(cx, cy);
      // Tapado de verdad es por una hoja abierta. Lo demás que da `elementFromPoint` es una zona
      // tocable transparente encima, como la de las pestañas: el texto se ve igual.
      const hoja = (n) => n?.closest?.('[aria-modal="true"]') ?? null;
      if (tope && hoja(tope) !== hoja(el)) {
        tapados.push(t.slice(0, 20));
        continue;
      }
      const enSvg = el.closest('svg');
      salida.push({
        t: t.slice(0, 44), x: caja.x, y: caja.y, w: caja.width, h: caja.height,
        color: enSvg ? cs.fill : cs.color, op,
      });
    }
    return { salida, tapados };
  });
}

let fallos = 0;
let medidos = 0;
let peor = { ratio: 99 };
const faltas = [];

async function medir(page, rango, pantalla) {
  const { salida, tapados } = await juntarTexto(page);
  const estilo = await page.addStyleTag({
    content: '*{color:transparent !important;caret-color:transparent !important;text-decoration-color:transparent !important;-webkit-text-fill-color:transparent !important} svg text{fill:transparent !important;stroke:transparent !important} input::placeholder,textarea::placeholder{color:transparent !important}',
  });
  await page.waitForTimeout(150);
  const png = await page.screenshot();
  await estilo.evaluate((n) => n.remove());
  if (SALIDA) await sharp(png).toFile(join(SALIDA, `r${rango}-${pantalla}.png`));
  const { data: buf, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: ancho, height: alto, channels: canales } = info;
  const escala = ancho / page.viewportSize().width;
  let aca = 0;
  for (const c of salida) {
    if (['−', '+', '-'].includes(c.t) && c.op < 0.9) continue;
    const col = leerColor(c.color);
    if (!col || col.alfa === 0) continue;
    const pix = [];
    const x0 = Math.max(0, Math.round(c.x * escala));
    const x1 = Math.min(ancho - 1, Math.round((c.x + c.w) * escala));
    const y0 = Math.max(0, Math.round(c.y * escala));
    const y1 = Math.min(alto - 1, Math.round((c.y + c.h) * escala));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = (y * ancho + x) * canales;
      pix.push([buf[i], buf[i + 1], buf[i + 2]]);
    }
    if (!pix.length) continue;
    pix.sort((a, b) => luz(a) - luz(b));
    const mediana = pix[Math.floor(pix.length / 2)];
    const alfa = col.alfa * c.op;
    const masClaro = luz(col.rgb) > luz(mediana);
    const fondo = pix[Math.floor(pix.length * (masClaro ? 0.9 : 0.1))];
    const efectivo = col.rgb.map((v, k) => v * alfa + fondo[k] * (1 - alfa));
    const ratio = relacion(efectivo, fondo);
    medidos++;
    aca++;
    if (ratio < peor.ratio) peor = { ratio, t: c.t, rango, pantalla };
    if (ratio < PISO) {
      fallos++;
      faltas.push(`rango ${rango} · ${pantalla} · «${c.t}» ${ratio.toFixed(2)}:1 (texto rgb(${col.rgb.join(',')}) al ${alfa.toFixed(2)} sobre rgb(${fondo.join(',')}))`);
    }
  }
  console.log(`  rango ${rango} · ${pantalla}: ${aca} textos${tapados.length ? ` (tapados: ${tapados.join(' | ')})` : ''}`);
  if (!aca) {
    fallos++;
    faltas.push(`rango ${rango} · ${pantalla}: no se midió ningún texto`);
  }
}

// Recargada, la vista web tarda más de 4 s en volver a dibujar el motor (3/11). Se medía a los 3,5 s:
// Inicio pasaba contra el fondo liso, sin el planeta detrás. Si el motor no llega, la sonda cae.
const esperarElMotor = (page) =>
  page.waitForFunction(() => {
    const c = document.querySelector('canvas');
    let op = c ? 1 : 0;
    for (let n = c; n && n.nodeType === 1; n = n.parentElement) op *= Number(getComputedStyle(n).opacity);
    return op > 0.99;
  }, null, { timeout: 120000, polling: 100 });

console.log('El piso de 4,5:1 en la pantalla');
// Con la GPU de la máquina, como las capturas: sin ella el motor no se dibuja igual.
const nav = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader=false'] });
try {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY', timezoneId: 'America/Montevideo' });
  const page = await ctx.newPage();
  const texto = (t) => page.getByText(t, { exact: true }).last();
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.evaluate(([u]) => localStorage.setItem(`ascent:guia:${u}`, JSON.stringify({ uid: u, recorrido: true, paso: 0, globos: ['elegir', 'series', 'descanso', 'peso', 'terminar', 'carga', 'sugerido', 'mas'] })), [uid]);
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await page.getByText(TX.entrar.entrar, { exact: true }).last().click({ timeout: 60000 });
  await page.getByText(TX.inicio.iniciarEntrenamiento, { exact: true }).first().waitFor({ timeout: 120000 });

  for (const r of RANGOS) {
    await llevarARango(r);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const iniciar = page.getByText(TX.inicio.iniciarEntrenamiento, { exact: true }).first();
    await iniciar.waitFor({ timeout: 120000 });
    await esperarElMotor(page);
    await page.waitForTimeout(3500);
    await medir(page, r, 'inicio');
    // El rango 4 cambia de planeta cada día, y cada planeta tiene su brillo: los diez.
    if (r === 4) {
      for (let k = 1; k < 10; k++) {
        await sumarUnDia();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await iniciar.waitFor({ timeout: 120000 });
        await esperarElMotor(page);
        await page.waitForTimeout(3000);
        await medir(page, r, `inicio-planeta-${k + 1}`);
      }
    }

    await texto(TX.nav.stats).click({ timeout: 30000 });
    await page.waitForTimeout(2200);
    await medir(page, r, 'stats-general');
    await page.mouse.move(195, 500);
    await page.mouse.wheel(0, 640);
    await page.waitForTimeout(700);
    await medir(page, r, 'stats-general-2');
    await texto(TX.stats.pestanaEntrenamiento).click({ timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1800);
    await medir(page, r, 'stats-entrenamiento');
    // Las que se quedaron sin caja (30/10): lo que se lee va directo sobre el fondo.
    for (const [nombre, pestana] of [['social', TX.nav.social], ['album', TX.nav.album], ['ajustes', TX.nav.ajustes]]) {
      await texto(pestana).click({ timeout: 30000 });
      // La foto del álbum vacío cae sola: en el aire, su texto se compararía con lo que tenía debajo un cuadro antes.
      // Y el nombre de la pestaña se va solo: a medio irse, se mediría una letra que ya casi no está.
      await page.waitForTimeout(nombre === 'album' ? 2600 : 2300);
      await medir(page, r, nombre);
    }
    await texto(TX.nav.inicio).click({ timeout: 30000 });
    await page.waitForTimeout(1200);

    await iniciar.click({ timeout: 30000 });
    const mas = page.getByLabel(TX.inicio.sumarSerie).first();
    await mas.waitFor({ timeout: 60000 });
    await page.waitForTimeout(1400);
    await medir(page, r, 'entrenando');
    await page.getByText('×5', { exact: true }).first().click({ timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(300);
    await mas.click();
    await page.waitForTimeout(1600);
    await medir(page, r, 'una-serie');
    await page.getByTestId('pildora-descanso').first().click({ timeout: 20000 });
    await page.getByTestId('descanso-reloj').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(900);
    await medir(page, r, 'descanso');
    await page.getByText(TX.descanso.saltar, { exact: true }).last().click({ timeout: 8000 });
    await page.waitForTimeout(900);
    await texto(TX.sesion.terminar).click({ timeout: 20000 });
    await page.waitForTimeout(1000);
    await texto(TX.sesion.terminar).click({ timeout: 20000 });
    await page.getByText(TX.sesion.resumenTitulo, { exact: true }).first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
    await medir(page, r, 'resumen');
    await page.getByText('✕', { exact: true }).first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(900);
    await medir(page, r, 'dia-listo');
    await s.rpc('terminar_sesion').then(() => {}, () => {});
    await s.from('logs').delete().eq('user_id', uid).eq('fecha', HOY);
    await s.rpc('recalcular_desde_cero');
  }
} finally {
  await nav.close();
  await s.rpc('terminar_sesion').then(() => {}, () => {});
  const { error } = await borrarCuentaDePrueba(s);
  if (error) console.log('No se pudo borrar la cuenta:', error.message);
}
faltas.slice(0, 60).forEach((f) => console.log(`  FALLA ${f}`));
if (faltas.length > 60) console.log(`  … y ${faltas.length - 60} más`);
console.log(`  ${medidos} textos medidos; el más justo: «${peor.t}», ${peor.ratio?.toFixed?.(2)}:1 (rango ${peor.rango}, ${peor.pantalla})`);
console.log(fallos ? `\n${fallos} por debajo del piso` : '\nTodo el texto medido llega a 4,5:1');
process.exit(fallos ? 1 : 0);
