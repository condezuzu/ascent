// LOS OCHO RANGOS, UNO POR UNO, EN UNA FOTO CADA UNO.
//
// POR QUÉ EXISTE. La paleta por rango es la mecánica central del proyecto y
// hasta ahora no había forma de MIRARLA: `capturas` fotografía la app con una
// sola cuenta, o sea con un solo rango. Todo lo demás —"el polvo se ve gris",
// "en Marte veo menos estrellas que en polvo", "hay un círculo achatado"— se
// contestaba leyendo código y adivinando, que es justamente lo que no hay que
// hacer con algo visual.
//
// La galería (`/galeria`) ya dibuja cualquier rango a pedido y no necesita
// datos: solo sesión, porque el middleware protege todo. Esto entra una vez y
// la recorre.
//
// CADA FOTO ES EL FONDO DE ESE RANGO, con su objeto, sus estrellas y su paleta
// aplicada a la interfaz. Comparar dos fotos contesta en dos segundos lo que
// discutir sobre el código no contesta nunca.
//
//   node --env-file=.env.local supabase/capturas-rangos.mjs
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { pasarLaEntrada } from './utiles.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'capturas', 'rangos');
mkdirSync(SALIDA, { recursive: true });

const librePara = (p) =>
  new Promise((r) => {
    const s = createServer();
    s.once('error', () => r(false));
    s.once('listening', () => s.close(() => r(true)));
    s.listen(p, '127.0.0.1');
  });
let PUERTO = 3061;
while (!(await librePara(PUERTO))) PUERTO++;
const BASE = `http://localhost:${PUERTO}`;

const entorno = { ...process.env, NEXT_DIST_DIR: '.next-rangos' };
console.log('compilando…');
const build = spawnSync('npx', ['next', 'build'], { cwd: RAIZ, shell: true, env: entorno, encoding: 'utf8' });
if (build.status !== 0) {
  console.log('NO COMPILA:\n' + (build.stdout ?? '').slice(-2500));
  process.exit(1);
}
const servidor = spawn('npx', ['next', 'start', '-p', String(PUERTO)], { cwd: RAIZ, shell: true, env: entorno, stdio: 'ignore' });
const cerrar = () => {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(servidor.pid), '/f', '/t'], { stdio: 'ignore' });
  else servidor.kill('SIGTERM');
};
process.on('exit', cerrar);
for (let i = 0; i < 90; i++) {
  if (await fetch(BASE + '/login', { redirect: 'manual' }).then(() => true).catch(() => false)) break;
  await new Promise((r) => setTimeout(r, 1000));
}

const NOMBRES = ['Polvo', 'Asteroide', 'Luna', 'Planeta', 'Sol', 'Sistema', 'Galaxia', 'Agujero negro'];

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await pasarLaEntrada(page);
await page.locator('input[type=email]').fill(process.env.CONEXION_EMAIL);
await page.locator('input[type=password]').fill(process.env.CONEXION_PASSWORD);
await page.getByRole('button', { name: 'Entrar', exact: true }).click();
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 180000 });

await page.goto(BASE + '/galeria', { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: 'Rango', exact: true }).waitFor({ timeout: 60000 });

console.log('\nrango                  foto');
for (let n = 1; n <= 8; n++) {
  await page.getByRole('button', { name: NOMBRES[n - 1], exact: false }).first().click();
  // El motor remonta con `key`, así que hay que esperar a que dibuje.
  await page.waitForTimeout(2500);
  const archivo = join(SALIDA, `${String(n)}-${NOMBRES[n - 1].toLowerCase().replace(/ /g, '-')}.png`);
  await page.screenshot({ path: archivo });
  console.log(`  ${String(n)} ${NOMBRES[n - 1].padEnd(16)} ${archivo.slice(RAIZ.length + 1)}`);
}

await nav.close();
console.log(`\nlisto: ${SALIDA.slice(RAIZ.length + 1)}`);
