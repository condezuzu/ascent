// PRIMERA VEZ ABSOLUTA, contra el build de producción y con un navegador de
// verdad. Cuenta nueva → onboarding → guía → primer día → peso → sesión con
// series → marcar el gimnasio → primera foto → primera marca de fuerza.
//
// POR QUÉ EXISTE: todo lo demás se prueba con `prueba_uno`, que tiene tres
// años de datos encima. El camino de alguien que abre la app por primera vez
// —sin perfil, sin logs, sin fotos, sin marcas, sin nada— no lo recorría nadie,
// y es justo donde las pantallas se encuentran con listas vacías, divisiones
// por cero y datos que todavía no existen.
//
// Mira TODO lo que pasa mientras tanto: errores de consola, excepciones,
// cualquier respuesta 4xx o 5xx, y cuánto tarda cada paso.
//
//   node --env-file=.env.local supabase/primera-vez.mjs
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = Number(process.env.PRIMERA_PUERTO ?? 3023);
const BASE = `http://localhost:${PUERTO}`;
const SALIDA = join(RAIZ, 'capturas', 'primera-vez');

const sello = Date.now().toString(36);
const CORREO = `agusconde20+ascent-primera-${sello}@gmail.com`;
const CLAVE = `Pv-${sello}-Ax9`;
const USUARIO = `nuevo_${sello.slice(-6)}`;

const problemas = [];
const pasos = [];

// ---------------------------------------------------------------
// El servidor, con el build de produccion
// ---------------------------------------------------------------
const libre = await fetch(BASE, { redirect: 'manual' }).then(() => false).catch(() => true);
if (!libre) {
  console.log(`El puerto ${PUERTO} está ocupado. Cerrá lo que esté ahí.`);
  process.exit(1);
}

const entorno = { ...process.env, NEXT_DIST_DIR: '.next-primera' };
console.log('  compilando…');
const compilacion = spawnSync('npx', ['next', 'build'], {
  cwd: RAIZ, shell: true, stdio: ['ignore', 'pipe', 'pipe'], env: entorno, encoding: 'utf8',
});
if (compilacion.status !== 0) {
  console.log('NO COMPILA:\n' + (compilacion.stdout ?? '') + (compilacion.stderr ?? ''));
  process.exit(1);
}

const servidor = spawn('npx', ['next', 'start', '-p', String(PUERTO)], {
  cwd: RAIZ, shell: true, stdio: ['ignore', 'pipe', 'pipe'], env: entorno,
});
let cerrado = false;
const cerrar = () => {
  if (cerrado) return;
  cerrado = true;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(servidor.pid), '/f', '/t'], { stdio: 'ignore' });
  } else servidor.kill('SIGTERM');
};
process.on('exit', cerrar);
process.on('SIGINT', () => { cerrar(); process.exit(1); });

for (let i = 0; i < 120; i++) {
  const vivo = await fetch(BASE + '/login', { redirect: 'manual' }).then(() => true).catch(() => false);
  if (vivo) break;
  await new Promise((r) => setTimeout(r, 1000));
}

// ---------------------------------------------------------------
// El navegador, mirando todo
// ---------------------------------------------------------------
const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: 'es-UY',
  timezoneId: 'America/Montevideo',
  permissions: ['geolocation'],
  // Un gimnasio cualquiera de Montevideo. Marcar el punto lee de acá.
  geolocation: { latitude: -34.9011, longitude: -56.1645, accuracy: 25 },
});
const page = await contexto.newPage();

page.on('console', (m) => {
  if (m.type() === 'error') problemas.push(`consola — ${m.text().slice(0, 200)}`);
});
page.on('pageerror', (e) => problemas.push(`EXCEPCIÓN — ${String(e).slice(0, 200)}`));
page.on('response', async (r) => {
  if (r.status() < 400) return;
  // El CUERPO, no solo el número: PostgREST dice por qué rechazó el token, y
  // "invalid claim" y "JWT expired" mandan a arreglar cosas distintas.
  const cuerpo = await r.text().catch(() => '');
  problemas.push(
    `${r.status()} en ${r.url().replace(/^https?:[/][/][^/]+/, '').slice(0, 90)}` +
      (cuerpo ? ` → ${cuerpo.slice(0, 160)}` : '')
  );
});

