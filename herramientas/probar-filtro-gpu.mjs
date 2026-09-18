// ¿EL MOTOR SE APAGA DONDE TIENE QUE APAGARSE, Y SOLO AHÍ?
//
// Desde el 18/9 el motor no se prende sin GPU de verdad (ver `src/motor/
// escena.ts`): con WebGL por software dibujar cuesta ~1 s por cuadro. Pero
// apagarlo en una máquina que anda bien es el error caro —se pierde el fondo
// sin motivo—, y Chrome a veces reporta mal `failIfMajorPerformanceCaveat`.
// Por eso el criterio que decide es medir cuadros, y esto prueba los cuatro
// casos:
//
//   1. GPU real ...................... se prende, y nada dice lento ni duda
//   2. WebGL por software ............ no se prende, y la página no se traba
//   3. GPU real, Chrome reporta mal .. el navegador se niega, pero se prende
//      (simulado: se niega el contexto cuando se pide el caveat)
//   4. GPU real, cuadros lentos ...... se prende y se apaga solo
//      (simulado: 400 ms de trabajo en cada cuadro)
//
//   node herramientas/probar-filtro-gpu.mjs
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cerrarPuerto, limpiarPuertosDeSondas, limiteDeSonda, LIMITE_DE_COMPILACION_MS } from '../supabase/utiles.mjs';

// Ninguna sonda corre sin limite (ver utiles.mjs).
limiteDeSonda(20);

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const entorno = { ...process.env, NEXT_DIST_DIR: '.next-filtro' };
limpiarPuertosDeSondas();
const PUERTO = 3090;
const BASE = `http://localhost:${PUERTO}`;
console.log('compilando…');
const b = spawnSync('npx', ['next', 'build'], { timeout: LIMITE_DE_COMPILACION_MS, cwd: RAIZ, shell: true, env: entorno, encoding: 'utf8' });
if (b.status !== 0) {
  console.log('NO COMPILA:\n' + (b.stdout ?? '').slice(-2500));
  process.exit(1);
}
const servidor = spawn('npx', ['next', 'start', '-p', String(PUERTO)], { cwd: RAIZ, shell: true, env: entorno, stdio: 'ignore' });
process.on('exit', () => {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(servidor.pid), '/f', '/t'], { stdio: 'ignore' });
  else servidor.kill('SIGTERM');
  cerrarPuerto(PUERTO);
});
for (let i = 0; i < 90; i++) {
  if (await fetch(BASE + '/galeria', { redirect: 'manual' }).then(() => true).catch(() => false)) break;
  await new Promise((r) => setTimeout(r, 1000));
}

const GPU = ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader=false'];
const CASOS = [
  { nombre: '1. GPU real', args: GPU, espera: { prende: true, marcas: [] } },
  { nombre: '2. WebGL por software', args: [], espera: { prende: false, marcas: ['motor-sin-gpu'] } },
  {
    nombre: '3. GPU real, Chrome reporta mal',
    args: GPU,
    trampa: () => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (tipo, op, ...r) {
        if (op?.failIfMajorPerformanceCaveat) return null;
        return orig.call(this, tipo, op, ...r);
      };
    },
    espera: { prende: true, marcas: ['motor-gpu-en-duda'] },
  },
  {
    nombre: '4. GPU real, cuadros lentos',
    args: GPU,
    trampa: () => {
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (fn) =>
        raf((t) => {
          const hasta = performance.now() + 400;
          while (performance.now() < hasta);
          fn(t);
        });
    },
    espera: { prende: false, marcas: ['motor-lento'] },
  },
];
const DE_INTERES = ['motor-sin-gpu', 'motor-gpu-en-duda', 'motor-lento'];

let fallas = 0;
for (const caso of CASOS) {
  const nav = await chromium.launch({ args: caso.args });
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    window.__largas = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__largas.push(Math.round(e.duration));
    }).observe({ type: 'longtask', buffered: true });
  });
  if (caso.trampa) await ctx.addInitScript(caso.trampa);
  const page = await ctx.newPage();
  await page.goto(BASE + '/galeria', { waitUntil: 'domcontentloaded' });
  // El motor monta después del piso de 2 s; compilar y medir los cuadros lleva
  // unos segundos más. En el caso 4 cada cuadro son 400 ms.
  await page.waitForTimeout(12000);
  const r = await page.evaluate(() => ({
    canvas: document.querySelectorAll('canvas').length,
    marcas: performance
      .getEntriesByType('mark')
      .map((e) => e.name.replace('ascent:', ''))
      .filter((n) => ['motor-sin-gpu', 'motor-gpu-en-duda', 'motor-lento', 'shader-fin'].includes(n)),
    largas: window.__largas,
  }));
  const prende = r.marcas.includes('shader-fin') && r.canvas > 0;
  const dichas = r.marcas.filter((m) => DE_INTERES.includes(m));
  const ok = prende === caso.espera.prende && JSON.stringify(dichas) === JSON.stringify(caso.espera.marcas);
  // En el caso 4 las tareas largas son la trampa misma; en los demás, no puede haber.
  const peor = caso.trampa && caso.nombre.startsWith('4') ? 0 : Math.max(0, ...r.largas);
  const traba = peor > 200;
  if (!ok || traba) fallas++;
  console.log(
    `${ok && !traba ? 'ok   ' : 'FALLA'} ${caso.nombre.padEnd(34)} motor ${prende ? 'prendido' : 'apagado '}  marcas: ${dichas.join(', ') || '(ninguna)'}` +
      `  canvas: ${r.canvas}  peor tarea: ${peor} ms` +
      (ok ? '' : `\n        esperaba: motor ${caso.espera.prende ? 'prendido' : 'apagado'}, marcas ${caso.espera.marcas.join(', ') || '(ninguna)'}`)
  );
  await nav.close();
}
console.log(fallas ? `\n${fallas} caso(s) fallaron` : '\nlos cuatro casos se comportan como tienen que');
process.exit(fallas ? 1 : 0);
