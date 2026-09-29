// UN CUERPO, AL CENTRO, LEGIBLE Y SIN LA INTERFAZ ENCIMA.
//
// POR QUÉ EXISTE (28/9). `capturas-rangos.mjs` saca la galería COMO SE VE EN LA
// APP: el cuerpo en la esquina, con los controles encima. Sirve para comparar
// paletas, pero es inservible para revisar el DISEÑO de un cuerpo —el borde del
// sol, una galaxia nueva— porque se ve un cuarto de cuerpo tapado por botones.
// Esto usa el modo `?limpio=1` de la galería, que deja solo el fondo con el
// cuerpo centrado, y saca una foto limpia de cada uno.
//
//   node --env-file=.env.local supabase/capturas-cuerpos.mjs [sufijo] [rangos...]
//     sufijo:  se agrega al nombre del archivo (p. ej. "-antes"/"-despues").
//     rangos:  nombres o números a sacar; por omisión, los siete.
//   ej: node --env-file=.env.local supabase/capturas-cuerpos.mjs -antes sol
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { cerrarPuerto, limpiarPuertosDeSondas, pasarLaEntrada, limiteDeSonda, LIMITE_DE_COMPILACION_MS } from './utiles.mjs';

limiteDeSonda(20);

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'capturas', 'cuerpos');
mkdirSync(SALIDA, { recursive: true });

// Rango → nombre de archivo. Los mismos siete de la galería (migración 54).
const RANGOS = [
  { n: 1, nombre: 'polvo' },
  { n: 2, nombre: 'asteroide' },
  { n: 3, nombre: 'luna' },
  { n: 4, nombre: 'planeta' },
  { n: 5, nombre: 'sol' },
  { n: 6, nombre: 'galaxia' },
  { n: 7, nombre: 'agujero-negro' },
];

const args = process.argv.slice(2);
const sufijo = args[0] && !/^\d+$/.test(args[0]) && !args[0].startsWith('planeta:') && !RANGOS.some((r) => r.nombre.startsWith(args[0].toLowerCase())) ? args[0] : (args[0]?.startsWith('-') ? args[0] : '');
const pedidos = args.filter((a) => a !== sufijo);
// `planeta:Tierra` captura el rango 4 con ese planeta (para revisar Tierra/Marte
// aparte de Jupiter, que es el planeta por omision).
const planetas = pedidos.filter((p) => p.startsWith('planeta:')).map((p) => p.slice('planeta:'.length));
const soloRangos = pedidos.filter((p) => !p.startsWith('planeta:'));
const cuales = [
  ...(soloRangos.length
    ? RANGOS.filter((r) => soloRangos.some((p) => String(r.n) === p || r.nombre.startsWith(p.toLowerCase())))
    : (planetas.length ? [] : RANGOS)),
  ...planetas.map((pl) => ({ n: 4, nombre: pl.toLowerCase(), planeta: pl })),
];

const librePara = (p) =>
  new Promise((r) => {
    const s = createServer();
    s.once('error', () => r(false));
    s.once('listening', () => s.close(() => r(true)));
    s.listen(p, '0.0.0.0');
  });

limpiarPuertosDeSondas();
let PUERTO = 3071;
while (!(await librePara(PUERTO))) PUERTO++;
const BASE = `http://localhost:${PUERTO}`;

const entorno = { ...process.env, NEXT_DIST_DIR: '.next-cuerpos' };
console.log('compilando…');
const build = spawnSync('npx', ['next', 'build'], { timeout: LIMITE_DE_COMPILACION_MS, cwd: RAIZ, shell: true, env: entorno, encoding: 'utf8' });
if (build.status !== 0) {
  console.log('NO COMPILA:\n' + (build.stdout ?? '').slice(-2500));
  process.exit(1);
}
const servidor = spawn('npx', ['next', 'start', '-p', String(PUERTO)], { cwd: RAIZ, shell: true, env: entorno, stdio: 'ignore' });
const cerrar = () => {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(servidor.pid), '/f', '/t'], { stdio: 'ignore' });
  else servidor.kill('SIGTERM');
  cerrarPuerto(PUERTO);
};
process.on('exit', cerrar);
for (let i = 0; i < 90; i++) {
  if (await fetch(BASE + '/login', { redirect: 'manual' }).then(() => true).catch(() => false)) break;
  await new Promise((r) => setTimeout(r, 1000));
}

// CON GPU DE VERDAD (28/9): sin estos flags, Chromium headless no entrega
// WebGL, el motor decide no dibujar y la foto sale con el fondo de CSS —el
// degradado— en vez del cuerpo. Es exactamente por qué "no se veía nada". Los
// mismos flags que usa `medir-costo-cuadro.mjs`, que sí dibuja.
const nav = await chromium.launch({
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader=false'],
});
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await pasarLaEntrada(page);
await page.locator('input[type=email]').fill(process.env.CONEXION_EMAIL);
await page.locator('input[type=password]').fill(process.env.CONEXION_PASSWORD);
await page.getByRole('button', { name: 'Entrar', exact: true }).click();
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 180000 });

console.log(`\nrango                  foto`);
for (const r of cuales) {
  const q = `limpio=1&rango=${r.n}${r.planeta ? `&planeta=${encodeURIComponent(r.planeta)}` : ''}`;
  await page.goto(`${BASE}/galeria?${q}`, { waitUntil: 'domcontentloaded' });
  // Esperar a que el motor cree el lienzo y dibuje unos cuadros. El fondo se
  // monta con `key`, así que hay que darle tiempo a compilar sus shaders.
  await page.waitForFunction(() => !!document.querySelector('.fondo-lienzo canvas'), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(4500);
  const archivo = join(SALIDA, `${r.n}-${r.nombre}${sufijo}.png`);
  await page.screenshot({ path: archivo });
  console.log(`  ${r.nombre.padEnd(20)} ${archivo.slice(RAIZ.length + 1)}`);
}

await nav.close();
console.log(`\nlisto: ${SALIDA.slice(RAIZ.length + 1)}`);
process.exit(0);