mkdirSync(SALIDA, { recursive: true });

/** Corre un paso, lo cronometra y saca una foto. Un paso que falla no corta. */
async function paso(nombre, fn) {
  const t0 = Date.now();
  try {
    await fn();
    const ms = Date.now() - t0;
    pasos.push({ nombre, ms, ok: true });
    console.log(`  ok   ${nombre} (${(ms / 1000).toFixed(1)}s)`);
    // NO se reporta lentitud desde acá, y esto es una corrección: la primera
    // versión decía "LENTO" para casi todos los pasos —20, 40, 65 segundos— y
    // era mentira. Antes de tocar algo, Playwright espera a que el elemento
    // esté quieto usando requestAnimationFrame, y en headless eso se arrastra
    // muchísimo. Medido aparte: el toque llega a la pantalla en 36 ms.
    //
    // Lo que sí vale medir es la RED, que se mira con las respuestas de abajo.
  } catch (e) {
    const ms = Date.now() - t0;
    pasos.push({ nombre, ms, ok: false });
    const linea = String(e).split('\n')[0].slice(0, 160);
    console.log(`  FALLA ${nombre} — ${linea}`);
    problemas.push(`el paso "${nombre}" falló: ${linea}`);
  }
  await page.screenshot({ path: join(SALIDA, `${pasos.length}-${nombre.replace(/\W+/g, '-')}.png`) })
    .catch(() => {});
}

console.log(`\nPrimera vez absoluta — ${CORREO}\n`);

// ---- 1. crear la cuenta ----
await paso('crear cuenta', async () => {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByRole('button', { name: /Primera vez/i }).click();
  await page.locator('input[type=email]').fill(CORREO);
  await page.locator('input[type=password]').fill(CLAVE);
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await page.waitForURL((u) => u.pathname === '/onboarding', { timeout: 60000 });
});

// ---- 2. elegir nombre ----
await paso('elegir nombre de usuario', async () => {
  await page.locator('input').first().fill(USUARIO);
  await page.getByRole('button', { name: 'Empezar' }).click();
  await page.waitForURL((u) => u.pathname === '/bienvenida', { timeout: 60000 });
});

// ---- 3. la guía ----
await paso('recorrer la guía', async () => {
  for (let i = 0; i < 4; i++) {
    const seguir = page.getByRole('button', { name: /Seguir|Entendido/ });
    if (!(await seguir.count())) break;
    await seguir.first().click();
    await page.waitForTimeout(400);
  }
  await page.waitForURL((u) => u.pathname === '/', { timeout: 60000 });
});

// ---- 4. la pantalla vacía ----
await paso('Inicio sin ningún dato', async () => {
  await page.locator('.racha-numero').first().waitFor({ state: 'visible', timeout: 30000 });
  const racha = (await page.locator('.racha-numero').first().textContent())?.trim();
  if (racha !== '0') problemas.push(`la racha de una cuenta nueva dice "${racha}", esperaba 0`);
});

// ---- 5. anotar el peso ANTES de registrar el día ----
// El orden importa: es el caso que rompimos ayer, cuando pesarse registraba
// el día. Acá se comprueba que después de pesarse la racha SIGUE en cero.
await paso('anotar el peso sin registrar el día', async () => {
  await page.getByRole('button', { name: /Anotar peso/i }).first().click();
  await page.locator('.hoja input[inputmode=decimal]').fill('78.5');
  await page.locator('.hoja').getByRole('button', { name: 'Anotar' }).click();
  await page.locator('.hoja').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
  // Un rato generoso a propósito: si pesarse fuera a mover la racha, quiero
  // darle tiempo de sobra a que lo haga y agarrarlo.
  await page.waitForTimeout(3000);
  const racha = (await page.locator('.racha-numero').first().textContent())?.trim();
  if (racha !== '0') problemas.push(`PESARSE MOVIÓ LA RACHA: dice "${racha}"`);
});

