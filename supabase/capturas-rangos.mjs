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
import { cerrarPuerto, limpiarPuertosDeSondas, pasarLaEntrada, limiteDeSonda, LIMITE_DE_COMPILACION_MS } from './utiles.mjs';

// Ninguna sonda corre sin limite (ver utiles.mjs).
limiteDeSonda(20);

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'capturas', 'rangos');
mkdirSync(SALIDA, { recursive: true });

const librePara = (p) =>
  new Promise((r) => {
    const s = createServer();
    s.once('error', () => r(false));
    s.once('listening', () => s.close(() => r(true)));
    // SE ESCUCHA EN 0.0.0.0, NO EN 127.0.0.1, y esa diferencia costo cinco
    // corridas. `next start` se ata a 0.0.0.0; en Windows, atarse a
    // 127.0.0.1 cuando otro proceso ya tiene 0.0.0.0 PUEDE funcionar, asi
    // que este chequeo decia "libre" sobre un puerto ocupado.
    //
    // Lo que pasaba despues: `next start` no podia atarse y moria en
    // silencio (stdio ignorado), y la sonda terminaba hablando con un
    // servidor HUERFANO de una corrida anterior, que servia un build viejo
    // con chunks que ya no existian. La pagina quedaba en blanco.
    s.listen(p, '0.0.0.0');
  });
// SE LIMPIA ANTES DE LEVANTAR NADA, siempre. Si la corrida anterior se cayo
// a la mitad, su servidor quedo vivo sirviendo un build viejo, y esta sonda
// terminaria hablandole a el sin enterarse. Ver `limpiarPuertosDeSondas`.
limpiarPuertosDeSondas();
let PUERTO = 3061;
while (!(await librePara(PUERTO))) PUERTO++;
const BASE = `http://localhost:${PUERTO}`;

const entorno = { ...process.env, NEXT_DIST_DIR: '.next-rangos' };
console.log('compilando…');
const build = spawnSync('npx', ['next', 'build'], { timeout: LIMITE_DE_COMPILACION_MS, cwd: RAIZ, shell: true, env: entorno, encoding: 'utf8' });
if (build.status !== 0) {
  console.log('NO COMPILA:\n' + (build.stdout ?? '').slice(-2500));
  process.exit(1);
}
const servidor = spawn('npx', ['next', 'start', '-p', String(PUERTO)], { cwd: RAIZ, shell: true, env: entorno, stdio: 'ignore' });
const cerrar = () => {
  // POR PID **Y** POR PUERTO. El pid es el del shell que lanza npx; el servidor
  // es un nieto y sobrevive. Matar por puerto no depende del arbol de procesos.
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(servidor.pid), '/f', '/t'], { stdio: 'ignore' });
  else servidor.kill('SIGTERM');
  cerrarPuerto(PUERTO);
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

// LOS DOS ESTILOS, en dos carpetas con las mismas ocho fotos. El pivot a
// minimalista se decide MIRANDO, no discutiendo: la única diferencia entre una
// carpeta y la otra es cómo se dibuja el cuerpo.
const ESTILOS = process.argv[2] ? [process.argv[2]] : ['realista', 'plano'];

console.log('\nestilo      rango                  foto');
for (const estilo of ESTILOS) {
  await page.getByRole('button', { name: estilo, exact: true }).first().click();
  await page.waitForTimeout(800);
  for (let n = 1; n <= 8; n++) {
    await page.getByRole('button', { name: NOMBRES[n - 1], exact: false }).first().click();
    // El motor remonta con `key`, así que hay que esperar a que dibuje.
    await page.waitForTimeout(2500);
    const carpeta = join(SALIDA, estilo);
    mkdirSync(carpeta, { recursive: true });
    const archivo = join(carpeta, `${String(n)}-${NOMBRES[n - 1].toLowerCase().replace(/ /g, '-')}.png`);
    await page.screenshot({ path: archivo });
    console.log(`  ${estilo.padEnd(10)} ${String(n)} ${NOMBRES[n - 1].padEnd(16)} ${archivo.slice(RAIZ.length + 1)}`);
  }
}

await nav.close();
console.log(`\nlisto: ${SALIDA.slice(RAIZ.length + 1)}`);
