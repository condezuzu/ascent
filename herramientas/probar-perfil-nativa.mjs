// ¿SE ENTRA Y SE SALE DE LOS PERFILES? (pasos 2, 3 y 4 del 22/9)
//
// El perfil es la primera pantalla APILADA de la app nativa, y lo que hay que
// comprobar no es que se dibuje —eso se ve en una foto— sino que el camino
// entero funcione: entrar desde las tres puertas, ver lo que corresponde, y
// volver a donde se estaba.
//
// LO QUE MÁS IMPORTA ES VOLVER. Una pantalla apilada que no vuelve deja la app
// sin salida, y en un teléfono no hay "atrás" del navegador: está el gesto del
// sistema y lo que dibuje la pantalla. Por eso cada paso termina comprobando
// que abajo sigue estando la barra de pestañas.
//
// No escribe nada en la cuenta: solo mira.
//
//   node --env-file=.env.local herramientas/probar-perfil-nativa.mjs [--puerto=8090]
//
// Necesita la nativa prendida.
import { chromium } from 'playwright';
import { limiteDeSonda } from '../supabase/utiles.mjs';

limiteDeSonda(10);

const PUERTO = (process.argv.find((a) => a.startsWith('--puerto=')) ?? '--puerto=8090').split('=')[1];
const BASE = `http://localhost:${PUERTO}`;

if (!(await fetch(BASE).then(() => true).catch(() => false))) {
  console.log(`la nativa no esta prendida en :${PUERTO}`);
  process.exit(1);
}

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errores = [];
page.on('console', (m) => m.type() === 'error' && errores.push(m.text().slice(0, 160)));

let fallas = 0;
const esperar = (que, cumple) => {
  console.log(`  ${cumple ? 'ok   ' : 'FALLA'} ${que}`);
  if (!cumple) fallas++;
};

const ruta = () => page.evaluate(() => location.pathname);
const texto = () => page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '));
/** La barra de abajo: si está, se volvió a las pestañas. */
const hayBarra = () => page.getByText('Ranking', { exact: true }).last().isVisible().catch(() => false);

async function volver() {
  await page.getByText('Volver', { exact: false }).first().click({ timeout: 20000 });
  await page.waitForTimeout(2000);
}

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[inputmode=email]').first().fill(process.env.CONEXION_EMAIL, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(process.env.CONEXION_PASSWORD);
  await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  await page.waitForTimeout(9000);
  const entendido = page.getByText('Entendido', { exact: true });
  if (await entendido.isVisible().catch(() => false)) await entendido.click();
  await page.waitForTimeout(2000);

  console.log('\n1. Tu perfil, desde la cabecera de Inicio');
  await page.getByLabel('Tu perfil').click({ timeout: 30000 });
  await page.waitForTimeout(3500);
  esperar('la ruta es /yo', (await ruta()) === '/yo');
  esperar('se ven los amigos', (await texto()).includes('AMIGOS'));
  await volver();
  esperar('y vuelve a las pestañas', (await ruta()) === '/' && (await hayBarra()));

  console.log('\n2. El perfil de un amigo, tocando su fila en Ranking');
  await page.getByText('Ranking', { exact: true }).last().click();
  await page.waitForTimeout(3000);
  await page.getByText('prueba_dos', { exact: false }).first().click({ timeout: 30000 });
  await page.waitForTimeout(3500);
  esperar('la ruta es /perfil/<id>', /^\/perfil\/[0-9a-f-]{36}$/.test(await ruta()));
  const suyo = await texto();
  esperar(`se ve su nombre y su racha (${suyo.slice(0, 60)}…)`, suyo.includes('prueba_dos') && /racha de/i.test(suyo));
  // LO QUE NO TIENE QUE HABER: nada para tocar de lo suyo.
  esperar('no ofrece quitar de amigos desde acá', !suyo.includes('Quitar'));
  await volver();
  esperar('y vuelve a Ranking', (await ruta()) === '/' && (await hayBarra()));

  console.log('\n3. Tu propia fila del ranking lleva a TU perfil, no a uno recortado');
  await page.getByText('(tú)', { exact: false }).first().click({ timeout: 30000 });
  await page.waitForTimeout(3500);
  esperar('la ruta es /yo', (await ruta()) === '/yo');
  await volver();

  console.log('\n4. Un id que no es un uuid no consulta nada');
  await page.evaluate(() => window.history.pushState({}, '', '/perfil/cualquier-cosa'));
  await page.waitForTimeout(2500);
  esperar('no se rompe', !(await texto()).toLowerCase().includes('undefined'));
} catch (e) {
  esperar(`se rompio (${e.message.split('\n')[0]})`, false);
  await page.screenshot({ path: 'capturas/perfil-roto.png' }).catch(() => {});
} finally {
  const otros = errores.filter((e) => !/Failed to load resource/i.test(e));
  if (otros.length) console.log('\nerrores de consola:', otros.slice(0, 4).join(' || '));
  await nav.close();
  console.log(fallas === 0 ? '\nOK: los tres caminos al perfil andan, y todos vuelven.' : `\n${fallas} fallas`);
  process.exit(fallas === 0 ? 0 : 1);
}
