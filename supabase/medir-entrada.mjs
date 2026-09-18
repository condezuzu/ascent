// CUÁNTO CUESTA LA PANTALLA DE ENTRADA, medido y no supuesto.
//
// Con el BUILD DE PRODUCCIÓN, que es lo único que dice la verdad: en dev los
// archivos van sin minificar y pesan varias veces más.
//
// Mide tres cosas:
//   1. cuánto tarda el motor (three.js) en estar listo desde que se pide;
//   2. cuánto pesa lo que hay que bajar para la cuarta pantalla;
//   3. cuántos cuadros por segundo da la animación, con 900 y con 270
//      partículas. Con ventana de verdad: sin cabeza, el navegador corre
//      `requestAnimationFrame` a un cuadro por segundo y la medida no vale.
//
//   node supabase/medir-entrada.mjs
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { limiteDeSonda, LIMITE_DE_COMPILACION_MS } from './utiles.mjs';

// Ninguna sonda corre sin limite (ver utiles.mjs).
limiteDeSonda(20);

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = 3026;
const BASE = `http://localhost:${PUERTO}`;
const entorno = { ...process.env, NEXT_DIST_DIR: '.next-medir' };

console.log('compilando (producción)…');
const build = spawnSync('npx', ['next', 'build'], { timeout: LIMITE_DE_COMPILACION_MS, cwd: RAIZ, shell: true, env: entorno, encoding: 'utf8' });
if (build.status !== 0) {
  console.log('no compila:\n' + (build.stdout ?? '').slice(-2000));
  process.exit(1);
}
const servidor = spawn('npx', ['next', 'start', '-p', String(PUERTO)], { cwd: RAIZ, shell: true, env: entorno, stdio: 'ignore' });
const cerrar = () => {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(servidor.pid), '/f', '/t'], { stdio: 'ignore' });
  else servidor.kill('SIGTERM');
};
process.on('exit', cerrar);
for (let i = 0; i < 90; i++) {
  if (await fetch(BASE, { redirect: 'manual' }).then(() => true).catch(() => false)) break;
  await new Promise((r) => setTimeout(r, 1000));
}

// SIN VENTANA: en este equipo no se puede abrir una. Los cuadros por segundo
// que salgan de acá NO valen —sin cabeza el navegador baja `rAF` a placer—;
// lo que sí vale es cuánto tarda el motor en estar listo y cuánto pesa.
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/galeria/bienvenida`, { waitUntil: 'networkidle', timeout: 120000 });

for (const nivel of ['alto', 'bajo']) {
  await page.getByRole('button', { name: new RegExp(`^${nivel} ·`) }).click();
  await page.getByRole('button', { name: 'Solo la animación' }).click();
  await page.waitForTimeout(2500);

  const medida = await page.evaluate(() => window.__entrada ?? null);
  // Los cuadros de verdad: se cuentan en la ventana abierta durante 3 s.
  const fps = await page.evaluate(
    () =>
      new Promise((resolver) => {
        let n = 0;
        const t0 = performance.now();
        const peor = { ms: 0 };
        let anterior = t0;
        const paso = (ahora) => {
          n++;
          peor.ms = Math.max(peor.ms, ahora - anterior);
          anterior = ahora;
          if (ahora - t0 < 3000) requestAnimationFrame(paso);
          else resolver({ fps: Math.round((n / (ahora - t0)) * 1000), peorCuadro: Math.round(peor.ms) });
        };
        requestAnimationFrame(paso);
      })
  );
  console.log(`\n${nivel}:`);
  console.log(`  motor listo en ${medida ? Math.round(medida.tardo) : '?'} ms desde que se pidió`);
  console.log(`  (sin ventana: ${fps.fps} cuadros/s, no representativo)`);
}

const pesos = await page.evaluate(() =>
  performance
    .getEntriesByType('resource')
    .filter((r) => /_next\/static\/chunks/.test(r.name))
    .map((r) => ({ kb: Math.round((r.transferSize || r.encodedBodySize) / 1024), ms: Math.round(r.duration) }))
    .sort((a, b) => b.kb - a.kb)
    .slice(0, 4)
);
console.log('\nlo más pesado que se baja:', pesos);
await nav.close();
cerrar();
