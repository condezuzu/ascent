// CUÁNTO AIRE HAY ENTRE "DÍA NORMAL" Y "DESCANSO".
//
// El humano mandó una captura de su Inicio en día de descanso y dijo que ese
// planeta le gustaba mucho más. Resultó que no era otro planeta ni un estilo
// sin texturas: es Marte con la superficie multiplicada por 0,055 —la cara
// nocturna— y un filo de luz en el canto.
//
// La decisión fue llevar ese tratamiento a todos los días, pero con la
// superficie más arriba. Y ahí aparece el riesgo: la cara nocturna HOY ES UNA
// SEÑAL, dice "hoy descansás". Si un día normal se le parece demasiado, la
// señal se quema.
//
// Esto saca la misma pantalla con 0,055 (descanso) y con 0,20 / 0,30 / 0,40
// para poder mirar los cuatro al lado y decidir con los ojos. El número final
// no se elige por argumento.
//
//   node --env-file=.env.local supabase/capturas-noche.mjs [rango]
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
const SALIDA = join(RAIZ, 'capturas', 'noche');
mkdirSync(SALIDA, { recursive: true });

// Los rangos a los que el tratamiento les aplica de verdad: los que tienen
// CUERPO. El sol emite, el agujero negro es un disco, y el polvo y la galaxia
// son partículas: ninguno tiene una superficie que apagar ni un filo que
// encender. Se sacan igual para dejar por escrito que no cambian.
const NOMBRES = ['Polvo', 'Asteroide', 'Luna', 'Planeta', 'Sol', 'Sistema', 'Galaxia', 'Agujero negro'];
const CON_CUERPO = [2, 3, 4, 6];

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
let PUERTO = 3071;
while (!(await librePara(PUERTO))) PUERTO++;
const BASE = `http://localhost:${PUERTO}`;

const entorno = { ...process.env, NEXT_DIST_DIR: '.next-noche' };
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

const NIVELES = [
  { etiqueta: '0-de-dia-viejo', boton: 'de día (viejo)' },
  { etiqueta: '055-descanso', boton: '0.055 (descanso)' },
  { etiqueta: '10', boton: '0.1' },
  { etiqueta: '15', boton: '0.15' },
  { etiqueta: '20', boton: '0.2' },
  { etiqueta: '30', boton: '0.3' },
  { etiqueta: '40', boton: '0.4' },
];

const rangos = process.argv[2] ? [Number(process.argv[2])] : CON_CUERPO;
console.log('\nrango            nivel              foto');
for (const n of rangos) {
  await page.getByRole('button', { name: NOMBRES[n - 1], exact: false }).first().click();
  await page.waitForTimeout(700);
  for (const niv of NIVELES) {
    const b = page.getByRole('button', { name: niv.boton, exact: true }).first();
    if (!(await b.count())) {
      console.log(`  (no encontré el botón "${niv.boton}": se saltea)`);
      continue;
    }
    await b.click();
    // El motor remonta con `key`: hay que esperar a que dibuje de nuevo.
    await page.waitForTimeout(2500);
    const archivo = join(SALIDA, `r${n}-${NOMBRES[n - 1].toLowerCase().replace(/ /g, '-')}-${niv.etiqueta}.png`);
    await page.screenshot({ path: archivo });
    console.log(`  ${NOMBRES[n - 1].padEnd(15)} ${niv.etiqueta.padEnd(18)} ${archivo.slice(RAIZ.length + 1)}`);
  }
}

await nav.close();
console.log(`\nlisto: ${SALIDA.slice(RAIZ.length + 1)}`);