// ---- 6. el primer día ----
await paso('registrar el primer día', async () => {
  await page.getByRole('button', { name: 'Registrar día', exact: true }).click();
  await page.locator('.hoja').getByRole('button', { name: 'Registrar día' }).click();
  // Se ESPERA a que el número cambie, no se duerme un rato y se mira. Con un
  // `waitForTimeout` esto decía que la racha seguía en 0 y era falso: la
  // pantalla todavía no había vuelto de la base. Mismo error que ya cometí con
  // el `previo` de las capturas.
  await page
    .locator('.racha-numero')
    .filter({ hasText: /^1$/ })
    .first()
    .waitFor({ timeout: 30000 })
    .catch(() => {
      problemas.push('después del primer día la racha NO llegó a 1 en 30 s');
    });
});

// ---- 7. la primera foto ----
await paso('subir la primera foto', async () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const archivo = join(SALIDA, 'prueba.png');
  writeFileSync(archivo, png);
  await page.getByRole('button', { name: /Foto/i }).first().click();
  await page.locator('.hoja input[type=file]').setInputFiles(archivo);
  await page.locator('.hoja').getByRole('button', { name: 'Guardar' }).click();
  await page.waitForTimeout(3000);
});

// ---- 8. la sesión con series ----
await paso('sesión: arrancar, tres series, terminar', async () => {
  await page.getByRole('button', { name: /Iniciar entrenamiento/i }).click();
  await page.locator('.contador-series').waitFor({ state: 'visible', timeout: 30000 });
  for (let i = 0; i < 3; i++) {
    await page.locator('.contador-series .paso.mas').click();
    await page.waitForTimeout(600);
  }
  const n = (await page.locator('.contador-series .numero').textContent())?.trim();
  if (n !== '3') problemas.push(`el contador dice "${n}" después de tres toques`);
  await page.getByRole('button', { name: 'Terminar', exact: true }).click();
  await page.waitForTimeout(2500);
});

// ---- 9. marcar el gimnasio ----
await paso('marcar el punto del gimnasio', async () => {
  await page.goto(`${BASE}/ajustes`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByRole('button', { name: 'Marcar el punto' }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'Marcar el punto' }).click();
  await page.getByText(/precisión/i).waitFor({ timeout: 30000 });
});

// ---- 10. la primera marca de fuerza ----
await paso('anotar la primera marca', async () => {
  await page.goto(`${BASE}/fuerza`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByRole('button', { name: 'Anotar una marca' }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'Anotar una marca' }).click();
  await page.locator('.hoja select').selectOption({ index: 0 });
  await page.locator('.hoja input[inputmode=decimal]').fill('100');
  await page.locator('.hoja').getByRole('button', { name: 'Anotar' }).click();
  await page
    .locator('.marca-fila')
    .first()
    .waitFor({ timeout: 30000 })
    .catch(() => {
      problemas.push('la marca NO apareció en la lista en 30 s después de anotarla');
    });
});

// ---- 11. las pantallas vacías, una por una ----
for (const [nombre, ruta] of [
  ['Stats', '/stats'], ['Álbum', '/album'], ['Ranking', '/social'], ['perfil propio', '/yo'],
]) {
  await paso(`${nombre} con una cuenta recién creada`, async () => {
    await page.goto(BASE + ruta, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('.titulo-pantalla, .yo-cabecera').first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(2000);
  });
}

await navegador.close();
cerrar();

// ---------------------------------------------------------------
console.log(`\n${pasos.filter((p) => p.ok).length}/${pasos.length} pasos`);
// Los tiempos se imprimen como referencia, sin llamarlos problemas: en
// headless miden sobre todo la espera de Playwright, no la app.
const lentos = pasos.filter((p) => p.ms > 3000).sort((a, b) => b.ms - a.ms);
if (lentos.length) {
  console.log('\nLo que más tardó (mayormente espera del navegador, no la app):');
  for (const p of lentos.slice(0, 5)) console.log(`  ${(p.ms / 1000).toFixed(1)}s  ${p.nombre}`);
}
if (problemas.length) {
  console.log('\nProblemas:');
  for (const p of [...new Set(problemas)]) console.log(' - ' + p);
} else {
  console.log('\nSin problemas.');
}
console.log(`\nFotos de cada paso en ${SALIDA}`);
console.log(`Queda el usuario ${CORREO} en Authentication → Users (borrarlo necesita service_role).`);
process.exit(0);
